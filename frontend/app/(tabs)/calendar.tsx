import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../../src/theme';
import { useApp } from '../../src/context/AppContext';
import { useRouter } from 'expo-router';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function buildCalendar(year: number, month: number) {
  const first = new Date(year, month, 1);
  const offset = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function fmtTime(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.m, paddingTop: Spacing.s, paddingBottom: Spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  monthLabel: { ...Typography.headline, color: c.textPrimary },
  navBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  dayHeaders: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.m, paddingVertical: Spacing.s,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  dayHeader: { flex: 1, alignItems: 'center' },
  dayHeaderText: { ...Typography.caption1, fontWeight: '600', color: c.textTertiary },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.m },
  cell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  cellNum: { ...Typography.subhead, color: c.textPrimary },
  cellNumToday: { fontWeight: '700' },
  cellNumSelected: { color: c.background },
  todayCircle: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 1.5, borderColor: c.textPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  selectedCircle: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: c.textPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  dot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: c.textPrimary,
    position: 'absolute', bottom: 6,
  },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginHorizontal: Spacing.m },
  panel: { flex: 1, paddingHorizontal: Spacing.m, paddingTop: Spacing.m },
  panelTitle: { ...Typography.headline, color: c.textPrimary, marginBottom: Spacing.m },
  emptyPanel: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { ...Typography.subhead, color: c.textSecondary, marginTop: Spacing.m },

  hearingItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.m,
    paddingVertical: Spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  hearingDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: c.textPrimary, marginTop: 6,
  },
  hearingInfo: { flex: 1 },
  hearingCase: { ...Typography.subhead, fontWeight: '600', color: c.textPrimary },
  hearingCourt: { ...Typography.footnote, color: c.textSecondary, marginTop: 2 },
  hearingPurpose: { ...Typography.caption1, color: c.textTertiary, marginTop: 2 },
  hearingTime: { ...Typography.caption1, fontWeight: '600', color: c.textPrimary },
  hearingGoBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: c.surfaceHighlight, alignItems: 'center', justifyContent: 'center',
  },

  // No-hearing dot indicator case
  caseDayItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.m,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  caseDayDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: c.textPrimary },
  caseDayInfo: { flex: 1 },
  caseDayNum: { ...Typography.caption1, fontWeight: '700', color: c.textSecondary, letterSpacing: 0.5 },
  caseDayTitle: { ...Typography.subhead, color: c.textPrimary },
  caseDayCourt: { ...Typography.caption1, color: c.textSecondary },
});

