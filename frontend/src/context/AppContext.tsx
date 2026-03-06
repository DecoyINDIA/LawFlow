import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Linking, View, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Case, Client, Hearing, DocumentType, UploadStatus, VoiceNote, AdvocateProfile, AppSettings } from '../types';
import { mockCases, mockClients, mockHearings } from '../data/mockData';
import {
  getMe,
  getCases as getCasesApi,
  createCase as createCaseApi,
  updateCase as updateCaseApi,
  deleteCase as deleteCaseApi,
  getClients as getClientsApi,
  createClient as createClientApi,
  updateClient as updateClientApi,
  deleteClient as deleteClientApi,
  getHearings as getHearingsApi,
  createHearing as createHearingApi,
  updateHearing as updateHearingApi,
  deleteHearing as deleteHearingApi,
  updateMe,
  getMyFirm as getMyFirmApi,
  getFirmDashboard as getFirmDashboardApi,
} from '../services/api';
import {
  signInWithGoogle,
  uploadBackupToDrive,
  downloadBackupFromDrive,
} from '../services/googleDrive';

export type { VoiceNote, AdvocateProfile, AppSettings };
export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const DEFAULT_STATUSES = ['FILED', 'ACTIVE', 'ADJOURNED', 'STAYED', 'PENDING', 'DISPOSED'];
const DEFAULT_COURT_NAMES = [
  'Bombay High Court', 'City Civil Court', 'Family Court', 'Labour Court',
  'Sessions Court', 'District Court', 'Supreme Court of India',
];
const DEFAULT_PROFILE: AdvocateProfile = {
  name: 'Adv. Priya Sharma',
  phone: '9876543210',
  enrollmentNumber: 'MH/2018/12345',
  designation: 'Advocate',
  barCouncil: 'Bar Council of Maharashtra & Goa',
  yearsOfExperience: 7,
  practiceAreas: ['Criminal', 'Family', 'Civil'],
  primaryCourts: ['Bombay High Court', 'City Civil Court'],
};
const DEFAULT_SETTINGS: AppSettings = {
  darkMode: false,
  hearingReminders: true,
  reminderDaysBeforeHearing: 1,
};

// ── Extra Types ──────────────────────────────────────────────────────
export interface CaseDocument {
  id: string;
  caseId: string;
  caseName: string;
  fileName: string;
  fileType: DocumentType;
  fileSize: string;
  uploadStatus: UploadStatus;
  uri?: string;
  createdAt: number;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: 'HEARING_REMINDER' | 'MISSED_HEARING' | 'CASE_UPDATE' | 'SYSTEM';
  caseId?: string;
  readAt?: number;
  createdAt: number;
}

// ── Context type ─────────────────────────────────────────────────────
interface AppContextType {
  cases: Case[];
  clients: Client[];
  hearings: Hearing[];
  voiceNotes: VoiceNote[];
  documents: CaseDocument[];
  notifications: AppNotification[];
  customStatuses: string[];
  savedCourtNames: string[];
  customPartyTypes: string[];
  advocateName: string;
  advocateProfile: AdvocateProfile;
  settings: AppSettings;
  authToken: string | null;
  syncStatus: SyncStatus;

  // Auth
  signIn: (token: string, advocate: Record<string, unknown>) => void;
  signOut: () => Promise<void>;

  // Case CRUD
  addCase: (c: Omit<Case, 'id' | 'createdAt' | 'updatedAt'>) => Case;
  updateCase: (id: string, u: Partial<Case>) => void;
  deleteCase: (id: string) => void;
  getCaseById: (id: string) => Case | undefined;

