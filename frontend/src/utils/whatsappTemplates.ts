/**
 * Phase 17 — WhatsApp Message Templates
 * These builders produce pre-filled WhatsApp messages for the 3 features:
 *   1. Hearing Reminder (today / tomorrow)
 *   2. Outcome Notification
 *   3. Case Update (3 sub-templates)
 */

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDate(ts?: number): string {
  if (!ts) return 'TBD';
  const d = new Date(ts);
  return `${d.getDate().toString().padStart(2,'0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Feature 1: Hearing Reminder ────────────────────────────────────────────

export function buildHearingReminderMessage(p: {
  clientName: string;
  caseNumber: string;
  courtName: string;
  isTomorrow: boolean;
  advocateName: string;
}): string {
  const dayWord = p.isTomorrow ? 'tomorrow' : 'today';
  return `Dear ${p.clientName}, this is a reminder that your case ${p.caseNumber} is scheduled for hearing ${dayWord} at ${p.courtName}. Please be available.\n\n— ${p.advocateName}`;
}

// ── Feature 2: Outcome Notification ───────────────────────────────────────

export function buildOutcomeMessage(p: {
  clientName: string;
  caseNumber: string;
  courtName: string;
  outcome: string;
  nextDate?: number;
  advocateName: string;
}): string {
  const nextLine = p.nextDate
    ? `Next hearing: ${fmtDate(p.nextDate)} at ${p.courtName}.`
    : 'Next date will be communicated shortly.';
  return `Dear ${p.clientName}, your case ${p.caseNumber} hearing has been concluded today. Outcome: ${p.outcome}. ${nextLine}\n\n— ${p.advocateName}`;
}

// ── Feature 3: Case Update Templates ──────────────────────────────────────

export type UpdateTemplateKey = 'general_update' | 'document_request' | 'next_hearing_set';

export interface UpdateTemplate {
  key: UpdateTemplateKey;
  label: string;
  build: (p: {
    clientName: string;
    caseNumber: string;
    courtName: string;
    nextHearingDate?: number;
    advocateName: string;
  }) => string;
}

export const UPDATE_TEMPLATES: UpdateTemplate[] = [
  {
    key: 'general_update',
    label: 'General Update',
    build: (p) =>
      `Dear ${p.clientName}, there is an update on your case ${p.caseNumber}: [enter your note here].\n\n— ${p.advocateName}`,
  },
  {
    key: 'document_request',
    label: 'Document Request',
    build: (p) =>
      `Dear ${p.clientName}, please arrange the following documents for your case ${p.caseNumber}: [list documents here].\n\n— ${p.advocateName}`,
  },
  {
    key: 'next_hearing_set',
    label: 'Next Hearing Set',
    build: (p) =>
      `Dear ${p.clientName}, your next hearing for case ${p.caseNumber} has been scheduled for ${fmtDate(p.nextHearingDate)} at ${p.courtName}. Please be present on time.\n\n— ${p.advocateName}`,
  },
];
