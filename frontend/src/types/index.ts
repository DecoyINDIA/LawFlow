export type CaseType =
  | 'CIVIL' | 'CRIMINAL' | 'FAMILY' | 'PROPERTY' | 'CORPORATE'
  | 'LABOUR' | 'TAX' | 'CONSTITUTIONAL' | 'CONSUMER' | 'CYBER'
  | 'IPR' | 'BANKING' | 'ARBITRATION' | 'WRIT' | 'OTHER';

export type CaseStatus = 'FILED' | 'ACTIVE' | 'ADJOURNED' | 'DISPOSED' | 'STAYED' | 'PENDING' | string;
export type CasePriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type ClientType = 'INDIVIDUAL' | 'CORPORATE' | 'NGO' | 'GOVERNMENT';
export type HearingOutcome = 'ADJOURNED' | 'ARGUED' | 'ORDERS_RESERVED' | 'DISPOSED' | 'PART_HEARD' | 'STAYED';
export type TemplateType = 'HEARING_REMINDER_1DAY' | 'HEARING_REMINDER_SAMEDAY' | 'POST_HEARING_UPDATE' | 'ADJOURNMENT_NOTICE' | 'CASE_DISPOSED' | 'CUSTOM';
export type MessageChannel = 'WHATSAPP' | 'SMS' | 'BOTH';
export type DocumentType = 'PDF' | 'IMAGE' | 'WORD' | 'EXCEL' | 'OTHER';
export type UploadStatus = 'LOCAL_ONLY' | 'UPLOADING' | 'UPLOADED' | 'FAILED';

export interface VoiceNote {
  id: string;
  caseId?: string;
  caseName?: string;
  title: string;
  uri: string;
  duration: number;
  createdAt: number;
}

export interface AdvocateProfile {
  name: string;
  phone: string;
  email?: string;
  enrollmentNumber?: string;
  designation?: string;
  barCouncil?: string;
  yearsOfExperience?: number;
  practiceAreas?: string[];
  primaryCourts?: string[];
  officeAddress?: string;
  photoUri?: string;
}

export interface AppSettings {
  darkMode: boolean;
  hearingReminders: boolean;
  reminderDaysBeforeHearing: number;
}

export interface Case {
  id: string;
  caseNumber: string;
  title: string;
  caseType: CaseType;
  courtName: string;
  courtCity: string;
  benchNumber?: string;
  clientId: string;
  clientName: string;
  plaintiffPetitioner?: string;  // renamed from opponentName
  plaintiffType?: string;        // new field
  defendant?: string;             // renamed from opponentAdvocate
  defendantType?: string;        // new field
  syncPending?: boolean;
  registrationDate?: number;      // new field
  filingDate?: number;
  firstHearingDate?: number;
  nextHearingDate?: number;
  status: CaseStatus;
  priority: CasePriority;
  notes?: string;
  tags: string[];
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  address?: string;
  city?: string;
  clientType: ClientType;
  tags: string[];
  notes?: string;
  photoUri?: string;
  whatsappOptIn: boolean;
  smsOptIn: boolean;
  syncPending?: boolean;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Hearing {
  id: string;
  caseId: string;
  hearingDate: number;
  hearingTime?: string;
  courtRoom?: string;
  purpose?: string;
  outcome?: HearingOutcome;
  adjournmentReason?: string;
  nextDateSet?: number;
  notes?: string;
  clientNotified: boolean;
  notificationSentAt?: number;
  syncPending?: boolean;
  createdAt: number;
}

export interface Advocate {
  id: string;
  name: string;
  enrollmentNumber: string;
  phone: string;
  email?: string;
  photoUri?: string;
  practiceAreas: string[];
  courtLocations: string[];
  barCouncil?: string;
  designation?: string;
  isProfileComplete: boolean;
  createdAt: number;
}

export interface CauseListItem {
  case: Case;
  hearing: Hearing;
}

export interface DashboardData {
  advocateName: string;
  todayHearings: CauseListItem[];
  upcomingHearings: CauseListItem[];
  missedCount: number;
  todayCount: number;
  thisWeekCount: number;
  activeCount: number;
}