  // Client CRUD
  addClient: (c: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => Client;
  updateClient: (id: string, u: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  getClientById: (id: string) => Client | undefined;

  // Hearing CRUD
  addHearing: (h: Omit<Hearing, 'id' | 'createdAt'>) => Hearing;
  updateHearing: (id: string, u: Partial<Hearing>) => void;
  deleteHearing: (id: string) => void;
  getHearingsByCaseId: (caseId: string) => Hearing[];

  // Voice Notes
  addVoiceNote: (v: Omit<VoiceNote, 'id' | 'createdAt'>) => VoiceNote;
  updateVoiceNote: (id: string, title: string) => void;
  deleteVoiceNote: (id: string) => void;
  getVoiceNotesByCaseId: (caseId: string) => VoiceNote[];

  // Documents
  addDocument: (d: Omit<CaseDocument, 'id' | 'createdAt'>) => CaseDocument;
  deleteDocument: (id: string) => void;
  getDocumentsByCaseId: (caseId: string) => CaseDocument[];

  // Notifications
  markNotificationRead: (id: string) => void;
  unreadNotificationCount: number;

  // Custom statuses
  addCustomStatus: (status: string) => void;
  deleteCustomStatus: (status: string) => void;
  getAllStatuses: () => string[];

  // Court names
  addCourtName: (name: string) => void;
  deleteCourtName: (name: string) => void;

  // Custom party types
  addCustomPartyType: (type: string) => void;
  deleteCustomPartyType: (type: string) => void;

  // Profile & Settings
  updateAdvocateProfile: (profile: Partial<AdvocateProfile>) => void;
  updateSettings: (s: Partial<AppSettings>) => void;
  clearAllData: () => Promise<void>;

  // Computed helpers
  getTodayHearings: () => Array<{ case: Case; hearing: Hearing }>;
  getUpcomingHearings: (days: number) => Array<{ case: Case; hearing: Hearing }>;
  getMissedHearings: () => Array<{ case: Case; hearing: Hearing }>;
  getCasesForClient: (clientId: string) => Case[];
  getActiveStats: () => { active: number; today: number; thisWeek: number; missed: number };
  getHearingsForDate: (date: Date) => Array<{ case: Case; hearing: Hearing }>;
  getCasesWithNextDate: () => Case[];
  getCasesAwaitingNextDate: () => Case[];

  // Communication helpers
  sendWhatsAppMessage: (phone: string, message: string) => void;
  sendSMSMessage: (phone: string, message: string) => void;

  // Phase 10 — Retry Sync + Google Drive Backup
  retrySyncAll: () => Promise<void>;
  lastBackupAt: string | null;
  backupToGoogleDrive: () => Promise<void>;
  restoreFromGoogleDrive: () => Promise<void>;

  // Phase 15 — Firm Mode
  firm: Record<string, unknown> | null;
  firmDashboard: Record<string, unknown> | null;
  isFirmOwner: boolean;
  isFirmMember: boolean;
  loadFirm: () => Promise<void>;
  loadFirmDashboard: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

// ── Seed documents ────────────────────────────────────────────────────
const seedDocs: CaseDocument[] = [
  { id: 'd-1', caseId: 'case-1', caseName: 'State vs Rajesh Sharma', fileName: 'Bail_Application.pdf', fileType: 'PDF', fileSize: '245 KB', uploadStatus: 'UPLOADED', createdAt: Date.now() - 86400000 * 5 },
  { id: 'd-2', caseId: 'case-1', caseName: 'State vs Rajesh Sharma', fileName: 'Chargesheet.pdf', fileType: 'PDF', fileSize: '1.2 MB', uploadStatus: 'UPLOADED', createdAt: Date.now() - 86400000 * 30 },
  { id: 'd-3', caseId: 'case-2', caseName: 'Patel vs Patel (Divorce)', fileName: 'Marriage_Certificate.jpg', fileType: 'IMAGE', fileSize: '380 KB', uploadStatus: 'UPLOADED', createdAt: Date.now() - 86400000 * 15 },
  { id: 'd-4', caseId: 'case-3', caseName: 'TechCorp vs BuildProp Ltd.', fileName: 'Agreement.docx', fileType: 'WORD', fileSize: '92 KB', uploadStatus: 'LOCAL_ONLY', createdAt: Date.now() - 86400000 * 2 },
];

function buildNotifications(hearings: Hearing[], cases: Case[]): AppNotification[] {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const notes: AppNotification[] = [];
  hearings.forEach(h => {
    const c = cases.find(x => x.id === h.caseId);
    if (!c) return;
    const diff = h.hearingDate - todayMs;
    if (diff > 0 && diff < 86400000) {
      notes.push({ id: 'n-' + h.id + '-td', title: 'Hearing Today', body: `${c.title} · ${h.hearingTime ?? ''} · ${c.courtName}`, type: 'HEARING_REMINDER', caseId: c.id, createdAt: Date.now() - 3600000 });
    } else if (diff >= 86400000 && diff < 86400000 * 2) {
      notes.push({ id: 'n-' + h.id + '-tm', title: 'Hearing Tomorrow', body: `${c.title} · ${h.hearingTime ?? ''} · ${c.courtName}`, type: 'HEARING_REMINDER', caseId: c.id, createdAt: Date.now() - 7200000 });
    } else if (h.hearingDate < todayMs && !h.outcome) {
      notes.push({ id: 'n-' + h.id + '-ms', title: 'Missed Hearing', body: `${c.title} — outcome not recorded`, type: 'MISSED_HEARING', caseId: c.id, createdAt: h.hearingDate + 86400000 });
    }
  });
  notes.push({ id: 'n-sys-1', title: 'Welcome to LawFlow', body: 'Your legal practice, organised. Start by adding cases and clients.', type: 'SYSTEM', createdAt: Date.now() - 86400000 * 7 });
  return notes.sort((a, b) => b.createdAt - a.createdAt);
}

// ── Storage keys ──────────────────────────────────────────────────────
const KEYS = {
  cases: 'lawflow_cases',
  clients: 'lawflow_clients',
  hearings: 'lawflow_hearings',
  customStatuses: 'lawflow_custom_statuses',
  customPartyTypes: 'lawflow_custom_party_types',
  advocateProfile: 'lawflow_advocate_profile',
  voiceNotes: 'lawflow_voice_notes',
  documents: 'lawflow_documents',
  courtNames: 'lawflow_court_names',
  settings: 'lawflow_settings',
  authToken: 'lawflow_auth_token',
  lastBackupAt: 'lawflow_last_backup',
};

// ── Provider ─────────────────────────────────────────────────────────
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [cases, setCases] = useState<Case[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [hearings, setHearings] = useState<Hearing[]>([]);
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [customStatuses, setCustomStatuses] = useState<string[]>([]);
  const [customPartyTypes, setCustomPartyTypes] = useState<string[]>([]);
  const [savedCourtNames, setSavedCourtNames] = useState<string[]>(DEFAULT_COURT_NAMES);
  const [advocateProfile, setAdvocateProfile] = useState<AdvocateProfile>(DEFAULT_PROFILE);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('syncing');
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);

  // Phase 15 — Firm state
  const [firm, setFirm] = useState<Record<string, unknown> | null>(null);
  const [firmDashboard, setFirmDashboard] = useState<Record<string, unknown> | null>(null);
  const [advocateId, setAdvocateId] = useState<string | null>(null);

  // Refs for stable access in callbacks
  const authTokenRef = useRef<string | null>(null);
  const casesRef = useRef<Case[]>([]);
  const hearingsRef = useRef<Hearing[]>([]);
  const settingsRef = useRef<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => { authTokenRef.current = authToken; }, [authToken]);
  useEffect(() => { casesRef.current = cases; }, [cases]);
  useEffect(() => { hearingsRef.current = hearings; }, [hearings]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // ── Load from AsyncStorage on mount ──────────────────────────────
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [
          sCases, sClients, sHearings, sStatuses, sPartyTypes,
          sVoiceNotes, sDocuments, sCourtNames, sProfile, sSettings, sToken, sBackupAt,
        ] = await Promise.all([
          AsyncStorage.getItem(KEYS.cases),
          AsyncStorage.getItem(KEYS.clients),
          AsyncStorage.getItem(KEYS.hearings),
          AsyncStorage.getItem(KEYS.customStatuses),
          AsyncStorage.getItem(KEYS.customPartyTypes),
          AsyncStorage.getItem(KEYS.voiceNotes),
          AsyncStorage.getItem(KEYS.documents),
          AsyncStorage.getItem(KEYS.courtNames),
          AsyncStorage.getItem(KEYS.advocateProfile),
          AsyncStorage.getItem(KEYS.settings),
          AsyncStorage.getItem(KEYS.authToken),
          AsyncStorage.getItem(KEYS.lastBackupAt),
        ]);

        if (!mounted) return;

        const loadedCases: Case[] = sCases ? JSON.parse(sCases) : mockCases;
        const loadedHearings: Hearing[] = sHearings ? JSON.parse(sHearings) : mockHearings;

        setCases(loadedCases);
        setClients(sClients ? JSON.parse(sClients) : mockClients);
        setHearings(loadedHearings);
        setCustomStatuses(sStatuses ? JSON.parse(sStatuses) : []);
        setCustomPartyTypes(sPartyTypes ? JSON.parse(sPartyTypes) : []);
        setVoiceNotes(sVoiceNotes ? JSON.parse(sVoiceNotes) : []);
        setDocuments(sDocuments ? JSON.parse(sDocuments) : seedDocs);
        setSavedCourtNames(sCourtNames ? JSON.parse(sCourtNames) : DEFAULT_COURT_NAMES);
        setAdvocateProfile(sProfile ? { ...DEFAULT_PROFILE, ...JSON.parse(sProfile) } : DEFAULT_PROFILE);
        setSettings(sSettings ? { ...DEFAULT_SETTINGS, ...JSON.parse(sSettings) } : DEFAULT_SETTINGS);
        setNotifications(buildNotifications(loadedHearings, loadedCases));

        if (sToken) {
          setAuthToken(sToken);
          authTokenRef.current = sToken;
        }
        if (sBackupAt) setLastBackupAt(sBackupAt);
      } catch {
        if (!mounted) return;
        setCases(mockCases);
        setClients(mockClients);
        setHearings(mockHearings);
        setDocuments(seedDocs);
        setNotifications(buildNotifications(mockHearings, mockCases));
        setSyncStatus('offline');
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  // ── Backend sync when token available ────────────────────────────
  const loadBackendData = useCallback(async (token: string) => {
    setSyncStatus('syncing');
    try {
      const [meResp, casesResp, clientsResp, hearingsResp] = await Promise.all([
        getMe(token),
        getCasesApi(token),
        getClientsApi(token),
        getHearingsApi(token),
      ]);

      if (!meResp.success) throw Object.assign(new Error('Unauthorized'), { status: 401 });

      // Update advocate profile from backend
      const profile = meResp.data as Record<string, unknown>;
      if (profile) {
        if (profile.id) setAdvocateId(profile.id as string);
        setAdvocateProfile(prev => ({
          ...prev,
          name: (profile.name as string) || prev.name,
          phone: (profile.phone as string) || prev.phone,
          email: (profile.email as string) || prev.email || undefined,
          enrollmentNumber: (profile.enrollmentNumber as string) || prev.enrollmentNumber || undefined,
          designation: (profile.designation as string) || prev.designation || undefined,
          barCouncil: (profile.barCouncil as string) || prev.barCouncil || undefined,
          practiceAreas: (profile.practiceAreas as string[])?.length ? (profile.practiceAreas as string[]) : prev.practiceAreas,
          primaryCourts: (profile.primaryCourts as string[])?.length ? (profile.primaryCourts as string[]) : prev.primaryCourts,
        }));
      }

      const bCases = (casesResp?.data || []) as Case[];
      const bClients = (clientsResp?.data || []) as Client[];
      const bHearings = (hearingsResp?.data || []) as Hearing[];

      // Merge: keep syncPending local items not yet on backend
      setCases(prev => {
        const localOnly = prev.filter(lc => lc.syncPending && !bCases.find(bc => bc.id === lc.id));
        return [...bCases, ...localOnly];
      });
      setClients(prev => {
        const localOnly = prev.filter(lc => lc.syncPending && !bClients.find(bc => bc.id === lc.id));
        return [...bClients, ...localOnly];
      });
      setHearings(prev => {
        const localOnly = prev.filter(lh => lh.syncPending && !bHearings.find(bh => bh.id === lh.id));
        return [...bHearings, ...localOnly];
      });

      if (bCases.length > 0 || bHearings.length > 0) {
        setNotifications(buildNotifications(bHearings, bCases));
      }
      await Promise.all([
        AsyncStorage.setItem(KEYS.cases, JSON.stringify(bCases)),
        AsyncStorage.setItem(KEYS.clients, JSON.stringify(bClients)),
        AsyncStorage.setItem(KEYS.hearings, JSON.stringify(bHearings)),
      ]);

      setSyncStatus('synced');
    } catch (err: any) {
      if (err?.status === 401) {
        await AsyncStorage.removeItem(KEYS.authToken);
        setAuthToken(null);
        authTokenRef.current = null;
      }
      setSyncStatus('offline');
    }
  }, []);

  useEffect(() => {
    if (!isLoading && authToken) {
      loadBackendData(authToken);
    } else if (!isLoading && !authToken) {
      setSyncStatus('synced');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, isLoading]);

  // ── Background sync helper ────────────────────────────────────────
  const doBackgroundSync = useCallback(async (
    operation: () => Promise<unknown>,
    onFail?: () => void,
  ) => {
    if (!authTokenRef.current) return;
    setSyncStatus('syncing');
    try {
      await operation();
      setSyncStatus('synced');
    } catch {
      setSyncStatus('offline');
      onFail?.();
    }
  }, []);

  // ── Persist on state changes ──────────────────────────────────────
  useEffect(() => {
    if (isLoading) return;
    AsyncStorage.setItem(KEYS.cases, JSON.stringify(cases)).catch(() => {});
  }, [cases, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    AsyncStorage.setItem(KEYS.clients, JSON.stringify(clients)).catch(() => {});
  }, [clients, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    AsyncStorage.setItem(KEYS.hearings, JSON.stringify(hearings)).catch(() => {});
  }, [hearings, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    AsyncStorage.setItem(KEYS.customStatuses, JSON.stringify(customStatuses)).catch(() => {});
  }, [customStatuses, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    AsyncStorage.setItem(KEYS.customPartyTypes, JSON.stringify(customPartyTypes)).catch(() => {});
  }, [customPartyTypes, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    AsyncStorage.setItem(KEYS.voiceNotes, JSON.stringify(voiceNotes)).catch(() => {});
  }, [voiceNotes, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    AsyncStorage.setItem(KEYS.documents, JSON.stringify(documents)).catch(() => {});
  }, [documents, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    AsyncStorage.setItem(KEYS.courtNames, JSON.stringify(savedCourtNames)).catch(() => {});
  }, [savedCourtNames, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    AsyncStorage.setItem(KEYS.advocateProfile, JSON.stringify(advocateProfile)).catch(() => {});
  }, [advocateProfile, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    AsyncStorage.setItem(KEYS.settings, JSON.stringify(settings)).catch(() => {});
  }, [settings, isLoading]);

  // ── Auth ──────────────────────────────────────────────────────────
  const signIn = useCallback((token: string, advocate: Record<string, unknown>) => {
    setAuthToken(token);
    authTokenRef.current = token;
    // Update profile from backend advocate data
    const update: Partial<AdvocateProfile> = {};
    if (advocate.name) update.name = advocate.name as string;
    if (advocate.phone) update.phone = advocate.phone as string;
    if (advocate.email) update.email = advocate.email as string;
    if (advocate.enrollmentNumber) update.enrollmentNumber = advocate.enrollmentNumber as string;
    if (advocate.designation) update.designation = advocate.designation as string;
    if (advocate.barCouncil) update.barCouncil = advocate.barCouncil as string;
    if ((advocate.practiceAreas as string[])?.length) update.practiceAreas = advocate.practiceAreas as string[];
    if ((advocate.primaryCourts as string[])?.length) update.primaryCourts = advocate.primaryCourts as string[];
    if (Object.keys(update).length > 0) {
      setAdvocateProfile(prev => ({ ...prev, ...update }));
    }
  }, []);

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(KEYS.authToken);
    setAuthToken(null);
    authTokenRef.current = null;
    setSyncStatus('synced');
    await Promise.all([
      AsyncStorage.removeItem(KEYS.cases),
      AsyncStorage.removeItem(KEYS.clients),
      AsyncStorage.removeItem(KEYS.hearings),
      AsyncStorage.removeItem(KEYS.voiceNotes),
      AsyncStorage.removeItem(KEYS.documents),
      AsyncStorage.removeItem(KEYS.customStatuses),
      AsyncStorage.removeItem(KEYS.customPartyTypes),
      AsyncStorage.removeItem(KEYS.courtNames),
    ]);
    setCases([]);
    setClients([]);
    setHearings([]);
    setVoiceNotes([]);
    setDocuments([]);
    setCustomStatuses([]);
    setCustomPartyTypes([]);
    setSavedCourtNames(DEFAULT_COURT_NAMES);
    setNotifications([]);
  }, []);

  // ── Cases ─────────────────────────────────────────────────────────
  const addCase = useCallback((c: Omit<Case, 'id' | 'createdAt' | 'updatedAt'>): Case => {
    const now = Date.now();
    const n: Case = { ...c, id: genId(), createdAt: now, updatedAt: now };
    setCases(p => [n, ...p]);
    if (c.courtName) setSavedCourtNames(p => p.includes(c.courtName) ? p : [...p, c.courtName]);
    doBackgroundSync(
      () => createCaseApi(n),
      () => setCases(p => p.map(x => x.id === n.id ? { ...x, syncPending: true } : x)),
    );
    if (c.nextHearingDate) {
      const h: Hearing = {
        id: genId(),
        caseId: n.id,
        hearingDate: c.nextHearingDate,
        purpose: 'Next Hearing',
        clientNotified: false,
        createdAt: now,
      };
      setHearings(p => [...p, h]);
      doBackgroundSync(
        () => createHearingApi(h),
        () => setHearings(p => p.map(x => x.id === h.id ? { ...x, syncPending: true } : x)),
      );
    }
    return n;
  }, [doBackgroundSync]);

  const updateCase = useCallback((id: string, u: Partial<Case>) => {
    setCases(p => p.map(c => c.id === id ? { ...c, ...u, updatedAt: Date.now() } : c));
    if (u.courtName) setSavedCourtNames(p => p.includes(u.courtName!) ? p : [...p, u.courtName!]);
    doBackgroundSync(
      () => updateCaseApi(id, u),
      () => setCases(p => p.map(x => x.id === id ? { ...x, syncPending: true } : x)),
    );
  }, [doBackgroundSync]);

  const deleteCase = useCallback((id: string) => {
    setCases(p => p.filter(c => c.id !== id));
    setHearings(p => p.filter(h => h.caseId !== id));
    doBackgroundSync(() => deleteCaseApi(id));
  }, [doBackgroundSync]);

  const getCaseById = useCallback((id: string) => cases.find(c => c.id === id), [cases]);

  // ── Clients ───────────────────────────────────────────────────────
  const addClient = useCallback((c: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Client => {
    const now = Date.now();
    const n: Client = { ...c, id: genId(), createdAt: now, updatedAt: now };
    setClients(p => [n, ...p]);
    doBackgroundSync(
      () => createClientApi(n),
      () => setClients(p => p.map(x => x.id === n.id ? { ...x, syncPending: true } : x)),
    );
    return n;
  }, [doBackgroundSync]);

  const updateClient = useCallback((id: string, u: Partial<Client>) => {
    setClients(p => p.map(c => c.id === id ? { ...c, ...u, updatedAt: Date.now() } : c));
    doBackgroundSync(
      () => updateClientApi(id, u),
      () => setClients(p => p.map(x => x.id === id ? { ...x, syncPending: true } : x)),
    );
  }, [doBackgroundSync]);

  const deleteClient = useCallback((id: string) => {
    setClients(p => p.filter(c => c.id !== id));
    doBackgroundSync(() => deleteClientApi(id));
  }, [doBackgroundSync]);

  const getClientById = useCallback((id: string) => clients.find(c => c.id === id), [clients]);

  // ── Hearings ──────────────────────────────────────────────────────
  const addHearing = useCallback((h: Omit<Hearing, 'id' | 'createdAt'>): Hearing => {
    const n: Hearing = { ...h, id: genId(), createdAt: Date.now() };
    setHearings(p => [...p, n]);
    doBackgroundSync(
      () => createHearingApi(n),
      () => setHearings(p => p.map(x => x.id === n.id ? { ...x, syncPending: true } : x)),
    );
    return n;
  }, [doBackgroundSync]);

  const updateHearing = useCallback((id: string, u: Partial<Hearing>) => {
    setHearings(p => p.map(h => h.id === id ? { ...h, ...u } : h));
    doBackgroundSync(
      () => updateHearingApi(id, u),
      () => setHearings(p => p.map(x => x.id === id ? { ...x, syncPending: true } : x)),
    );
  }, [doBackgroundSync]);

  const deleteHearing = useCallback((id: string) => {
    setHearings(p => p.filter(h => h.id !== id));
    doBackgroundSync(() => deleteHearingApi(id));
  }, [doBackgroundSync]);

  const getHearingsByCaseId = useCallback((caseId: string) =>
    hearings.filter(h => h.caseId === caseId).sort((a, b) => a.hearingDate - b.hearingDate),
    [hearings]);

  // ── Voice Notes ───────────────────────────────────────────────────
  const addVoiceNote = useCallback((v: Omit<VoiceNote, 'id' | 'createdAt'>): VoiceNote => {
    const n: VoiceNote = { ...v, id: genId(), createdAt: Date.now() };
    setVoiceNotes(p => [n, ...p]);
    return n;
  }, []);

  const updateVoiceNote = useCallback((id: string, title: string) => {
    setVoiceNotes(p => p.map(v => v.id === id ? { ...v, title } : v));
  }, []);

  const deleteVoiceNote = useCallback((id: string) => setVoiceNotes(p => p.filter(v => v.id !== id)), []);

  const getVoiceNotesByCaseId = useCallback((caseId: string) =>
    voiceNotes.filter(v => v.caseId === caseId), [voiceNotes]);

  // ── Documents ─────────────────────────────────────────────────────
  const addDocument = useCallback((d: Omit<CaseDocument, 'id' | 'createdAt'>): CaseDocument => {
    const n: CaseDocument = { ...d, id: genId(), createdAt: Date.now() };
    setDocuments(p => [n, ...p]);
    return n;
  }, []);

  const deleteDocument = useCallback((id: string) => setDocuments(p => p.filter(d => d.id !== id)), []);

  const getDocumentsByCaseId = useCallback((caseId: string) =>
    documents.filter(d => d.caseId === caseId), [documents]);

  // ── Notifications ─────────────────────────────────────────────────
  const markNotificationRead = useCallback((id: string) => {
    setNotifications(p => p.map(n => n.id === id ? { ...n, readAt: Date.now() } : n));
  }, []);

  const unreadNotificationCount = notifications.filter(n => !n.readAt).length;

  // ── Custom statuses ───────────────────────────────────────────────
  const addCustomStatus = useCallback((status: string) => {
    if (!customStatuses.includes(status) && !DEFAULT_STATUSES.includes(status)) {
      setCustomStatuses(p => [...p, status]);
    }
  }, [customStatuses]);

  const deleteCustomStatus = useCallback((status: string) => {
    setCustomStatuses(p => p.filter(s => s !== status));
  }, []);

  const getAllStatuses = useCallback(() => [...DEFAULT_STATUSES, ...customStatuses], [customStatuses]);

  // ── Court names ───────────────────────────────────────────────────
  const addCourtName = useCallback((name: string) => {
    if (!savedCourtNames.includes(name)) setSavedCourtNames(p => [...p, name]);
  }, [savedCourtNames]);

  const deleteCourtName = useCallback((name: string) => {
    setSavedCourtNames(p => p.filter(n => n !== name));
  }, []);

  // ── Custom party types ────────────────────────────────────────────
  const addCustomPartyType = useCallback((type: string) => {
    if (!customPartyTypes.includes(type)) setCustomPartyTypes(p => [...p, type]);
  }, [customPartyTypes]);

  const deleteCustomPartyType = useCallback((type: string) => {
    setCustomPartyTypes(p => p.filter(t => t !== type));
  }, []);

  // ── Profile & Settings ────────────────────────────────────────────
  const updateAdvocateProfile = useCallback((update: Partial<AdvocateProfile>) => {
    setAdvocateProfile(prev => {
      const updated = { ...prev, ...update };
      // Background sync to backend
      if (authTokenRef.current) {
        setSyncStatus('syncing');
        updateMe(update as Record<string, unknown>)
          .then(() => setSyncStatus('synced'))
          .catch(() => setSyncStatus('offline'));
      }
      return updated;
    });
  }, []);

  const updateSettings = useCallback((update: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...update }));
  }, []);

  const clearAllData = useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem(KEYS.cases),
      AsyncStorage.removeItem(KEYS.clients),
      AsyncStorage.removeItem(KEYS.hearings),
      AsyncStorage.removeItem(KEYS.voiceNotes),
      AsyncStorage.removeItem(KEYS.documents),
      AsyncStorage.removeItem(KEYS.customStatuses),
      AsyncStorage.removeItem(KEYS.customPartyTypes),
      AsyncStorage.removeItem(KEYS.courtNames),
    ]);
    setCases([]);
    setClients([]);
    setHearings([]);
    setVoiceNotes([]);
    setDocuments([]);
    setCustomStatuses([]);
    setCustomPartyTypes([]);
    setSavedCourtNames(DEFAULT_COURT_NAMES);
    setNotifications([]);
  }, []);

  // ── Computed helpers ──────────────────────────────────────────────
  const getTodayHearings = useCallback(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const start = d.getTime(); const end = start + 86400000;
    return hearings
      .filter(h => h.hearingDate >= start && h.hearingDate < end)
      .map(h => { const c = cases.find(x => x.id === h.caseId); return c ? { case: c, hearing: h } : null; })
      .filter(Boolean) as Array<{ case: Case; hearing: Hearing }>;
  }, [hearings, cases]);

  const getUpcomingHearings = useCallback((days: number) => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const start = d.getTime() + 86400000; const end = d.getTime() + days * 86400000;
    return hearings
      .filter(h => h.hearingDate >= start && h.hearingDate <= end)
      .sort((a, b) => a.hearingDate - b.hearingDate)
      .map(h => { const c = cases.find(x => x.id === h.caseId); return c ? { case: c, hearing: h } : null; })
      .filter(Boolean) as Array<{ case: Case; hearing: Hearing }>;
  }, [hearings, cases]);

  const getMissedHearings = useCallback(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const todayMs = d.getTime();
    return hearings
      .filter(h => h.hearingDate < todayMs && !h.outcome)
      .sort((a, b) => b.hearingDate - a.hearingDate)
      .map(h => { const c = cases.find(x => x.id === h.caseId); return c ? { case: c, hearing: h } : null; })
      .filter(Boolean) as Array<{ case: Case; hearing: Hearing }>;
  }, [hearings, cases]);

  const getCasesForClient = useCallback((clientId: string) =>
    cases.filter(c => c.clientId === clientId), [cases]);

  const getActiveStats = useCallback(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const todayMs = d.getTime();
    return {
      active: cases.filter(c => c.status === 'ACTIVE').length,
      today: hearings.filter(h => h.hearingDate >= todayMs && h.hearingDate < todayMs + 86400000).length,
      thisWeek: hearings.filter(h => h.hearingDate >= todayMs && h.hearingDate < todayMs + 7 * 86400000).length,
      missed: hearings.filter(h => h.hearingDate < todayMs && !h.outcome).length,
    };
  }, [cases, hearings]);

  const getHearingsForDate = useCallback((date: Date) => {
    const d = new Date(date); d.setHours(0, 0, 0, 0);
    const start = d.getTime(); const end = start + 86400000;
    return hearings
      .filter(h => h.hearingDate >= start && h.hearingDate < end)
      .map(h => { const c = cases.find(x => x.id === h.caseId); return c ? { case: c, hearing: h } : null; })
      .filter(Boolean) as Array<{ case: Case; hearing: Hearing }>;
  }, [hearings, cases]);

  const getCasesWithNextDate = useCallback(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const todayMs = d.getTime();
    return cases.filter(c => c.nextHearingDate && c.nextHearingDate >= todayMs);
  }, [cases]);

  const getCasesAwaitingNextDate = useCallback(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const todayMs = d.getTime();
    return cases.filter(c =>
      c.isActive &&
      c.status !== 'DISPOSED' &&
      (!c.nextHearingDate || c.nextHearingDate < todayMs)
    );
  }, [cases]);

  // ── Phase 10 — Retry Sync ────────────────────────────────────────
  const retrySyncAll = useCallback(async () => {
    if (!authTokenRef.current) return;
    setSyncStatus('syncing');
    try {
      const currentCases = casesRef.current;
      const pendingCases = currentCases.filter(c => c.syncPending);
      const pendingClients: Client[] = [];
      const pendingHearings: Hearing[] = [];

      // Gather pending from current state refs
      await Promise.all([
        // Re-sync pending cases
        ...pendingCases.map(async (c) => {
          try {
            await updateCaseApi(c.id, c);
            setCases(p => p.map(x => x.id === c.id ? { ...x, syncPending: false } : x));
          } catch {
            // Keep syncPending true
          }
        }),
      ]);

      // Get current state for clients and hearings (from refs not available, use functional update)
      let clientsResolved = false;
      let hearingsResolved = false;
      await new Promise<void>((resolve) => {
        setClients(prev => {
          pendingClients.push(...prev.filter(c => c.syncPending));
          clientsResolved = true;
          if (clientsResolved && hearingsResolved) resolve();
          return prev;
        });
        setHearings(prev => {
          pendingHearings.push(...prev.filter(h => h.syncPending));
          hearingsResolved = true;
          if (clientsResolved && hearingsResolved) resolve();
          return prev;
        });
        // Safety timeout
        setTimeout(resolve, 100);
      });

      await Promise.all([
        ...pendingClients.map(async (c) => {
          try {
            await updateClientApi(c.id, c);
            setClients(p => p.map(x => x.id === c.id ? { ...x, syncPending: false } : x));
          } catch { /* keep pending */ }
        }),
        ...pendingHearings.map(async (h) => {
          try {
            await updateHearingApi(h.id, h);
            setHearings(p => p.map(x => x.id === h.id ? { ...x, syncPending: false } : x));
          } catch { /* keep pending */ }
        }),
      ]);

      setSyncStatus('synced');
    } catch {
      setSyncStatus('error');
    }
  }, []);

  // ── Phase 10 — Google Drive Backup ──────────────────────────────
  const backupToGoogleDrive = useCallback(async () => {
    try {
      const accessToken = await signInWithGoogle();
      if (!accessToken) return; // User cancelled — silent return

      const backup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        cases: casesRef.current,
        clients: [] as Client[],
        customStatuses: [] as string[],
        customPartyTypes: [] as string[],
        courtNames: [] as string[],
        advocateProfile: {} as AdvocateProfile,
      };

      // Capture current state values synchronously via functional updates
      await new Promise<void>((resolve) => {
        let remaining = 5;
        const done = () => { remaining--; if (remaining === 0) resolve(); };
        setClients(prev => { backup.clients = prev; done(); return prev; });
        setCustomStatuses(prev => { backup.customStatuses = prev; done(); return prev; });
        setCustomPartyTypes(prev => { backup.customPartyTypes = prev; done(); return prev; });
        setSavedCourtNames(prev => { backup.courtNames = prev; done(); return prev; });
        setAdvocateProfile(prev => { backup.advocateProfile = prev; done(); return prev; });
        setTimeout(resolve, 200);
      });

      await uploadBackupToDrive(accessToken, JSON.stringify(backup, null, 2));
      const iso = new Date().toISOString();
      setLastBackupAt(iso);
      await AsyncStorage.setItem(KEYS.lastBackupAt, iso);
    } catch {
      Alert.alert('Backup Failed', 'Backup failed. Please try again.');
    }
  }, []);

  const restoreFromGoogleDrive = useCallback(async () => {
    Alert.alert(
      'Restore from Google Drive',
      'This will replace all current data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            try {
              const accessToken = await signInWithGoogle();
              if (!accessToken) return; // User cancelled — silent return

              const raw = await downloadBackupFromDrive(accessToken);
              if (!raw) throw new Error('No backup found');

              const parsed = JSON.parse(raw);
              if (
                parsed.version !== 1 ||
                (!parsed.cases?.length && !parsed.clients?.length)
              ) throw new Error('Invalid backup');

              // Replace state
              if (parsed.cases) setCases(parsed.cases);
              if (parsed.clients) setClients(parsed.clients);
              if (parsed.customStatuses) setCustomStatuses(parsed.customStatuses);
              if (parsed.customPartyTypes) setCustomPartyTypes(parsed.customPartyTypes);
              if (parsed.courtNames) setSavedCourtNames(parsed.courtNames);
              if (parsed.advocateProfile) setAdvocateProfile(prev => ({ ...prev, ...parsed.advocateProfile }));

              // Persist to AsyncStorage
              await Promise.all([
                parsed.cases && AsyncStorage.setItem(KEYS.cases, JSON.stringify(parsed.cases)),
                parsed.clients && AsyncStorage.setItem(KEYS.clients, JSON.stringify(parsed.clients)),
                parsed.customStatuses && AsyncStorage.setItem(KEYS.customStatuses, JSON.stringify(parsed.customStatuses)),
                parsed.customPartyTypes && AsyncStorage.setItem(KEYS.customPartyTypes, JSON.stringify(parsed.customPartyTypes)),
                parsed.courtNames && AsyncStorage.setItem(KEYS.courtNames, JSON.stringify(parsed.courtNames)),
                parsed.advocateProfile && AsyncStorage.setItem(KEYS.advocateProfile, JSON.stringify(parsed.advocateProfile)),
              ].filter(Boolean));

              Alert.alert('Restore Complete', 'Your data has been restored.');
            } catch {
              Alert.alert('Restore Failed', 'No valid backup found.');
            }
          },
        },
      ],
    );
  }, []);

  // ── Phase 15 — Firm functions ─────────────────────────────────────
  const loadFirm = useCallback(async () => {
    if (!authTokenRef.current) return;
    try {
      const resp = await getMyFirmApi(authTokenRef.current);
      if (resp.success) setFirm(resp.data);
    } catch {
      // silent — firm not required
    }
  }, []);

  const loadFirmDashboard = useCallback(async () => {
    if (!authTokenRef.current) return;
    try {
      const resp = await getFirmDashboardApi(authTokenRef.current);
      if (resp.success) setFirmDashboard(resp.data);
    } catch {
      // silent — owner only
    }
  }, []);

  const isFirmOwner = Boolean(firm && firm.ownerId && advocateId && (firm as any).ownerId === advocateId);
  const isFirmMember = Boolean(firm);

  // ── Communication helpers ─────────────────────────────────────────
  const sendWhatsAppMessage = useCallback((phone: string, message: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const url = `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`);
    });
  }, []);

  const sendSMSMessage = useCallback((phone: string, message: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    Linking.openURL(`sms:${cleanPhone}?body=${encodeURIComponent(message)}`);
  }, []);

  // ── Loading gate ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  return (
    <AppContext.Provider value={{
      cases, clients, hearings, voiceNotes, documents, notifications,
      customStatuses, savedCourtNames, customPartyTypes,
      advocateName: advocateProfile.name,
      advocateProfile, settings,
      authToken, syncStatus,
      signIn, signOut,
      addCase, updateCase, deleteCase, getCaseById,
      addClient, updateClient, deleteClient, getClientById,
      addHearing, updateHearing, deleteHearing, getHearingsByCaseId,
      addVoiceNote, updateVoiceNote, deleteVoiceNote, getVoiceNotesByCaseId,
      addDocument, deleteDocument, getDocumentsByCaseId,
      markNotificationRead, unreadNotificationCount,
      addCustomStatus, deleteCustomStatus, getAllStatuses,
      addCourtName, deleteCourtName,
      addCustomPartyType, deleteCustomPartyType,
      updateAdvocateProfile, updateSettings, clearAllData,
      getTodayHearings, getUpcomingHearings, getMissedHearings,
      getCasesForClient, getActiveStats, getHearingsForDate,
      getCasesWithNextDate, getCasesAwaitingNextDate,
      sendWhatsAppMessage, sendSMSMessage,
      retrySyncAll, lastBackupAt, backupToGoogleDrive, restoreFromGoogleDrive,
      firm, firmDashboard, isFirmOwner, isFirmMember, loadFirm, loadFirmDashboard,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
