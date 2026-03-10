import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

const CALENDAR_NAME = 'LawFlow Hearings';

export async function requestCalendarPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

export async function getOrCreateLawFlowCalendar(): Promise<string> {
  if (Platform.OS === 'web') throw new Error('Calendar not supported on web');
  const all = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const existing = all.find((c: Calendar.Calendar) => c.title === CALENDAR_NAME);
  if (existing) return existing.id;

  let source: any = { isLocalAccount: true, name: 'LawFlow', type: 'LOCAL' };
  if (Platform.OS === 'ios') {
    const def = await Calendar.getDefaultCalendarAsync();
    source = def.source;
  }

  return await Calendar.createCalendarAsync({
    title: CALENDAR_NAME,
    color: '#000000',
    entityType: Calendar.EntityTypes.EVENT,
    source,
    name: 'lawflow',
    ownerAccount: 'personal',
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });
}

export async function syncHearingToCalendar(p: {
  calendarId: string;
  existingEventId?: string;
  caseNumber: string;
  clientName: string;
  courtName: string;
  hearingDate: string;
  hearingPurpose?: string;
}): Promise<string> {
  if (Platform.OS === 'web') throw new Error('Calendar not supported on web');
  const start = new Date(p.hearingDate);
  start.setHours(10, 0, 0, 0);
  const end = new Date(p.hearingDate);
  end.setHours(11, 0, 0, 0);

  const details = {
    title: `⚖️ ${p.caseNumber} — ${p.clientName}`,
    notes: `Court: ${p.courtName}\nPurpose: ${p.hearingPurpose || 'Hearing'}\nAdded by LawFlow`,
    startDate: start,
    endDate: end,
    timeZone: 'Asia/Kolkata',
    alarms: [{ relativeOffset: -60 }, { relativeOffset: -1440 }],
  };

  if (p.existingEventId) {
    try {
      await Calendar.updateEventAsync(p.existingEventId, details);
      return p.existingEventId;
    } catch {}
  }
  return await Calendar.createEventAsync(p.calendarId, details);
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try { await Calendar.deleteEventAsync(eventId); } catch {}
}