export default function CalendarScreen() {
  const router = useRouter();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { getHearingsForDate, hearings, cases } = useApp();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<Date>(today);

  const cells = buildCalendar(year, month);

  const hearingDays = new Set(
    hearings
      .filter(h => { const d = new Date(h.hearingDate); return d.getFullYear() === year && d.getMonth() === month; })
      .map(h => new Date(h.hearingDate).getDate())
  );

  const caseDays = useMemo(() => {
    const days = new Set<number>();
    cases.forEach(c => {
      if (c.nextHearingDate) {
        const d = new Date(c.nextHearingDate);
        if (d.getFullYear() === year && d.getMonth() === month) days.add(d.getDate());
      }
    });
    return days;
  }, [cases, year, month]);

  const eventDays = new Set([...hearingDays, ...caseDays]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const monthName = new Date(year, month, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const selDay = selected.getDate();
  const selMonth = selected.getMonth();
  const selYear = selected.getFullYear();

  const selHearings = hearings.filter(h => {
    const d = new Date(h.hearingDate);
    return d.getDate() === selDay && d.getMonth() === selMonth && d.getFullYear() === selYear;
  });

  const hearingCaseIds = new Set(selHearings.map(h => h.caseId));
  const selCases = cases.filter(c => {
    if (!c.nextHearingDate) return false;
    if (hearingCaseIds.has(c.id)) return false;
    const d = new Date(c.nextHearingDate);
    return d.getDate() === selDay && d.getMonth() === selMonth && d.getFullYear() === selYear;
  });

  const isToday = (d: Date) => {
    const t = today;
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
  };

  const isSelected = (d: Date) =>
    d.getDate() === selDay && d.getMonth() === selMonth && d.getFullYear() === selYear;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Month navigation */}
      <View style={styles.header}>
        <TouchableOpacity testID="prev-month-btn" style={styles.navBtn} onPress={prevMonth} activeOpacity={0.7}>
          <Feather name="chevron-left" size={22} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthName}</Text>
        <TouchableOpacity testID="next-month-btn" style={styles.navBtn} onPress={nextMonth} activeOpacity={0.7}>
          <Feather name="chevron-right" size={22} color={c.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Day headers */}
      <View style={styles.dayHeaders}>
        {DAYS.map((d, i) => (
          <View key={i} style={styles.dayHeader}>
            <Text style={styles.dayHeaderText}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.grid}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={styles.cell} />;
          const today_ = isToday(d);
          const sel_ = isSelected(d);
          const hasEvent = eventDays.has(d.getDate());

          return (
            <TouchableOpacity
              key={i}
              testID={`cal-day-${d.getDate()}`}
              style={styles.cell}
              onPress={() => setSelected(d)}
              activeOpacity={0.7}
            >
              <View style={sel_ ? styles.selectedCircle : today_ ? styles.todayCircle : undefined}>
                <Text style={[
                  styles.cellNum,
                  today_ && styles.cellNumToday,
                  sel_ && styles.cellNumSelected,
                ]}>
                  {d.getDate()}
                </Text>
              </View>
              {hasEvent && !sel_ && <View style={styles.dot} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.divider} />

      {/* Selected day panel */}
      <ScrollView style={styles.panel} showsVerticalScrollIndicator={false}>
        <Text style={styles.panelTitle}>
          {selected.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>

        {selHearings.length === 0 && selCases.length === 0 ? (
          <View style={styles.emptyPanel}>
            <Feather name="calendar" size={32} color={c.textTertiary} />
            <Text style={styles.emptyText}>No hearings on this day</Text>
          </View>
        ) : (
          <>
            {selHearings.map(h => {
              const cas = cases.find(x => x.id === h.caseId);
              return (
                <TouchableOpacity
                  key={h.id}
                  testID={`cal-hearing-${h.id}`}
                  style={styles.hearingItem}
                  onPress={() => cas && router.push(`/cases/${cas.id}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.hearingDot} />
                  <View style={styles.hearingInfo}>
                    <Text style={styles.hearingCase}>{cas?.caseNumber ?? '—'}</Text>
                    <Text style={styles.hearingCourt} numberOfLines={1}>{cas?.courtName ?? '—'}</Text>
                    {h.purpose ? <Text style={styles.hearingPurpose}>{h.purpose}</Text> : null}
                  </View>
                  {h.hearingTime ? <Text style={styles.hearingTime}>{h.hearingTime}</Text> : null}
                  {cas && (
                    <TouchableOpacity
                      style={styles.hearingGoBtn}
                      onPress={() => router.push(`/cases/${cas.id}` as any)}
                      activeOpacity={0.7}
                    >
                      <Feather name="chevron-right" size={14} color={c.textPrimary} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
            {selCases.map(cas => (
              <TouchableOpacity
                key={cas.id}
                style={styles.caseDayItem}
                onPress={() => router.push(`/cases/${cas.id}` as any)}
                activeOpacity={0.7}
              >
                <View style={styles.caseDayDot} />
                <View style={styles.caseDayInfo}>
                  <Text style={styles.caseDayNum}>{cas.caseNumber}</Text>
                  <Text style={styles.caseDayTitle} numberOfLines={1}>{cas.title}</Text>
                  <Text style={styles.caseDayCourt} numberOfLines={1}>{cas.courtName}</Text>
                </View>
                <Feather name="chevron-right" size={14} color={c.textTertiary} />
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
