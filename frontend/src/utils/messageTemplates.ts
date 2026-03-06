// Hardcoded message templates for the Case Detail message composer.
// These are never stored in AppContext — they are constants applied inline.

export type TemplateKey =
  | 'custom'
  | 'hearing_reminder'
  | 'adjournment_notice'
  | 'case_update'
  | 'document_request'
  | 'payment_reminder';

export interface MessageTemplate {
  key: TemplateKey;
  label: string;
  body: string; // raw body with [placeholders]
}

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    key: 'custom',
    label: 'Custom',
    body: '',
  },
  {
    key: 'hearing_reminder',
    label: 'Hearing Reminder',
    body: 'Dear [Client Name], your hearing for Case No. [Case No.] is scheduled on [Next Hearing Date] at [Court Name]. Please be present on time.\n\nRegards,\n[Advocate Name]',
  },
  {
    key: 'adjournment_notice',
    label: 'Adjournment Notice',
    body: 'Dear [Client Name], your case [Case No.] hearing has been adjourned. The next date will be informed shortly.\n\nRegards,\n[Advocate Name]',
  },
  {
    key: 'case_update',
    label: 'Case Update',
    body: 'Dear [Client Name], there has been an update in your case [Case No.] at [Court Name]. Please contact us for further details.\n\nRegards,\n[Advocate Name]',
  },
  {
    key: 'document_request',
    label: 'Document Request',
    body: 'Dear [Client Name], kindly arrange to submit the required documents for your case [Case No.] at the earliest.\n\nRegards,\n[Advocate Name]',
  },
  {
    key: 'payment_reminder',
    label: 'Payment Reminder',
    body: 'Dear [Client Name], your professional fee for case [Case No.] is due. Kindly arrange the payment at the earliest.\n\nRegards,\n[Advocate Name]',
  },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(ts?: number): string {
  if (!ts) return 'date yet to be fixed';
  const d = new Date(ts);
  return `${d.getDate().toString().padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export interface TemplateContext {
  clientName: string;
  caseNumber: string;
  courtName: string;
  nextHearingDate?: number;
  advocateName: string;
}

export function applyTemplate(templateKey: TemplateKey, ctx: TemplateContext): string {
  const tpl = MESSAGE_TEMPLATES.find(t => t.key === templateKey);
  if (!tpl || templateKey === 'custom') return '';
  return tpl.body
    .replace(/\[Client Name\]/g, ctx.clientName || 'Client')
    .replace(/\[Case No\.\]/g, ctx.caseNumber)
    .replace(/\[Court Name\]/g, ctx.courtName)
    .replace(/\[Next Hearing Date\]/g, fmtDate(ctx.nextHearingDate))
    .replace(/\[Advocate Name\]/g, ctx.advocateName || 'the Advocate');
}
