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
  getInboxNotifications as getInboxNotificationsApi,
  markInboxNotificationRead as markInboxNotificationReadApi,
} from '../services/api';
import {
  signInWithGoogle,
  uploadBackupToDrive,
  downloadBackupFromDrive,
} from '../services/googleDrive';
import {
  syncHearingToCalendar,
  deleteCalendarEvent,
  requestCalendarPermission,
  getOrCreateLawFlowCalendar,
} from '../services/calendarSync';
import {
  connectToDrive,
  clearDriveToken,
  getStoredDriveToken,
  DRIVE_EMAIL_KEY,
  syncDocumentToDrive,
  syncVoiceNoteToDrive,
} from '../services/googleDriveFiles';

export type { VoiceNote, AdvocateProfile, AppSettings };
export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const DEFAULT_STATUSES = ['FILED', 'ACTIVE', 'ADJOURNED', 'STAYED', 'PENDING', 'DISPOSED'];
const DEFAULT_COURT_NAMES = [
  'Bombay High Court', 'City Civil Court', 'Family Court', 'Labour Court',
  'Sessions Court', 'District Court', 'Supreme Court of India',
];
const DEFAULT_PROFILE: AdvocateProfile = {
  name: '',
  phone: '',
};
const DEFAULT_SETTINGS: AppSettings = {
  darkMode: true,
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
  // Phase 23 — Google Drive
  googleDriveFileId?: string;
  googleDriveUrl?: string;
  isSynced?: boolean;
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

export interface InboxNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
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
  customCaseTypes: string[];
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

  // Custom case types
  addCustomCaseType: (caseType: string) => void;
  deleteCustomCaseType: (caseType: string) => void;
  getAllCaseTypes: () => string[];

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

  // Phase 23 — Google Drive File Storage
  isDriveConnected: boolean;
  driveEmail: string;
  connectDrive: () => Promise<boolean>;
  disconnectDrive: () => void;
  updateDocumentDriveSync: (id: string, driveFileId: string, driveUrl: string) => void;
  updateVoiceNoteDriveSync: (id: string, driveFileId: string, driveUrl: string) => void;

  // Phase 24 — Background upload tracking + Sync All
  docUploadStatus: Record<string, 'uploading' | 'failed'>;
  setDocUploading: (id: string) => void;
  clearDocUpload: (id: string) => void;
  setDocUploadFailed: (id: string) => void;
  isDocUploading: (id: string) => boolean;
  isDocUploadFailed: (id: string) => boolean;
  syncAllToDrive: (onProgress: (current: number, total: number) => void, onDone: (failedCount: number) => void) => Promise<void>;

  // Phase 26 — Device Calendar Sync
  calendarSyncEnabled: boolean;
  deviceCalendarId: string | null;
  hearingCalendarEventIds: Record<string, string>;
  enableCalendarSync: () => Promise<boolean>;
  disableCalendarSync: () => void;
  setHearingCalendarEventId: (hearingId: string, eventId: string) => void;

  // Phase 27 — Subscription & Plan
  userPlan: 'free' | 'pro';
  planExpiry: string | null;
  isProUser: boolean;
  planHistory: any[];
  refreshPlan: () => Promise<void>;

  // Referral System
  referralCode: string | null;

  // Phase 15 — Firm Mode
  firm: Record<string, unknown> | null;
  firmDashboard: Record<string, unknown> | null;
  isFirmOwner: boolean;
  isFirmMember: boolean;
  loadFirm: () => Promise<void>;
  loadFirmDashboard: () => Promise<void>;

  // Inbox Notifications (backend-stored, e.g. firm invites)
  inboxNotifications: InboxNotification[];
  inboxUnreadCount: number;
  loadInboxNotifications: () => Promise<void>;
  markInboxNotificationRead: (id: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

// ── Seed documents ────────────────────────────────────────────────────
const seedDocs: CaseDocument[] = [
  { id: 'd-1', caseId: 'case-1', caseName: 'Demo Case 1', fileName: 'Bail_Application.pdf', fileType: 'PDF', fileSize: '245 KB', uploadStatus: 'UPLOADED', createdAt: Date.now() - 86400000 * 5 },
  { id: 'd-2', caseId: 'case-1', caseName: 'Demo Case 1', fileName: 'Chargesheet.pdf', fileType: 'PDF', fileSize: '1.2 MB', uploadStatus: 'UPLOADED', createdAt: Date.now() - 86400000 * 30 },
  { id: 'd-3', caseId: 'case-2', caseName: 'Demo Case 2', fileName: 'Marriage_Certificate.jpg', fileType: 'IMAGE', fileSize: '380 KB', uploadStatus: 'UPLOADED', createdAt: Date.now() - 86400000 * 15 },
  { id: 'd-4', caseId: 'case-3', caseName: 'Demo Case 3', fileName: 'Agreement.docx', fileType: 'WORD', fileSize: '92 KB', uploadStatus: 'LOCAL_ONLY', createdAt: Date.now() - 86400000 * 2 },
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
  return notes.sort((a, b) => b.createdAt - a.createdAt);
}

// ── Storage keys ──────────────────────────────────────────────────────
const KEYS = {
  cases: 'lawflow_cases',
  clients: 'lawflow_clients',
  hearings: 'lawflow_hearings',
  customStatuses: 'lawflow_custom_statuses',
  customCaseTypes: 'lawflow_custom_case_types',
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
  const [customCaseTypes, setCustomCaseTypes] = useState<string[]>([]);
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

  // Phase 23 — Google Drive File Storage
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [driveEmail, setDriveEmail] = useState('');

  // Phase 24 — Document upload tracking
  const [docUploadStatus, setDocUploadStatusState] = useState<Record<string, 'uploading' | 'failed'>>({});

  // Phase 26 — Device Calendar Sync
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(false);
  const [deviceCalendarId, setDeviceCalendarId] = useState<string | null>(null);
  const [hearingCalendarEventIds, setHearingCalendarEventIds] = useState<Record<string, string>>({});

  // Phase 27 — Subscription & Plan
  const [userPlan, setUserPlan] = useState<'free' | 'pro'>('free');
  const [planExpiry, setPlanExpiry] = useState<string | null>(null);
  const [planHistory, setPlanHistory] = useState<any[]>([]);

  // Referral System
  const [referralCode, setReferralCode] = useState<string | null>(null);

  // Refs for stable access in callbacks
  const authTokenRef = useRef<string | null>(null);
  const casesRef = useRef<Case[]>([]);
  const hearingsRef = useRef<Hearing[]>([]);
  const settingsRef = useRef<AppSettings>(DEFAULT_SETTINGS);
  // Phase 24 — refs for sync all to drive
  const documentsRef = useRef<CaseDocument[]>([]);
  const voiceNotesRef = useRef<VoiceNote[]>([]);
  // Phase 26 — refs for calendar sync (avoid stale closures in hearings functions)
  const clientsRef = useRef<Client[]>([]);
  const calSyncRef = useRef(false);
  const calIdRef = useRef<string | null>(null);
  const calEventIdsRef = useRef<Record<string, string>>({});

  useEffect(() => { authTokenRef.current = authToken; }, [authToken]);
  useEffect(() => { casesRef.current = cases; }, [cases]);
  useEffect(() => { hearingsRef.current = hearings; }, [hearings]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { documentsRef.current = documents; }, [documents]);
  useEffect(() => { voiceNotesRef.current = voiceNotes; }, [voiceNotes]);
  useEffect(() => { clientsRef.current = clients; }, [clients]);
  useEffect(() => { calSyncRef.current = calendarSyncEnabled; }, [calendarSyncEnabled]);
  useEffect(() => { calIdRef.current = deviceCalendarId; }, [deviceCalendarId]);
  useEffect(() => { calEventIdsRef.current = hearingCalendarEventIds; }, [hearingCalendarEventIds]);

  // ── Load from AsyncStorage on mount ──────────────────────────────
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [
          sCases, sClients, sHearings, sStatuses, sPartyTypes,
          sVoiceNotes, sDocuments, sCourtNames, sProfile, sSettings, sToken, sBackupAt,
          sCaseTypes,
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
          AsyncStorage.getItem(KEYS.customCaseTypes),
        ]);

        if (!mounted) return;

        const loadedCases: Case[] = sCases ? JSON.parse(sCases) : [];
        const loadedHearings: Hearing[] = sHearings ? JSON.parse(sHearings) : [];

        setCases(loadedCases);
        setClients(sClients ? JSON.parse(sClients) : []);
        setHearings(loadedHearings);
        setCustomStatuses(sStatuses ? JSON.parse(sStatuses) : []);
        setCustomCaseTypes(sCaseTypes ? JSON.parse(sCaseTypes) : []);
        setCustomPartyTypes(sPartyTypes ? JSON.parse(sPartyTypes) : []);
        setVoiceNotes(sVoiceNotes ? JSON.parse(sVoiceNotes) : []);
        setDocuments(sDocuments ? JSON.parse(sDocuments) : []);
        setSavedCourtNames(sCourtNames ? JSON.parse(sCourtNames) : DEFAULT_COURT_NAMES);
        setAdvocateProfile(sProfile ? { ...DEFAULT_PROFILE, ...JSON.parse(sProfile) } : DEFAULT_PROFILE);
        setSettings(sSettings ? { ...DEFAULT_SETTINGS, ...JSON.parse(sSettings) } : DEFAULT_SETTINGS);
        setNotifications(buildNotifications(loadedHearings, loadedCases));

        if (sToken) {
          setAuthToken(sToken);
          authTokenRef.current = sToken;
        }
        if (sBackupAt) setLastBackupAt(sBackupAt);

        // Phase 23 — Restore Drive connection state
        const dToken = await getStoredDriveToken();
        if (dToken) {
          const dEmail = await AsyncStorage.getItem(DRIVE_EMAIL_KEY);
          setIsDriveConnected(true);
          setDriveEmail(dEmail ?? 'Connected');
        }

        // Phase 26 — Restore calendar sync state
        const sCalSync = await AsyncStorage.getItem('@lawflow_cal_sync');
        const sCalId = await AsyncStorage.getItem('@lawflow_cal_id');
        const sCalEventIds = await AsyncStorage.getItem('@lawflow_cal_event_ids');
        if (sCalSync === 'true') setCalendarSyncEnabled(true);
        if (sCalId) setDeviceCalendarId(sCalId);
        if (sCalEventIds) setHearingCalendarEventIds(JSON.parse(sCalEventIds));

        // Phase 27 — Restore plan state
        const sPlan = await AsyncStorage.getItem('@lawflow_plan');
        const sPlanExpiry = await AsyncStorage.getItem('@lawflow_plan_expiry');
        const sPlanHistory = await AsyncStorage.getItem('@lawflow_plan_history');
        if (sPlan === 'pro') setUserPlan('pro');
        if (sPlanExpiry) setPlanExpiry(sPlanExpiry);
        if (sPlanHistory) setPlanHistory(JSON.parse(sPlanHistory));
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
        // Phase 27 — update plan from backend
        if (profile.plan) {
          const p = profile.plan as 'free' | 'pro';
          setUserPlan(p);
          AsyncStorage.setItem('@lawflow_plan', p).catch(() => {});
        }
        if (profile.planExpiry) {
          const exp = profile.planExpiry as string;
          setPlanExpiry(exp);
          AsyncStorage.setItem('@lawflow_plan_expiry', exp).catch(() => {});
        }
        if (Array.isArray(profile.planHistory)) {
          setPlanHistory(profile.planHistory);
          AsyncStorage.setItem('@lawflow_plan_history', JSON.stringify(profile.planHistory)).catch(() => {});
        }
        // Referral System
        if (profile.referralCode) {
          setReferralCode(profile.referralCode as string);
        }
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

      // Load firm context so isFirmOwner is available globally (e.g. case assign button)
      try {
        const firmResp = await getMyFirmApi(token);
        if (firmResp.success) setFirm(firmResp.data);
      } catch {
        // silent — firm not required
      }

      // Load inbox notifications (firm invites, etc.)
      try {
        const inboxResp = await getInboxNotificationsApi(token);
        if (inboxResp.success) setInboxNotifications(inboxResp.data ?? []);
      } catch {
        // silent
      }
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
    AsyncStorage.setItem(KEYS.customCaseTypes, JSON.stringify(customCaseTypes)).catch(() => {});
  }, [customCaseTypes, isLoading]);

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
    // ── Also update plan immediately from signIn to avoid brief "Get Pro" flash ──
    if (advocate.plan) {
      const p = advocate.plan as 'free' | 'pro';
      setUserPlan(p);
      AsyncStorage.setItem('@lawflow_plan', p).catch(() => {});
    }
    if (advocate.planExpiry) {
      const exp = advocate.planExpiry as string;
      setPlanExpiry(exp);
      AsyncStorage.setItem('@lawflow_plan_expiry', exp).catch(() => {});
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
    // ── When nextHearingDate changes, upsert "Next Hearing" in local state ──
    // Mirrors the backend upsert so the timeline is correct before the next sync.
    if (u.nextHearingDate) {
      setHearings(prev => {
        const idx = prev.findIndex(
          h => h.caseId === id && h.purpose === 'Next Hearing' && !h.outcome
        );
        if (idx >= 0) {
          // Update the existing "Next Hearing" to the new date
          const updated = [...prev];
          updated[idx] = { ...updated[idx], hearingDate: u.nextHearingDate! };
          return updated;
        }
        // No active "Next Hearing" found — backend will create one; local state
        // will be consistent after the next loadBackendData sync.
        return prev;
      });
    }
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
    // Phase 26 — Calendar sync (silent fire-and-forget, never blocks main flow)
    if (calSyncRef.current && calIdRef.current && n.hearingDate) {
      (async () => {
        try {
          const linkedCase = casesRef.current.find(c => c.id === n.caseId);
          const linkedClient = clientsRef.current.find(cl => cl.id === linkedCase?.clientId);
          const eventId = await syncHearingToCalendar({
            calendarId: calIdRef.current!,
            caseNumber: linkedCase?.caseNumber || '',
            clientName: linkedClient?.name || 'Client',
            courtName: linkedCase?.courtName || '',
            hearingDate: new Date(n.hearingDate).toISOString(),
            hearingPurpose: n.purpose,
          });
          setHearingCalendarEventIds(prev => {
            const next = { ...prev, [n.id]: eventId };
            AsyncStorage.setItem('@lawflow_cal_event_ids', JSON.stringify(next)).catch(() => {});
            return next;
          });
        } catch {}
      })();
    }
    return n;
  }, [doBackgroundSync]);

  const updateHearing = useCallback((id: string, u: Partial<Hearing>) => {
    setHearings(p => p.map(h => h.id === id ? { ...h, ...u } : h));
    doBackgroundSync(
      () => updateHearingApi(id, u),
      () => setHearings(p => p.map(x => x.id === id ? { ...x, syncPending: true } : x)),
    );
    // Phase 26 — Update calendar event if sync is on
    if (calSyncRef.current && calIdRef.current) {
      (async () => {
        try {
          const existing = hearingsRef.current.find(h => h.id === id);
          const merged = existing ? { ...existing, ...u } : null;
          if (!merged?.hearingDate) return;
          const linkedCase = casesRef.current.find(c => c.id === merged.caseId);
          const linkedClient = clientsRef.current.find(cl => cl.id === linkedCase?.clientId);
          const eventId = await syncHearingToCalendar({
            calendarId: calIdRef.current!,
            existingEventId: calEventIdsRef.current[id],
            caseNumber: linkedCase?.caseNumber || '',
            clientName: linkedClient?.name || 'Client',
            courtName: linkedCase?.courtName || '',
            hearingDate: new Date(merged.hearingDate).toISOString(),
            hearingPurpose: merged.purpose,
          });
          setHearingCalendarEventIds(prev => {
            const next = { ...prev, [id]: eventId };
            AsyncStorage.setItem('@lawflow_cal_event_ids', JSON.stringify(next)).catch(() => {});
            return next;
          });
        } catch {}
      })();
    }
  }, [doBackgroundSync]);

  const deleteHearing = useCallback((id: string) => {
    // Phase 26 — Delete calendar event before removing from state (silent)
    const eventId = calEventIdsRef.current[id];
    if (eventId) deleteCalendarEvent(eventId).catch(() => {});
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

  // ── Inbox Notifications (backend-stored, e.g. firm invites) ───────
  const [inboxNotifications, setInboxNotifications] = useState<InboxNotification[]>([]);

  const loadInboxNotifications = useCallback(async () => {
    const token = authTokenRef.current;
    if (!token) return;
    try {
      const resp = await getInboxNotificationsApi(token);
      if (resp.success) setInboxNotifications(resp.data ?? []);
    } catch {
      // silent
    }
  }, []);

  const markInboxNotificationRead = useCallback((id: string) => {
    setInboxNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    const token = authTokenRef.current;
    if (token) markInboxNotificationReadApi(id, token).catch(() => {});
  }, []);

  const inboxUnreadCount = inboxNotifications.filter(n => !n.read).length;

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

  // ── Custom case types ────────────────────────────────────────────
  const DEFAULT_CASE_TYPES = ['CIVIL', 'CRIMINAL', 'FAMILY', 'LABOUR', 'REVENUE', 'CONSUMER', 'WRIT', 'APPEAL', 'OTHER'];

  const addCustomCaseType = useCallback((caseType: string) => {
    const upper = caseType.toUpperCase();
    if (!customCaseTypes.includes(upper) && !DEFAULT_CASE_TYPES.includes(upper)) {
      setCustomCaseTypes(p => [...p, upper]);
    }
  }, [customCaseTypes]);

  const deleteCustomCaseType = useCallback((caseType: string) => {
    setCustomCaseTypes(p => p.filter(t => t !== caseType));
  }, []);

  const getAllCaseTypes = useCallback(() => [...DEFAULT_CASE_TYPES, ...customCaseTypes], [customCaseTypes]);

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
              if (parsed.customCaseTypes) setCustomCaseTypes(parsed.customCaseTypes);
              if (parsed.customPartyTypes) setCustomPartyTypes(parsed.customPartyTypes);
              if (parsed.courtNames) setSavedCourtNames(parsed.courtNames);
              if (parsed.advocateProfile) setAdvocateProfile(prev => ({ ...prev, ...parsed.advocateProfile }));

              // Persist to AsyncStorage
              await Promise.all([
                parsed.cases && AsyncStorage.setItem(KEYS.cases, JSON.stringify(parsed.cases)),
                parsed.clients && AsyncStorage.setItem(KEYS.clients, JSON.stringify(parsed.clients)),
                parsed.customStatuses && AsyncStorage.setItem(KEYS.customStatuses, JSON.stringify(parsed.customStatuses)),
                parsed.customCaseTypes && AsyncStorage.setItem(KEYS.customCaseTypes, JSON.stringify(parsed.customCaseTypes)),
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

  // ── Phase 23 — Google Drive File Storage ─────────────────────────
  const connectDrive = useCallback(async (): Promise<boolean> => {
    try {
      const result = await connectToDrive();
      if (!result) return false;
      setIsDriveConnected(true);
      setDriveEmail(result.email);
      return true;
    } catch {
      return false;
    }
  }, []);

  const disconnectDrive = useCallback(() => {
    clearDriveToken();
    setIsDriveConnected(false);
    setDriveEmail('');
  }, []);

  const updateDocumentDriveSync = useCallback((id: string, driveFileId: string, driveUrl: string) => {
    setDocuments(prev =>
      prev.map(d => d.id === id
        ? { ...d, googleDriveFileId: driveFileId, googleDriveUrl: driveUrl, uploadStatus: 'UPLOADED' as const, isSynced: true }
        : d
      )
    );
  }, []);

  const updateVoiceNoteDriveSync = useCallback((id: string, driveFileId: string, driveUrl: string) => {
    setVoiceNotes(prev =>
      prev.map(v => v.id === id
        ? { ...v, googleDriveFileId: driveFileId, googleDriveUrl: driveUrl, isSynced: true }
        : v
      )
    );
  }, []);

  // ── Phase 24 — Upload tracking + Sync All ────────────────────────
  const setDocUploading = useCallback((id: string) => {
    setDocUploadStatusState(prev => ({ ...prev, [id]: 'uploading' }));
  }, []);

  const clearDocUpload = useCallback((id: string) => {
    setDocUploadStatusState(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const setDocUploadFailed = useCallback((id: string) => {
    setDocUploadStatusState(prev => ({ ...prev, [id]: 'failed' }));
  }, []);

  const isDocUploading = useCallback((id: string) => docUploadStatus[id] === 'uploading', [docUploadStatus]);
  const isDocUploadFailed = useCallback((id: string) => docUploadStatus[id] === 'failed', [docUploadStatus]);

  const syncAllToDrive = useCallback(async (
    onProgress: (current: number, total: number) => void,
    onDone: (failedCount: number) => void,
  ) => {
    const token = await getStoredDriveToken();
    if (!token) { onDone(0); return; }

    const unsyncedDocs = documentsRef.current.filter(d => !d.isSynced && d.uri);
    const unsyncedNotes = voiceNotesRef.current.filter(v => !v.isSynced && v.uri);
    const total = unsyncedDocs.length + unsyncedNotes.length;
    if (total === 0) { onDone(0); return; }

    let current = 0;
    let failed = 0;

    for (const doc of unsyncedDocs) {
      current++;
      onProgress(current, total);
      try {
        setDocUploadStatusState(prev => ({ ...prev, [doc.id]: 'uploading' }));
        const theCase = casesRef.current.find(c => c.id === doc.caseId);
        const result = await syncDocumentToDrive(
          doc.uri!,
          doc.fileName,
          theCase?.caseNumber ?? doc.caseId,
          undefined,
          token,
        );
        setDocuments(prev =>
          prev.map(d => d.id === doc.id
            ? { ...d, googleDriveFileId: result.fileId, googleDriveUrl: result.fileUrl, uploadStatus: 'UPLOADED' as const, isSynced: true }
            : d)
        );
        setDocUploadStatusState(prev => { const n = { ...prev }; delete n[doc.id]; return n; });
      } catch {
        failed++;
        setDocUploadStatusState(prev => ({ ...prev, [doc.id]: 'failed' }));
      }
    }

    for (const note of unsyncedNotes) {
      current++;
      onProgress(current, total);
      try {
        const theCase = casesRef.current.find(c => c.id === note.caseId);
        const result = await syncVoiceNoteToDrive(
          note.uri,
          note.title,
          theCase?.caseNumber ?? note.caseId ?? 'General',
          undefined,
          token,
        );
        setVoiceNotes(prev =>
          prev.map(v => v.id === note.id
            ? { ...v, googleDriveFileId: result.fileId, googleDriveUrl: result.fileUrl, isSynced: true }
            : v)
        );
      } catch {
        failed++;
      }
    }

    onDone(failed);
  }, []);

  // ── Phase 26 — Calendar Sync ─────────────────────────────────────────
  const enableCalendarSync = useCallback(async (): Promise<boolean> => {
    const granted = await requestCalendarPermission();
    if (!granted) return false;
    const calId = await getOrCreateLawFlowCalendar();
    setCalendarSyncEnabled(true);
    setDeviceCalendarId(calId);
    await AsyncStorage.setItem('@lawflow_cal_sync', 'true');
    await AsyncStorage.setItem('@lawflow_cal_id', calId);
    return true;
  }, []);

  const disableCalendarSync = useCallback(() => {
    setCalendarSyncEnabled(false);
    AsyncStorage.setItem('@lawflow_cal_sync', 'false').catch(() => {});
  }, []);

  const setHearingCalendarEventId = useCallback((hearingId: string, eventId: string) => {
    setHearingCalendarEventIds(prev => {
      const next = { ...prev, [hearingId]: eventId };
      AsyncStorage.setItem('@lawflow_cal_event_ids', JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  // ── Phase 27 — Plan helpers ─────────────────────────────────────────
  // isProUser: plan === 'pro' AND expiry is null OR within grace period (3 days after expiry)
  const isProUser = userPlan === 'pro' && (
    !planExpiry || new Date(planExpiry) >= new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  );

  const refreshPlan = useCallback(async (): Promise<void> => {
    const token = authTokenRef.current;
    if (!token) return;
    try {
      const resp = await getMe(token);
      if (!resp.success) return;
      const profile = resp.data as Record<string, unknown>;
      if (profile.plan) {
        const p = profile.plan as 'free' | 'pro';
        setUserPlan(p);
        AsyncStorage.setItem('@lawflow_plan', p).catch(() => {});
      }
      if (profile.planExpiry) {
        const exp = profile.planExpiry as string;
        setPlanExpiry(exp);
        AsyncStorage.setItem('@lawflow_plan_expiry', exp).catch(() => {});
      }
      if (Array.isArray(profile.planHistory)) {
        setPlanHistory(profile.planHistory);
        AsyncStorage.setItem('@lawflow_plan_history', JSON.stringify(profile.planHistory)).catch(() => {});
      }
      // Referral System
      if (profile.referralCode) {
        setReferralCode(profile.referralCode as string);
      }
    } catch {
      // silent
    }
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
      <View style={{ flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  return (
    <AppContext.Provider value={{
      cases, clients, hearings, voiceNotes, documents, notifications,
      customStatuses, customCaseTypes, savedCourtNames, customPartyTypes,
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
      addCustomCaseType, deleteCustomCaseType, getAllCaseTypes,
      addCourtName, deleteCourtName,
      addCustomPartyType, deleteCustomPartyType,
      updateAdvocateProfile, updateSettings, clearAllData,
      getTodayHearings, getUpcomingHearings, getMissedHearings,
      getCasesForClient, getActiveStats, getHearingsForDate,
      getCasesWithNextDate, getCasesAwaitingNextDate,
      sendWhatsAppMessage, sendSMSMessage,
      retrySyncAll, lastBackupAt, backupToGoogleDrive, restoreFromGoogleDrive,
      firm, firmDashboard, isFirmOwner, isFirmMember, loadFirm, loadFirmDashboard,
      inboxNotifications, inboxUnreadCount, loadInboxNotifications, markInboxNotificationRead,
      isDriveConnected, driveEmail, connectDrive, disconnectDrive,
      updateDocumentDriveSync, updateVoiceNoteDriveSync,
      docUploadStatus, setDocUploading, clearDocUpload, setDocUploadFailed, isDocUploading, isDocUploadFailed, syncAllToDrive,
      calendarSyncEnabled, deviceCalendarId, hearingCalendarEventIds,
      enableCalendarSync, disableCalendarSync, setHearingCalendarEventId,
      userPlan, planExpiry, isProUser, planHistory, refreshPlan,
      referralCode,
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

// Alias for components that use useAppContext
export const useAppContext = useApp;
