import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../src/theme';
import { useApp } from '../src/context/AppContext';
import { CaseType, CaseStatus } from '../src/types';

function BarItem({ label, count, total }: { label: string; count: number; total: number }) {
  const c = useColors();
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.s }}>
      <Text style={{ width: 90, ...Typography.caption1, color: c.textSecondary }} numberOfLines={1}>{label}</Text>
      <View style={{ flex: 1, height: 6, backgroundColor: c.surfaceHighlight, borderRadius: 3, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: 6, backgroundColor: c.textPrimary, borderRadius: 3 }} />
      </View>
      <Text style={{ width: 24, ...Typography.caption1, color: c.textSecondary, textAlign: 'right' }}>{count}</Text>
    </View>
  );
}

function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, minWidth: '45%', backgroundColor: c.surface, borderRadius: Radius.m, padding: Spacing.m, alignItems: 'center' }}>
      <Text style={{ fontSize: 26, fontWeight: '700', color: c.textPrimary, lineHeight: 30 }}>{value}</Text>
      <Text style={{ ...Typography.caption1, color: c.textSecondary, textAlign: 'center', marginTop: 2 }}>{label}</Text>
      {sub ? <Text style={{ ...Typography.caption2, color: c.textTertiary, textAlign: 'center' }}>{sub}</Text> : null}
    </View>
  );
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.m, paddingTop: Spacing.s, paddingBottom: Spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, ...Typography.headline, color: c.textPrimary, textAlign: 'center' },
  content: { padding: Spacing.m, paddingBottom: 32 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: c.textSecondary,
    letterSpacing: 0.8, marginBottom: Spacing.m, marginTop: Spacing.l,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.s, marginBottom: Spacing.s },
  card: { backgroundColor: c.surface, borderRadius: Radius.m, padding: Spacing.m, gap: Spacing.m },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: Spacing.s },
  chartCol: { flex: 1, alignItems: 'center', height: '100%' },
  chartCount: { ...Typography.caption2, color: c.textSecondary, marginBottom: 2 },
  chartBarBg: { flex: 1, width: '70%', justifyContent: 'flex-end' },
  chartBar: { backgroundColor: c.textPrimary, borderRadius: 3, minHeight: 4 },
  chartLabel: { ...Typography.caption2, color: c.textSecondary, marginTop: 4 },
});

export default function AnalyticsScreen() {
  const router = useRouter();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { cases, hearings } = useApp();

  const totalCases = cases.length;
  const activeCases = cases.filter(c => c.status?.toUpperCase() === 'ACTIVE').length;
  const disposedCases = cases.filter(c => c.status?.toUpperCase() === 'DISPOSED').length;
  const adjournedCases = cases.filter(c => c.status?.toUpperCase() === 'ADJOURNED').length;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const pendingOutcomes = hearings.filter(h => h.hearingDate < todayMs && !h.outcome).length;

  const typeCounts: Partial<Record<CaseType, number>> = {};
  cases.forEach(x => { typeCounts[x.caseType] = (typeCounts[x.caseType] ?? 0) + 1; });
  const typeEntries = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const months: Array<{ label: string; count: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const yr = d.getFullYear(); const mo = d.getMonth();
    const count = hearings.filter(h => { const hd = new Date(h.hearingDate); return hd.getFullYear() === yr && hd.getMonth() === mo; }).length;
    months.push({ label: d.toLocaleString('en-US', { month: 'short' }), count });
  }
  const maxMonthCount = Math.max(...months.map(m => m.count), 1);
  const highPriority = cases.filter(x => x.priority?.toUpperCase() === 'HIGH').length;
  const medPriority = cases.filter(x => x.priority?.toUpperCase() === 'MEDIUM').length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="analytics-back-btn">
          <Feather name="arrow-left" size={22} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Analytics</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        <Text style={styles.sectionTitle}>OVERVIEW</Text>
        <View style={styles.statsGrid}>
          <StatBox label="Total Cases" value={totalCases} />
          <StatBox label="Active" value={activeCases} />
          <StatBox label="Disposed" value={disposedCases} />
          <StatBox label="Pending Outcomes" value={pendingOutcomes} sub="need action" />
        </View>

        <Text style={styles.sectionTitle}>CASE STATUS</Text>
        <View style={styles.card}>
          {([
            ['ACTIVE', activeCases],
            ['ADJOURNED', adjournedCases],
            ['STAYED', cases.filter(x => x.status?.toUpperCase() === 'STAYED').length],
            ['PENDING', cases.filter(x => x.status?.toUpperCase() === 'PENDING').length],
            ['DISPOSED', disposedCases],
          ] as [CaseStatus, number][]).map(([status, count]) => (
            <BarItem key={status} label={status} count={count} total={totalCases} />
          ))}
        </View>

        <Text style={styles.sectionTitle}>PRIORITY BREAKDOWN</Text>
        <View style={styles.card}>
          <BarItem label="High" count={highPriority} total={totalCases} />
          <BarItem label="Medium" count={medPriority} total={totalCases} />
          <BarItem label="Low" count={cases.filter(x => x.priority?.toUpperCase() === 'LOW').length} total={totalCases} />
        </View>

        {typeEntries.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>CASE TYPES</Text>
            <View style={styles.card}>
              {typeEntries.map(([type, count]) => (
                <BarItem key={type} label={type} count={count} total={totalCases} />
              ))}
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>HEARING TREND (6 MONTHS)</Text>
        <View style={styles.card}>
          <View style={styles.barChart}>
            {months.map((m, i) => {
              const heightPct = m.count / maxMonthCount;
              return (
                <View key={i} style={styles.chartCol}>
                  <Text style={styles.chartCount}>{m.count || ''}</Text>
                  <View style={styles.chartBarBg}>
                    <View style={[styles.chartBar, { flex: heightPct }]} />
                    <View style={{ flex: 1 - heightPct }} />
                  </View>
                  <Text style={styles.chartLabel}>{m.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
