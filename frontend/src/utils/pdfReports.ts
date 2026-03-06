import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
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
      await Print.printAsync({ html });
    } else {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Daily Cause List',
        UTI: 'com.adobe.pdf',
      });
    }
  } catch (err) {
    Alert.alert('Print Error', 'Unable to generate PDF. Please try again.');
  }
}

export async function printCaseReport(data: CaseReportData): Promise<void> {
  const html = buildCaseHTML(data);
  try {
    if (Platform.OS === 'web') {
      await Print.printAsync({ html });
    } else {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Case Report — ${data.case.caseNumber}`,
        UTI: 'com.adobe.pdf',
      });
    }
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
  try {
    if (Platform.OS === 'web') {
      await Print.printAsync({ html });
    } else {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
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
