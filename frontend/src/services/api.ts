import AsyncStorage from '@react-native-async-storage/async-storage';
import { Case, Client, Hearing } from '../types';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000';
const API_URL = `${BASE_URL}/api`;
const TOKEN_KEY = 'lawflow_auth_token';

// ── Error types ─────────────────────────────────────────────────────────
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export class NetworkError extends Error {
  constructor(message: string = 'Network request failed') {
    super(message);
    this.name = 'NetworkError';
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────
async function getStoredToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function storeToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const resolvedToken = token ?? (await getStoredToken());
  if (resolvedToken) {
    headers['Authorization'] = `Bearer ${resolvedToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (err: any) {
    throw new NetworkError(err?.message || 'Network request failed');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new ApiError(err.detail || `HTTP ${res.status}`, res.status);
  }

  return res.json();
}

// ── AUTH ─────────────────────────────────────────────────────────────────
export async function requestOtp(phone: string) {
  return request<{ success: boolean; message: string; dev_otp?: string }>(
    '/auth/request-otp',
    { method: 'POST', body: JSON.stringify({ phone }) }
  );
}

export async function verifyOtp(phone: string, otp: string) {
  const result = await request<{
    success: boolean;
    token: string;
    advocate: Record<string, unknown>;
    isNewUser: boolean;
  }>('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ phone, otp }) });
  if (result.token) await storeToken(result.token);
  return result;
}

export async function getMe(token?: string) {
  return request<{ success: boolean; data: Record<string, unknown> }>('/auth/me', {}, token);
}

export async function updateMe(data: Record<string, unknown>, token?: string) {
  return request<{ success: boolean; data: Record<string, unknown> }>(
    '/auth/me',
    { method: 'PUT', body: JSON.stringify(data) },
    token
  );
}

// ── CASES ────────────────────────────────────────────────────────────────
export async function getCases(token?: string) {
  return request<{ success: boolean; data: Partial<Case>[] }>('/cases', {}, token);
}

export async function createCase(data: Partial<Case>, token?: string) {
  return request<{ success: boolean; data: Partial<Case> }>(
    '/cases',
    { method: 'POST', body: JSON.stringify(data) },
    token
  );
}

export async function updateCase(id: string, data: Partial<Case>, token?: string) {
  return request<{ success: boolean; data: Partial<Case> }>(
    `/cases/${id}`,
    { method: 'PUT', body: JSON.stringify(data) },
    token
  );
}

export async function deleteCase(id: string, token?: string) {
  return request<{ success: boolean; message: string }>(
    `/cases/${id}`,
    { method: 'DELETE' },
    token
  );
}

// ── CLIENTS ───────────────────────────────────────────────────────────────
export async function getClients(token?: string) {
  return request<{ success: boolean; data: Partial<Client>[] }>('/clients', {}, token);
}

export async function createClient(data: Partial<Client>, token?: string) {
  return request<{ success: boolean; data: Partial<Client> }>(
    '/clients',
    { method: 'POST', body: JSON.stringify(data) },
    token
  );
}

export async function updateClient(id: string, data: Partial<Client>, token?: string) {
  return request<{ success: boolean; data: Partial<Client> }>(
    `/clients/${id}`,
    { method: 'PUT', body: JSON.stringify(data) },
    token
  );
}

export async function deleteClient(id: string, token?: string) {
  return request<{ success: boolean; message: string }>(
    `/clients/${id}`,
    { method: 'DELETE' },
    token
  );
}

// ── HEARINGS ──────────────────────────────────────────────────────────────
export async function getHearings(token?: string) {
  return request<{ success: boolean; data: Partial<Hearing>[] }>('/hearings', {}, token);
}

export async function createHearing(data: Partial<Hearing>, token?: string) {
  return request<{ success: boolean; data: Partial<Hearing> }>(
    '/hearings',
    { method: 'POST', body: JSON.stringify(data) },
    token
  );
}

export async function updateHearing(id: string, data: Partial<Hearing>, token?: string) {
  return request<{ success: boolean; data: Partial<Hearing> }>(
    `/hearings/${id}`,
    { method: 'PUT', body: JSON.stringify(data) },
    token
  );
}

export async function deleteHearing(id: string, token?: string) {
  return request<{ success: boolean; message: string }>(
    `/hearings/${id}`,
    { method: 'DELETE' },
    token
  );
}

// ── ECOURTS ──────────────────────────────────────────────────────────────

export interface EcourtsLookupPayload {
  cnr_number?: string;
  case_number?: string;
  year?: number;
  state_code?: string;
  court_code?: string;
  court_type?: 'district' | 'high_court';
  high_court_code?: string;
}

export interface EcourtsResult {
  found: boolean;
  source: string;
  error?: string;
  cnrNumber?: string;
  caseNumber?: string;
  caseType?: string;
  filingDate?: string;
  registrationDate?: string;
  nextHearingDate?: string;
  nextHearingDateTimestamp?: number;
  courtName?: string;
  judgeName?: string;
  caseStatus?: string;
  petitioner?: string;
  respondent?: string;
  remarks?: string;
  fetchedFields: string[];
}

export async function ecourtsLookup(payload: EcourtsLookupPayload, token?: string) {
  return request<{ success: boolean; data: EcourtsResult }>(
    '/ecourts/lookup',
    { method: 'POST', body: JSON.stringify(payload) },
    token
  );
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────

export async function registerPushToken(token: string, platform?: string) {
  return request<{ success: boolean; message: string }>(
    '/notifications/push-token',
    { method: 'POST', body: JSON.stringify({ token, platform }) }
  );
}

export async function getDigestPreview() {
  return request<{ success: boolean; data: Record<string, unknown> }>(
    '/notifications/digest/preview',
    {}
  );
}

export async function sendDigestNow() {
  return request<{ success: boolean; result: Record<string, unknown> }>(
    '/notifications/digest/send',
    { method: 'POST' }
  );
}

// ── FIRMS ────────────────────────────────────────────────────────────────

export async function createFirm(name: string, token?: string) {
  return request<{ success: boolean; data: Record<string, unknown> }>(
    '/firms',
    { method: 'POST', body: JSON.stringify({ name }) },
    token
  );
}

export async function getMyFirm(token?: string) {
  return request<{ success: boolean; data: Record<string, unknown> | null }>(
    '/firms/my',
    {},
    token
  );
}

export async function inviteToFirm(phone: string, token?: string) {
  return request<{ success: boolean; data: Record<string, unknown> }>(
    '/firms/invite',
    { method: 'POST', body: JSON.stringify({ phone }) },
    token
  );
}

export async function acceptFirmInvite(firmId: string, token?: string) {
  return request<{ success: boolean; data: Record<string, unknown> }>(
    '/firms/accept',
    { method: 'POST', body: JSON.stringify({ firmId }) },
    token
  );
}

export async function removeFirmMember(memberId: string, token?: string) {
  return request<{ success: boolean; message: string }>(
    `/firms/members/${memberId}`,
    { method: 'DELETE' },
    token
  );
}

export async function getFirmDashboard(token?: string) {
  return request<{ success: boolean; data: Record<string, unknown> }>(
    '/firms/dashboard',
    {},
    token
  );
}

export async function getPendingFirmInvite(token?: string) {
  return request<{ success: boolean; data: Record<string, unknown> | null }>(
    '/firms/pending-invite',
    {},
    token
  );
}

export async function checkFirmUser(phone: string, token?: string) {
  return request<{ success: boolean; data: { exists: boolean; alreadyInFirm: boolean; advocateName: string } }>(
    '/firms/check-user',
    { method: 'POST', body: JSON.stringify({ phone }) },
    token
  );
}

export async function getInboxNotifications(token?: string) {
  return request<{ success: boolean; data: any[] }>(
    '/notifications/inbox',
    {},
    token
  );
}

export async function markInboxNotificationRead(notifId: string, token?: string) {
  return request<{ success: boolean }>(
    `/notifications/inbox/${notifId}/read`,
    { method: 'PATCH' },
    token
  );
}

export async function assignCase(caseId: string, assignedTo: string, token?: string) {
  return request<{ success: boolean; data: Record<string, unknown> }>(
    `/cases/${caseId}/assign`,
    { method: 'PUT', body: JSON.stringify({ assignedTo }) },
    token
  );
}

// ── CLIENT PORTAL ────────────────────────────────────────────────────────

export interface PortalGeneratePayload {
  clientId: string;
  caseIds: string[];
  notes?: string;
  expiresInDays?: number;
}

export async function generatePortalLink(payload: PortalGeneratePayload, token?: string) {
  return request<{ success: boolean; data: Record<string, unknown> }>(
    '/portal/generate',
    { method: 'POST', body: JSON.stringify(payload) },
    token
  );
}

export async function getPortalLinks(token?: string) {
  return request<{ success: boolean; data: Record<string, unknown>[] }>(
    '/portal/links',
    {},
    token
  );
}

export async function getPortalData(portalToken: string) {
  return request<{ success: boolean; data: Record<string, unknown> }>(
    `/portal/${portalToken}`,
    {},
    null
  );
}

export async function revokePortalLink(portalToken: string, token?: string) {
  return request<{ success: boolean; message: string }>(
    `/portal/${portalToken}`,
    { method: 'DELETE' },
    token
  );
}
