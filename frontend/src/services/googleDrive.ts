// Google OAuth Setup:
// 1. console.cloud.google.com > Create project "LawFlow"
// 2. Enable Google Drive API
// 3. OAuth consent screen > External > App name: LawFlow
// 4. Credentials > OAuth Client ID > Android, Package: com.lawflow
// 5. Credentials > OAuth Client ID > iOS, Bundle ID: com.lawflow
// 6. Copy Web Client ID to EXPO_PUBLIC_GOOGLE_CLIENT_ID env var

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const DRIVE_SEARCH_URL = (name: string) =>
  `https://www.googleapis.com/drive/v3/files?q=name%3D'${encodeURIComponent(name)}'%20and%20trashed%3Dfalse&fields=files(id,name)`;
const DRIVE_UPLOAD_URL = `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
const DRIVE_PATCH_URL = (id: string) =>
  `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=multipart`;
const DRIVE_DOWNLOAD_URL = (id: string) =>
  `https://www.googleapis.com/drive/v3/files/${id}?alt=media`;

const BACKUP_FILENAME = 'LawFlow_Backup.json';
const BOUNDARY = 'lawflow_multipart_boundary_7x2k9';

// ── Sign In ────────────────────────────────────────────────────────────────
export async function signInWithGoogle(): Promise<string | null> {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    console.warn('EXPO_PUBLIC_GOOGLE_CLIENT_ID not set — Google Drive unavailable');
    return null;
  }

  try {
    const discovery = await AuthSession.fetchDiscoveryAsync('https://accounts.google.com');
    const redirectUri = AuthSession.makeRedirectUri({ scheme: 'com.lawflow' });

    const authRequest = new AuthSession.AuthRequest({
      clientId,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
      redirectUri,
      responseType: AuthSession.ResponseType.Token,
    });

    const result = await authRequest.promptAsync(discovery);

    if (result.type === 'success' && result.params?.access_token) {
      return result.params.access_token as string;
    }
    // User cancelled or error — return null silently
    return null;
  } catch {
    return null;
  }
}

// ── Search for existing backup ─────────────────────────────────────────────
async function findBackupFile(accessToken: string): Promise<string | null> {
  const res = await fetch(DRIVE_SEARCH_URL(BACKUP_FILENAME), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  return (data.files?.[0]?.id as string) ?? null;
}

// ── Build multipart body ───────────────────────────────────────────────────
function buildMultipartBody(jsonData: string): string {
  const metadata = JSON.stringify({ name: BACKUP_FILENAME, mimeType: 'application/json' });
  return (
    `--${BOUNDARY}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${metadata}\r\n` +
    `--${BOUNDARY}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${jsonData}\r\n` +
    `--${BOUNDARY}--`
  );
}

// ── Upload (create or overwrite) ───────────────────────────────────────────
export async function uploadBackupToDrive(accessToken: string, data: string): Promise<void> {
  const existingId = await findBackupFile(accessToken);

  const url = existingId ? DRIVE_PATCH_URL(existingId) : DRIVE_UPLOAD_URL;
  const method = existingId ? 'PATCH' : 'POST';
  const body = buildMultipartBody(data);

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary="${BOUNDARY}"`,
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive upload failed: ${err}`);
  }
}

// ── Download ───────────────────────────────────────────────────────────────
export async function downloadBackupFromDrive(accessToken: string): Promise<string | null> {
  const fileId = await findBackupFile(accessToken);
  if (!fileId) return null;

  const res = await fetch(DRIVE_DOWNLOAD_URL(fileId), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) return null;
  return res.text();
}
