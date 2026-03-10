/**
 * Phase 23 — Google Drive File Storage
 * Handles folder creation, file upload, token persistence.
 * Uses drive.file scope (only files created by this app).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { signInWithGoogle } from './googleDrive';

// ── AsyncStorage keys ─────────────────────────────────────────────────────
export const DRIVE_TOKEN_KEY = 'driveAuthToken';
export const DRIVE_EMAIL_KEY = 'driveEmail';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
const BOUNDARY = 'lawflow_file_boundary_z8k2';

// ── Token helpers ──────────────────────────────────────────────────────────
export async function getStoredDriveToken(): Promise<string | null> {
  return AsyncStorage.getItem(DRIVE_TOKEN_KEY);
}

export async function saveDriveToken(token: string, email: string): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(DRIVE_TOKEN_KEY, token),
    AsyncStorage.setItem(DRIVE_EMAIL_KEY, email),
  ]);
}

export async function clearDriveToken(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(DRIVE_TOKEN_KEY),
    AsyncStorage.removeItem(DRIVE_EMAIL_KEY),
  ]);
}

// ── Get user email from Google ─────────────────────────────────────────────
export async function getDriveUserEmail(token: string): Promise<string> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return data.email ?? 'Connected';
  } catch {
    return 'Connected';
  }
}

// ── Connect to Drive (OAuth + persist) ────────────────────────────────────
export async function connectToDrive(): Promise<{ token: string; email: string } | null> {
  const token = await signInWithGoogle();
  if (!token) return null;
  const email = await getDriveUserEmail(token);
  await saveDriveToken(token, email);
  return { token, email };
}

// ── Folder helpers ─────────────────────────────────────────────────────────
async function searchFolder(name: string, parentId: string | null, token: string): Promise<string | null> {
  const parts = [
    `name='${name.replace(/'/g, "\\'")}'`,
    `mimeType='${FOLDER_MIME}'`,
    'trashed=false',
  ];
  if (parentId) parts.push(`'${parentId}' in parents`);
  const q = encodeURIComponent(parts.join(' and '));
  const res = await fetch(`${DRIVE_FILES_URL}?q=${q}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return (data.files?.[0]?.id as string) ?? null;
}

async function createFolder(name: string, parentId: string | null, token: string): Promise<string> {
  const meta: Record<string, unknown> = { name, mimeType: FOLDER_MIME };
  if (parentId) meta.parents = [parentId];
  const res = await fetch(DRIVE_FILES_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(meta),
  });
  const data = await res.json();
  if (!data.id) throw new Error(`Create folder failed: ${JSON.stringify(data)}`);
  return data.id as string;
}

export async function getOrCreateFolder(name: string, parentId: string | null, token: string): Promise<string> {
  const existing = await searchFolder(name, parentId, token);
  if (existing) return existing;
  return createFolder(name, parentId, token);
}

// ── Folder structure: LawFlow/[CaseName]/[Documents|VoiceNotes]/ ───────────
export function buildCaseFolderName(caseNumber: string, clientName?: string): string {
  const clean = (s: string) => s.replace(/[/\\?%*:|"<>]/g, '-').trim();
  if (clientName) return `${clean(caseNumber)} — ${clean(clientName)}`;
  return clean(caseNumber);
}

export async function ensureLawFlowFolder(
  caseNumber: string,
  clientName: string | undefined,
  subfolder: 'Documents' | 'VoiceNotes',
  token: string,
): Promise<string> {
  const rootId = await getOrCreateFolder('LawFlow', null, token);
  const caseFolderName = buildCaseFolderName(caseNumber, clientName);
  const caseId = await getOrCreateFolder(caseFolderName, rootId, token);
  const subId = await getOrCreateFolder(subfolder, caseId, token);
  return subId;
}

// ── File upload ────────────────────────────────────────────────────────────
export interface DriveUploadResult {
  fileId: string;
  fileUrl: string;
}

export async function uploadFileToDrive(
  fileUri: string,
  fileName: string,
  mimeType: string,
  folderId: string,
  token: string,
): Promise<DriveUploadResult> {
  // Read file as base64
  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const metadata = JSON.stringify({ name: fileName, parents: [folderId] });

  const body =
    `--${BOUNDARY}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${metadata}\r\n` +
    `--${BOUNDARY}\r\n` +
    `Content-Type: ${mimeType}\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    `${base64}\r\n` +
    `--${BOUNDARY}--`;

  const res = await fetch(DRIVE_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary="${BOUNDARY}"`,
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive upload failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return {
    fileId: data.id as string,
    fileUrl: `https://drive.google.com/file/d/${data.id}/view`,
  };
}

// ── MIME type helper ───────────────────────────────────────────────────────
export function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    m4a: 'audio/mp4',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    aac: 'audio/aac',
    caf: 'audio/x-caf',
  };
  return map[ext] ?? 'application/octet-stream';
}

// ── Sync a document file to Drive ─────────────────────────────────────────
export async function syncDocumentToDrive(
  fileUri: string,
  fileName: string,
  caseNumber: string,
  clientName: string | undefined,
  token: string,
): Promise<DriveUploadResult> {
  const folderId = await ensureLawFlowFolder(caseNumber, clientName, 'Documents', token);
  const mimeType = getMimeType(fileName);
  return uploadFileToDrive(fileUri, fileName, mimeType, folderId, token);
}

// ── Sync a voice note to Drive ─────────────────────────────────────────────
export async function syncVoiceNoteToDrive(
  fileUri: string,
  fileName: string,
  caseNumber: string,
  clientName: string | undefined,
  token: string,
): Promise<DriveUploadResult> {
  const folderId = await ensureLawFlowFolder(caseNumber, clientName, 'VoiceNotes', token);
  return uploadFileToDrive(fileUri, fileName, getMimeType(fileName), folderId, token);
}
