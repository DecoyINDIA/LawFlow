import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../../theme';
import type { Case, Hearing } from '../../types';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate().toString().padStart(2,'0')} ${MONTHS[d.getMonth()]}`;
}

type EventType = 'REGISTERED' | 'HEARING' | 'DOCUMENT' | 'VOICE_NOTE';

interface TimelineEvent {
  id: string;
  date: number;
  type: EventType;
  title: string;
  subtitle: string;
  isPast: boolean;
}

const EVENT_ICON: Record<EventType, string> = {
  REGISTERED: '📁',
  HEARING: '📅',
  DOCUMENT: '📄',
  VOICE_NOTE: '🎙',
};

interface DocItem { id: string; fileName: string; fileType: string; fileSize: string; createdAt: number; }
interface NoteItem { id: string; title: string; duration: number; createdAt: number; }

interface Props {
  caseData: Case;
  hearings: Hearing[];
  documents: DocItem[];
  voiceNotes: NoteItem[];
}

export function CaseTimeline({ caseData, hearings, documents, voiceNotes }: Props) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const now = Date.now();

  const events: TimelineEvent[] = useMemo(() => {
    const list: TimelineEvent[] = [];

    // Case registered
    const regDate = caseData.registrationDate || caseData.filingDate;
    if (regDate) {
      list.push({
        id: 'reg',
        date: regDate,
        type: 'REGISTERED',
        title: 'Case Registered',
        subtitle: caseData.caseNumber,
        isPast: regDate <= now,
      });
    }

    // Hearings
    hearings.forEach(h => {
      list.push({
        id: 'h-' + h.id,
        date: h.hearingDate,
        type: 'HEARING',
        title: h.purpose || 'Hearing',
        subtitle: h.outcome
          ? `Outcome: ${h.outcome}`
          : h.hearingDate > now
            ? 'Upcoming'
            : 'Outcome not recorded',
        isPast: h.hearingDate <= now,
      });
    });

    // Documents
    documents.forEach(doc => {
      list.push({
        id: 'd-' + doc.id,
        date: doc.createdAt,
        type: 'DOCUMENT',
        title: doc.fileName,
        subtitle: `${doc.fileType} · ${doc.fileSize}`,
        isPast: true,
      });
    });

    // Voice Notes
    voiceNotes.forEach(v => {
      const m = Math.floor(v.duration / 60);
      const s = v.duration % 60;
      list.push({
        id: 'vn-' + v.id,
        date: v.createdAt,
        type: 'VOICE_NOTE',
        title: v.title,
        subtitle: `${m}:${s.toString().padStart(2,'0')} recording`,
        isPast: true,
      });
    });

    return list.sort((a, b) => b.date - a.date);
  }, [caseData, hearings, documents, voiceNotes, now]);

  if (events.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>TIMELINE</Text>
      <View style={styles.container}>
        {events.map((event, idx) => {
          const isLast = idx === events.length - 1;
          return (
            <View key={event.id} style={styles.row}>
              {/* Left: dot + line */}
              <View style={styles.lineCol}>
                <View style={[styles.dot, event.isPast ? styles.dotFilled : styles.dotEmpty]} />
                {!isLast && <View style={styles.line} />}
              </View>

              {/* Right: content */}
              <View style={[styles.contentRow, !isLast && styles.contentRowBorder]}>
                <Text style={styles.icon}>{EVENT_ICON[event.type]}</Text>
                <View style={styles.textBlock}>
                  <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
                  <Text style={styles.eventSub} numberOfLines={1}>{event.subtitle}</Text>
                </View>
                <Text style={styles.eventDate}>{fmtDate(event.date)}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  section: { marginBottom: Spacing.l },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: c.textSecondary,
    letterSpacing: 0.8, marginBottom: Spacing.s,
  },
  container: {
    backgroundColor: c.surface,
    borderRadius: Radius.m,
    paddingHorizontal: Spacing.m,
    paddingVertical: Spacing.s,
  },
  row: { flexDirection: 'row' },
  lineCol: {
    width: 20,
    alignItems: 'center',
    paddingTop: 14,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    zIndex: 1,
  },
  dotFilled: { backgroundColor: c.textPrimary },
  dotEmpty: {
    backgroundColor: c.background,
    borderWidth: 1.5,
    borderColor: c.textTertiary,
  },
  line: {
    flex: 1,
    width: 1,
    backgroundColor: '#E5E5E5',
    marginTop: 2,
  },
  contentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: Spacing.s,
    gap: Spacing.s,
  },
  contentRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  icon: { fontSize: 14, width: 20, textAlign: 'center' },
  textBlock: { flex: 1 },
  eventTitle: { fontSize: 13, fontWeight: '600', color: c.textPrimary, lineHeight: 17 },
  eventSub: { fontSize: 12, color: c.textSecondary, lineHeight: 16, marginTop: 1 },
  eventDate: { fontSize: 11, color: c.textSecondary, textAlign: 'right' },
});
