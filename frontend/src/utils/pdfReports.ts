import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Platform, Alert, Share } from 'react-native';
import { Case, Client, Hearing } from '../types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(ts?: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.getDate().toString().padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtTime(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function fullDateTime(): string {
  const now = new Date();
  return `${fmtDate(now.getTime())} at ${fmtTime(now.getTime())}`;
}

// ── Shared base CSS ──────────────────────────────────────────────────
const baseCSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 12px; color: #000; background: #fff; padding: 40px;
  }
  .page-header { border-bottom: 2px solid #000; padding-bottom: 14px; margin-bottom: 28px; }
  .page-title { font-size: 18px; font-weight: 700; letter-spacing: -0.3px; }
  .page-meta { font-size: 11px; color: #555; margin-top: 4px; }
  .section { margin-bottom: 28px; }
  .section-title {
    font-size: 10px; font-weight: 700; letter-spacing: 1.2px;
    text-transform: uppercase; color: #555;
    border-bottom: 1px solid #ddd; padding-bottom: 6px; margin-bottom: 12px;
  }
  table { width: 100%; border-collapse: collapse; }
  th {
    font-size: 10px; font-weight: 700; text-align: left;
    padding: 7px 10px; background: #F5F5F5;
    text-transform: uppercase; letter-spacing: 0.5px; color: #333;
    border-bottom: 2px solid #ddd;
  }
  td { font-size: 12px; padding: 9px 10px; border-bottom: 1px solid #eee; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .empty { padding: 16px 0; color: #999; font-style: italic; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .info-block { }
  .info-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #555; margin-bottom: 3px; }
  .info-value { font-size: 13px; font-weight: 500; }
  .stats-row { display: flex; gap: 20px; }
  .stat { flex: 1; text-align: center; padding: 16px; background: #F5F5F5; border-radius: 6px; }
  .stat-number { font-size: 26px; font-weight: 700; }
  .stat-label { font-size: 10px; color: #555; margin-top: 3px; text-transform: uppercase; letter-spacing: 0.5px; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 10px; color: #888; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; letter-spacing: 0.3px; background: #000; color: #fff; }
  .notes-box { background: #F9F9F9; border-left: 3px solid #000; padding: 12px 14px; font-size: 12px; line-height: 1.6; color: #333; }
`;

// ── Dashboard Report ─────────────────────────────────────────────────
interface DashboardReportData {
  advocateName: string;
  todayHearings: Array<{ case: Case; hearing: Hearing }>;
  upcomingHearings: Array<{ case: Case; hearing: Hearing }>;
  totalCases: number;
  activeCases: number;
  totalClients: number;
}

function buildDashboardHTML(data: DashboardReportData): string {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Today's hearings table
  let todayTable = '';
  if (data.todayHearings.length === 0) {
    todayTable = '<p class="empty">No hearings scheduled for today.</p>';
  } else {
    todayTable = `
      <table>
        <thead>
          <tr>
            <th>Case No.</th>
            <th>Court</th>
            <th>Time</th>
            <th>Parties</th>
            <th>Purpose / Stage</th>
          </tr>
        </thead>
        <tbody>
          ${data.todayHearings.map(({ case: c, hearing: h }) => `
            <tr>
              <td>${c.caseNumber}</td>
              <td>${c.courtName}</td>
              <td>${h.hearingTime ?? '—'}</td>
              <td>${c.plaintiffPetitioner ?? c.clientName ?? '—'} vs ${c.defendant ?? '—'}</td>
              <td>${h.purpose ?? '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  }

  // Upcoming hearings table
  let upcomingTable = '';
  if (data.upcomingHearings.length === 0) {
    upcomingTable = '<p class="empty">No upcoming hearings in the next 7 days.</p>';
  } else {
    upcomingTable = `
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Case No.</th>
            <th>Court</th>
            <th>Parties</th>
          </tr>
        </thead>
        <tbody>
          ${data.upcomingHearings.map(({ case: c, hearing: h }) => `
            <tr>
              <td>${fmtDate(h.hearingDate)}</td>
              <td>${c.caseNumber}</td>
              <td>${c.courtName}</td>
              <td>${c.plaintiffPetitioner ?? c.clientName ?? '—'} vs ${c.defendant ?? '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${baseCSS}</style></head>
<body>
  <div class="page-header">
    <div class="page-title">LawFlow — Daily Cause List</div>
    <div class="page-meta">${data.advocateName} &nbsp;·&nbsp; ${dateStr}</div>
  </div>

  <div class="section">
    <div class="section-title">Today's Hearings (${data.todayHearings.length})</div>
    ${todayTable}
  </div>

  <div class="section">
    <div class="section-title">Upcoming — Next 7 Days (${data.upcomingHearings.length})</div>
    ${upcomingTable}
  </div>

  <div class="section">
    <div class="section-title">Practice Statistics</div>
    <div class="stats-row">
      <div class="stat">
        <div class="stat-number">${data.totalCases}</div>
        <div class="stat-label">Total Cases</div>
      </div>
      <div class="stat">
        <div class="stat-number">${data.activeCases}</div>
        <div class="stat-label">Active Cases</div>
      </div>
      <div class="stat">
        <div class="stat-number">${data.totalClients}</div>
        <div class="stat-label">Total Clients</div>
      </div>
    </div>
  </div>

  <div class="footer">Generated by LawFlow on ${fullDateTime()}</div>
</body>
</html>`;
}

// ── Case Detail Report ───────────────────────────────────────────────
interface CaseReportData {
  case: Case;
  client: Client | null;
  hearings: Hearing[];
}

function buildCaseHTML(data: CaseReportData): string {
  const c = data.case;
  const client = data.client;
  const hearings = [...data.hearings].sort((a, b) => b.hearingDate - a.hearingDate);

  const hearingRows = hearings.length === 0
    ? '<p class="empty">No hearings recorded.</p>'
    : `<table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Time</th>
            <th>Purpose / Stage</th>
            <th>Outcome</th>
          </tr>
        </thead>
        <tbody>
          ${hearings.map(h => `
            <tr>
              <td>${fmtDate(h.hearingDate)}</td>
              <td>${h.hearingTime ?? '—'}</td>
              <td>${h.purpose ?? '—'}</td>
              <td>${h.outcome ?? 'Pending'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${baseCSS}</style></head>
<body>
  <div class="page-header">
    <div class="page-title">LawFlow — Case Report</div>
    <div class="page-meta">Generated: ${fullDateTime()}</div>
  </div>

  <div class="section">
    <div class="section-title">Case Information</div>
    <div class="info-grid">
      <div class="info-block">
        <div class="info-label">Case Number</div>
        <div class="info-value">${c.caseNumber}</div>
      </div>
      <div class="info-block">
        <div class="info-label">Status</div>
        <div class="info-value"><span class="badge">${c.status}</span></div>
      </div>
      <div class="info-block">
        <div class="info-label">Court</div>
        <div class="info-value">${c.courtName}${c.courtCity ? ', ' + c.courtCity : ''}</div>
      </div>
      <div class="info-block">
        <div class="info-label">Case Type</div>
        <div class="info-value">${c.caseType}</div>
      </div>
      <div class="info-block">
        <div class="info-label">Registration Date</div>
        <div class="info-value">${fmtDate(c.registrationDate ?? c.filingDate)}</div>
      </div>
      <div class="info-block">
        <div class="info-label">Next Hearing Date</div>
        <div class="info-value">${c.nextHearingDate ? fmtDate(c.nextHearingDate) : 'Awaiting'}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Parties</div>
    <div class="info-grid">
      <div class="info-block">
        <div class="info-label">Petitioner / Plaintiff</div>
        <div class="info-value">${c.plaintiffPetitioner ?? '—'}</div>
        ${c.plaintiffType ? `<div class="page-meta" style="margin-top:3px">${c.plaintiffType}</div>` : ''}
      </div>
      <div class="info-block">
        <div class="info-label">Defendant / Respondent</div>
        <div class="info-value">${c.defendant ?? '—'}</div>
        ${c.defendantType ? `<div class="page-meta" style="margin-top:3px">${c.defendantType}</div>` : ''}
      </div>
    </div>
  </div>

  ${client ? `
  <div class="section">
    <div class="section-title">Client</div>
    <div class="info-grid">
      <div class="info-block">
        <div class="info-label">Name</div>
        <div class="info-value">${client.name}</div>
      </div>
      <div class="info-block">
        <div class="info-label">Type</div>
        <div class="info-value">${client.clientType}</div>
      </div>
      <div class="info-block">
        <div class="info-label">Phone</div>
        <div class="info-value">${client.phone}</div>
      </div>
      ${client.email ? `
      <div class="info-block">
        <div class="info-label">Email</div>
        <div class="info-value">${client.email}</div>
      </div>` : ''}
    </div>
  </div>` : ''}

  <div class="section">
    <div class="section-title">Hearing History (${hearings.length})</div>
    ${hearingRows}
  </div>

  ${c.notes ? `
  <div class="section">
    <div class="section-title">Notes & Remarks</div>
    <div class="notes-box">${c.notes.replace(/\n/g, '<br>')}</div>
  </div>` : ''}

  <div class="footer">Generated by LawFlow on ${fullDateTime()} &nbsp;·&nbsp; Case: ${c.caseNumber}</div>
</body>
</html>`;
}

// ── Public print functions ───────────────────────────────────────────

export async function printDashboardReport(data: DashboardReportData): Promise<void> {
  const html = buildDashboardHTML(data);
  try {
    if (Platform.OS === 'web') {
      Alert.alert('Print', 'Printing is not supported in the browser. Please use the app.');
      return;
    }
    await Print.printAsync({ html });
  } catch (err) {
    Alert.alert('Print Error', 'Unable to generate PDF. Please try again.');
  }
}

export async function printCaseReport(data: CaseReportData): Promise<void> {
  const html = buildCaseHTML(data);
  try {
    if (Platform.OS === 'web') {
      Alert.alert('Print', 'Printing is not supported in the browser. Please use the app.');
      return;
    }
    await Print.printAsync({ html });
  } catch (err) {
    Alert.alert('Print Error', 'Unable to generate PDF. Please try again.');
  }
}


// ── Full Data Export (PDF) ───────────────────────────────────────────
interface FullDataExportInput {
  advocateName: string;
  cases: Case[];
  clients: Client[];
  hearings: Hearing[];
}

function buildFullDataHTML(data: FullDataExportInput): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Case rows
  const caseRows = data.cases.length === 0
    ? '<tr><td colspan="6" class="empty">No cases recorded.</td></tr>'
    : data.cases.map(c => {
        const client = data.clients.find(cl => cl.id === c.clientId);
        return `<tr>
          <td>${c.caseNumber}</td>
          <td>${c.title}</td>
          <td>${c.courtName}</td>
          <td><span class="badge">${c.status}</span></td>
          <td>${c.caseType}</td>
          <td>${client?.name || c.clientName || '—'}</td>
        </tr>`;
      }).join('');

  // Client rows
  const clientRows = data.clients.length === 0
    ? '<tr><td colspan="5" class="empty">No clients recorded.</td></tr>'
    : data.clients.map(cl => `<tr>
        <td>${cl.name}</td>
        <td>${cl.phone}</td>
        <td>${cl.clientType}</td>
        <td>${cl.city || '—'}</td>
        <td>${data.cases.filter(c => c.clientId === cl.id).length}</td>
      </tr>`).join('');

  // Hearing rows (last 30)
  const sortedHearings = [...data.hearings].sort((a, b) => b.hearingDate - a.hearingDate).slice(0, 50);
  const hearingRows = sortedHearings.length === 0
    ? '<tr><td colspan="5" class="empty">No hearings recorded.</td></tr>'
    : sortedHearings.map(h => {
        const c = data.cases.find(x => x.id === h.caseId);
        return `<tr>
          <td>${fmtDate(h.hearingDate)}</td>
          <td>${c?.caseNumber || '—'}</td>
          <td>${c?.courtName || '—'}</td>
          <td>${h.purpose || '—'}</td>
          <td>${h.outcome || 'Pending'}</td>
        </tr>`;
      }).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${baseCSS}
  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
</style></head>
<body>
  <div class="page-header">
    <div class="page-title">LawFlow — Full Data Export</div>
    <div class="page-meta">${data.advocateName} &nbsp;·&nbsp; ${dateStr}</div>
  </div>

  <div class="section">
    <div class="section-title">Summary</div>
    <div class="summary-grid">
      <div class="stat"><div class="stat-number">${data.cases.length}</div><div class="stat-label">Total Cases</div></div>
      <div class="stat"><div class="stat-number">${data.cases.filter(c => c.status === 'ACTIVE').length}</div><div class="stat-label">Active Cases</div></div>
      <div class="stat"><div class="stat-number">${data.clients.length}</div><div class="stat-label">Total Clients</div></div>
      <div class="stat"><div class="stat-number">${data.hearings.length}</div><div class="stat-label">Total Hearings</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">All Cases (${data.cases.length})</div>
    <table>
      <thead><tr><th>Case No.</th><th>Title</th><th>Court</th><th>Status</th><th>Type</th><th>Client</th></tr></thead>
      <tbody>${caseRows}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">All Clients (${data.clients.length})</div>
    <table>
      <thead><tr><th>Name</th><th>Phone</th><th>Type</th><th>City</th><th>Cases</th></tr></thead>
      <tbody>${clientRows}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Recent Hearings (last ${sortedHearings.length})</div>
    <table>
      <thead><tr><th>Date</th><th>Case No.</th><th>Court</th><th>Purpose</th><th>Outcome</th></tr></thead>
      <tbody>${hearingRows}</tbody>
    </table>
  </div>

  <div class="footer">Generated by LawFlow on ${fullDateTime()}</div>
</body>
</html>`;
}

export async function exportFullData(data: FullDataExportInput): Promise<void> {
  const html = buildFullDataHTML(data);
  const fileName = `LawFlow_FullExport_${fmtDateForFilename(Date.now())}`;
  try {
    if (Platform.OS === 'web') {
      await Print.printAsync({ html });
    } else {
      const { uri } = await Print.printToFileAsync({ html });
      const dir = uri.substring(0, uri.lastIndexOf('/') + 1);
      const namedUri = `${dir}${fileName}.pdf`;
      await FileSystem.moveAsync({ from: uri, to: namedUri });
      await Sharing.shareAsync(namedUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'LawFlow — Full Data Export',
        UTI: 'com.adobe.pdf',
      });
    }
  } catch (err) {
    Alert.alert('Export Error', 'Unable to generate PDF. Please try again.');
  }
}

// ── CSV Export ───────────────────────────────────────────────────────
export async function exportCasesCSV(data: {
  cases: Case[];
  clients: Client[];
}): Promise<void> {
  const headers = ['Case Number', 'Title', 'Court', 'City', 'Status', 'Type', 'Priority', 'Client', 'Next Hearing', 'Filing Date'];
  const rows = data.cases.map(c => {
    const client = data.clients.find(cl => cl.id === c.clientId);
    return [
      c.caseNumber,
      `"${(c.title || '').replace(/"/g, '""')}"`,
      `"${(c.courtName || '').replace(/"/g, '""')}"`,
      c.courtCity || '',
      c.status,
      c.caseType,
      c.priority,
      `"${(client?.name || c.clientName || '').replace(/"/g, '""')}"`,
      c.nextHearingDate ? fmtDate(c.nextHearingDate) : '',
      c.filingDate ? fmtDate(c.filingDate) : '',
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const filename = `lawflow_cases_${new Date().toISOString().slice(0, 10)}.csv`;

  try {
    if (Platform.OS === 'web') {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      await Share.share({
        message: csvContent,
        title: 'LawFlow — Cases Export',
      });
    }
  } catch (err) {
    Alert.alert('Export Error', 'Unable to export CSV. Please try again.');
  }
}


// ═══════════════════════════════════════════════════════════════════════
// Phase 18B — Professional PDF Reports with Letterhead
// ═══════════════════════════════════════════════════════════════════════

function fmtPhone(phone?: string): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return phone;
}

function fmtDatePrint(ts?: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.getDate().toString().padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtTimePrint(ts?: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function fullDateTimePrint(): string {
  const now = new Date();
  return `${fmtDatePrint(now.getTime())} at ${fmtTimePrint(now.getTime())}`;
}

interface LetterheadData {
  advocateName: string;
  barCouncil?: string;
  enrollmentNumber?: string;
  phone?: string;
  email?: string;
}

function buildLetterhead(data: LetterheadData): string {
  const contactParts: string[] = [];
  if (data.enrollmentNumber) contactParts.push(`Bar ID: ${data.enrollmentNumber}`);
  if (data.phone) contactParts.push(fmtPhone(data.phone));
  if (data.email) contactParts.push(data.email);
  const contactLine = contactParts.join(' &nbsp;|&nbsp; ');
  const barLine = data.barCouncil
    ? `Advocate &nbsp;|&nbsp; ${data.barCouncil}`
    : 'Advocate';

  return `
    <div class="letterhead">
      <div class="letterhead-name">${data.advocateName}</div>
      <div class="letterhead-bar">${barLine}</div>
      ${contactLine ? `<div class="letterhead-contact">${contactLine}</div>` : ''}
      <div class="letterhead-divider"></div>
      <div class="letterhead-generated">Generated on: ${fullDateTimePrint()}</div>
      <div class="letterhead-divider"></div>
    </div>
  `;
}

const printCSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, sans-serif;
    font-size: 12px;
    color: #000;
    background: #fff;
    padding: 32px 40px;
    line-height: 1.5;
  }
  .letterhead {
    margin-bottom: 24px;
  }
  .letterhead-name {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
  .letterhead-bar {
    font-size: 12px;
    color: #333;
    margin-top: 4px;
  }
  .letterhead-contact {
    font-size: 11px;
    color: #555;
    margin-top: 3px;
  }
  .letterhead-divider {
    border-bottom: 1.5px solid #000;
    margin-top: 10px;
  }
  .letterhead-generated {
    font-size: 10px;
    color: #555;
    margin-top: 8px;
  }
  .report-title {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 20px;
  }
  .section {
    margin-bottom: 24px;
  }
  .section-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #333;
    border-bottom: 1px solid #ccc;
    padding-bottom: 5px;
    margin-bottom: 10px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8px;
  }
  th {
    font-size: 10px;
    font-weight: 700;
    text-align: left;
    padding: 6px 8px;
    background: #f0f0f0;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: #333;
    border-bottom: 1.5px solid #999;
  }
  td {
    font-size: 11px;
    padding: 6px 8px;
    border-bottom: 1px solid #ddd;
    vertical-align: top;
  }
  tr:last-child td { border-bottom: none; }
  .bold { font-weight: 700; }
  .at-risk td { font-weight: 700; }
  .empty-row { padding: 12px 0; color: #999; font-style: italic; font-size: 11px; }
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 24px;
  }
  .info-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: #555;
    margin-bottom: 2px;
  }
  .info-value {
    font-size: 12px;
    color: #000;
  }
  .summary-box {
    display: flex;
    gap: 24px;
    padding: 10px 0;
    border-top: 1px solid #ccc;
    margin-top: 8px;
  }
  .summary-item {
    text-align: center;
  }
  .summary-num {
    font-size: 20px;
    font-weight: 700;
  }
  .summary-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: #555;
    margin-top: 2px;
  }
  .footer {
    margin-top: 32px;
    padding-top: 8px;
    border-top: 1px solid #ccc;
    font-size: 9px;
    color: #888;
  }
  .notes-block {
    background: #f9f9f9;
    border-left: 3px solid #000;
    padding: 10px 12px;
    font-size: 11px;
    line-height: 1.6;
    color: #333;
    white-space: pre-wrap;
  }
  .timeline-item {
    padding: 6px 0;
    border-bottom: 1px solid #eee;
    font-size: 11px;
  }
  .timeline-item:last-child { border-bottom: none; }
  .timeline-date {
    font-weight: 700;
    color: #000;
    display: inline;
  }
  .timeline-text {
    color: #333;
    display: inline;
  }
`;

// ── Filename helpers ─────────────────────────────────────────────────
function fmtDateForFilename(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate().toString().padStart(2, '0')}${MONTHS[d.getMonth()]}${d.getFullYear()}`;
}

function safeFilename(name: string): string {
  return name.replace(/[\/\\:\s*?"<>|]/g, '').trim();
}

async function generateAndShare(html: string, title: string, fileName: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      Alert.alert('Print', 'Printing is not supported in the browser. Please use the app.');
      return;
    }
    // Native: open system print dialog directly (Android print framework / AirPrint on iOS)
    await Print.printAsync({ html });
  } catch (err) {
    Alert.alert('Print Error', 'Unable to print. Please try again.');
  }
}

// ── Report 1: Daily Cause List ───────────────────────────────────────

export interface CauseListReportInput {
  advocate: LetterheadData;
  todayHearings: Array<{ case: Case; hearing: Hearing; client?: Client | null }>;
  atRiskCaseIds?: string[];
}

function buildCauseListHTML(data: CauseListReportInput): string {
  const today = new Date();
  const dateStr = fmtDatePrint(today.getTime());

  let tableRows = '';
  if (data.todayHearings.length === 0) {
    tableRows = '<tr><td colspan="7" class="empty-row">No hearings scheduled for today.</td></tr>';
  } else {
    tableRows = data.todayHearings.map((item, idx) => {
      const isAtRisk = data.atRiskCaseIds?.includes(item.case.id);
      return `<tr${isAtRisk ? ' class="at-risk"' : ''}>
        <td>${idx + 1}</td>
        <td>${item.case.caseNumber}</td>
        <td>${item.case.caseType}</td>
        <td>${item.client?.name ?? item.case.clientName ?? '—'}</td>
        <td>${item.case.courtName}</td>
        <td>${item.hearing.hearingTime ?? fmtTimePrint(item.hearing.hearingDate)}</td>
        <td>${item.case.status}</td>
      </tr>`;
    }).join('');
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>${printCSS}</style></head>
<body>
  ${buildLetterhead(data.advocate)}
  <div class="report-title">Cause List &mdash; ${dateStr}</div>
  <div class="section">
    <table>
      <thead><tr>
        <th>Sr.</th><th>Case No.</th><th>Case Type</th><th>Client Name</th>
        <th>Court Name</th><th>Time</th><th>Status</th>
      </tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>
  <div class="footer">Total hearings today: ${data.todayHearings.length} &nbsp;&bull;&nbsp; Generated by LawFlow</div>
</body></html>`;
}

export async function printCauseList(data: CauseListReportInput): Promise<void> {
  const html = buildCauseListHTML(data);
  await generateAndShare(html, `Cause List — ${fmtDateForFilename(Date.now())}`, `CauseList_${fmtDateForFilename(Date.now())}`);
}

// ── Report 2: Case Detail Report ─────────────────────────────────────

export interface CaseDetailReportInput {
  advocate: LetterheadData;
  caseData: Case;
  client: Client | null;
  hearings: Hearing[];
  documents?: Array<{ fileName: string; fileType?: string }>;
  notes?: string;
}

function buildCaseDetailHTML(data: CaseDetailReportInput): string {
  const c = data.caseData;
  const client = data.client;
  const hearings = [...data.hearings].sort((a, b) => b.hearingDate - a.hearingDate);

  // Hearing History Table
  let hearingTable = '';
  if (hearings.length === 0) {
    hearingTable = '<p class="empty-row">No hearings recorded.</p>';
  } else {
    hearingTable = `<table>
      <thead><tr><th>Date</th><th>Purpose</th><th>Outcome</th><th>Notes</th></tr></thead>
      <tbody>${hearings.map(h => `<tr>
        <td>${fmtDatePrint(h.hearingDate)}</td>
        <td>${h.purpose ?? '—'}</td>
        <td>${h.outcome ?? 'Pending'}</td>
        <td>${h.notes ?? '—'}</td>
      </tr>`).join('')}</tbody>
    </table>`;
  }

  // Documents List
  let docsList = '';
  if (data.documents && data.documents.length > 0) {
    docsList = `<ul style="margin:0;padding-left:18px;">${data.documents.map(d =>
      `<li style="font-size:11px;padding:2px 0;">${d.fileName}${d.fileType ? ` (${d.fileType})` : ''}</li>`
    ).join('')}</ul>`;
  } else {
    docsList = '<p class="empty-row">No documents attached.</p>';
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>${printCSS}</style></head>
<body>
  ${buildLetterhead(data.advocate)}
  <div class="report-title">Case Report &mdash; ${c.caseNumber}</div>

  <div class="section">
    <div class="section-title">Case Information</div>
    <div class="info-grid">
      <div><div class="info-label">Case Number</div><div class="info-value">${c.caseNumber}</div></div>
      <div><div class="info-label">Case Type</div><div class="info-value">${c.caseType}</div></div>
      <div><div class="info-label">Status</div><div class="info-value">${c.status}</div></div>
      <div><div class="info-label">Court</div><div class="info-value">${c.courtName}${c.courtCity ? ', ' + c.courtCity : ''}</div></div>
      <div><div class="info-label">Judge</div><div class="info-value">${c.benchNumber ?? '—'}</div></div>
      <div><div class="info-label">Filing Date</div><div class="info-value">${fmtDatePrint(c.registrationDate ?? c.filingDate)}</div></div>
      <div><div class="info-label">Next Hearing Date</div><div class="info-value">${c.nextHearingDate ? fmtDatePrint(c.nextHearingDate) : 'Awaiting'}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Parties</div>
    <div class="info-grid">
      <div><div class="info-label">Petitioner(s)</div><div class="info-value">${c.plaintiffPetitioner ?? '—'}${c.plaintiffType ? ` (${c.plaintiffType})` : ''}</div></div>
      <div><div class="info-label">Defendant(s)</div><div class="info-value">${c.defendant ?? '—'}${c.defendantType ? ` (${c.defendantType})` : ''}</div></div>
    </div>
  </div>

  ${client ? `
  <div class="section">
    <div class="section-title">Client Information</div>
    <div class="info-grid">
      <div><div class="info-label">Name</div><div class="info-value">${client.name}</div></div>
      <div><div class="info-label">Phone</div><div class="info-value">${fmtPhone(client.phone)}</div></div>
      ${client.email ? `<div><div class="info-label">Email</div><div class="info-value">${client.email}</div></div>` : ''}
    </div>
  </div>` : ''}

  <div class="section">
    <div class="section-title">Hearing History (${hearings.length})</div>
    ${hearingTable}
  </div>

  <div class="section">
    <div class="section-title">Documents (${data.documents?.length ?? 0})</div>
    ${docsList}
  </div>

  ${c.notes ? `
  <div class="section">
    <div class="section-title">Case Notes / Timeline</div>
    <div class="notes-block">${c.notes.replace(/\n/g, '<br>')}</div>
  </div>` : ''}

  <div class="footer">Case: ${c.caseNumber} &nbsp;&bull;&nbsp; Generated by LawFlow on ${fullDateTimePrint()}</div>
</body></html>`;
}

export async function printCaseDetail(data: CaseDetailReportInput): Promise<void> {
  const html = buildCaseDetailHTML(data);
  await generateAndShare(html, `Case Report — ${data.caseData.caseNumber}`, `${safeFilename(data.caseData.caseNumber)}_Report`);
}

// ── Report 3: Client Summary ─────────────────────────────────────────

export interface ClientSummaryReportInput {
  advocate: LetterheadData;
  client: Client;
  cases: Case[];
  upcomingHearings: Array<{ case: Case; hearing: Hearing }>;
}

function buildClientSummaryHTML(data: ClientSummaryReportInput): string {
  const cl = data.client;

  // Cases Table
  let casesTable = '';
  if (data.cases.length === 0) {
    casesTable = '<p class="empty-row">No cases linked.</p>';
  } else {
    casesTable = `<table>
      <thead><tr><th>Case No.</th><th>Type</th><th>Status</th><th>Court</th><th>Next Hearing</th></tr></thead>
      <tbody>${data.cases.map(c => `<tr>
        <td>${c.caseNumber}</td>
        <td>${c.caseType}</td>
        <td>${c.status}</td>
        <td>${c.courtName}</td>
        <td>${c.nextHearingDate ? fmtDatePrint(c.nextHearingDate) : '—'}</td>
      </tr>`).join('')}</tbody>
    </table>`;
  }

  // Upcoming Hearings (next 3)
  const upcoming = data.upcomingHearings.slice(0, 3);
  let upcomingSection = '';
  if (upcoming.length === 0) {
    upcomingSection = '<p class="empty-row">No upcoming hearings.</p>';
  } else {
    upcomingSection = `<table>
      <thead><tr><th>Date</th><th>Case No.</th><th>Court</th><th>Purpose</th></tr></thead>
      <tbody>${upcoming.map(item => `<tr>
        <td>${fmtDatePrint(item.hearing.hearingDate)}</td>
        <td>${item.case.caseNumber}</td>
        <td>${item.case.courtName}</td>
        <td>${item.hearing.purpose ?? '—'}</td>
      </tr>`).join('')}</tbody>
    </table>`;
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>${printCSS}</style></head>
<body>
  ${buildLetterhead(data.advocate)}
  <div class="report-title">Client Summary &mdash; ${cl.name}</div>

  <div class="section">
    <div class="section-title">Client Information</div>
    <div class="info-grid">
      <div><div class="info-label">Name</div><div class="info-value">${cl.name}</div></div>
      <div><div class="info-label">Client Type</div><div class="info-value">${cl.clientType}</div></div>
      <div><div class="info-label">Phone</div><div class="info-value">${fmtPhone(cl.phone)}</div></div>
      ${cl.email ? `<div><div class="info-label">Email</div><div class="info-value">${cl.email}</div></div>` : ''}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Cases (${data.cases.length})</div>
    ${casesTable}
  </div>

  <div class="section">
    <div class="section-title">Upcoming Hearings</div>
    ${upcomingSection}
  </div>

  <div class="footer">Client: ${cl.name} &nbsp;&bull;&nbsp; Generated by LawFlow on ${fullDateTimePrint()}</div>
</body></html>`;
}

export async function printClientSummary(data: ClientSummaryReportInput): Promise<void> {
  const html = buildClientSummaryHTML(data);
  await generateAndShare(html, `Client Summary — ${data.client.name}`, `${safeFilename(data.client.name)}_Report`);
}

// ── Report 4: Hearing History ────────────────────────────────────────

export interface HearingHistoryReportInput {
  advocate: LetterheadData;
  caseData: Case;
  hearings: Hearing[];
}

function buildHearingHistoryHTML(data: HearingHistoryReportInput): string {
  const c = data.caseData;
  const hearings = [...data.hearings].sort((a, b) => b.hearingDate - a.hearingDate);
  const adjournments = hearings.filter(h => h.outcome === 'ADJOURNED').length;
  const lastOutcome = hearings.find(h => h.outcome)?.outcome ?? '—';

  let tableRows = '';
  if (hearings.length === 0) {
    tableRows = '<tr><td colspan="6" class="empty-row">No hearings recorded.</td></tr>';
  } else {
    tableRows = hearings.map((h, idx) => `<tr>
      <td>${idx + 1}</td>
      <td>${fmtDatePrint(h.hearingDate)}</td>
      <td>${c.courtName}</td>
      <td>${h.purpose ?? '—'}</td>
      <td>${h.outcome ?? 'Pending'}</td>
      <td>${h.notes ?? '—'}</td>
    </tr>`).join('');
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>${printCSS}</style></head>
<body>
  ${buildLetterhead(data.advocate)}
  <div class="report-title">Hearing History &mdash; ${c.caseNumber}</div>

  <div class="section">
    <table>
      <thead><tr>
        <th>Sr.</th><th>Date</th><th>Court</th><th>Purpose</th><th>Outcome</th><th>Notes</th>
      </tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Summary</div>
    <div class="info-grid">
      <div><div class="info-label">Total Hearings</div><div class="info-value">${hearings.length}</div></div>
      <div><div class="info-label">Adjournments</div><div class="info-value">${adjournments}</div></div>
      <div><div class="info-label">Last Outcome</div><div class="info-value">${lastOutcome}</div></div>
    </div>
  </div>

  <div class="footer">Case: ${c.caseNumber} &nbsp;&bull;&nbsp; Generated by LawFlow on ${fullDateTimePrint()}</div>
</body></html>`;
}

export async function printHearingHistory(data: HearingHistoryReportInput): Promise<void> {
  const html = buildHearingHistoryHTML(data);
  await generateAndShare(html, `Hearing History — ${data.caseData.caseNumber}`, `${safeFilename(data.caseData.caseNumber)}_HearingHistory`);
}
