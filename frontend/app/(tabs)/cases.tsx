import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../../src/theme';
import { useApp } from '../../src/context/AppContext';
import { CFSearchBar } from '../../src/components/common/CFSearchBar';
import { StatusBadge } from '../../src/components/common/StatusBadge';
import { PaywallSheet } from '../../src/components/PaywallSheet';
import { Case, CaseStatus } from '../../src/types';

const FILTERS: Array<{ label: string; value: CaseStatus | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Filed', value: 'FILED' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Adjourned', value: 'ADJOURNED' },
  { label: 'Stayed', value: 'STAYED' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Disposed', value: 'DISPOSED' },
];

function fmtDate(ts?: number) {
  if (!ts) return null;
  const d = new Date(ts);
  return `${d.getDate().toString().padStart(2, '0')} ${d.toLocaleString('en-US', { month: 'short' })} ${d.getFullYear()}`;
}

function isAwaitingNextDate(item: Case): boolean {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const todayMs = now.getTime();
  return item.status !== 'DISPOSED' && (!item.nextHearingDate || item.nextHearingDate < todayMs);
}

const makeCardStyles = (c: ColorPalette) => StyleSheet.create({
  card: {
    backgroundColor: c.surface, borderRadius: Radius.m,
    padding: Spacing.m, marginHorizontal: Spacing.m,
    marginBottom: Spacing.s,
  },
  cardRow: { flexDirection: 'row', gap: Spacing.m },
  cardLeft: { flex: 1, gap: 3 },
  numRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: c.surfaceHighlight, borderWidth: 1, borderColor: c.border },
  dotOn: { backgroundColor: c.textPrimary, borderColor: c.textPrimary },
  highDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF3B30' },
  caseNum: { ...Typography.caption1, fontWeight: '700', color: c.textSecondary, letterSpacing: 0.5 },
  caseTitle: { ...Typography.subhead, fontWeight: '600', color: c.textPrimary },
  court: { ...Typography.footnote, color: c.textSecondary },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  nextText: { ...Typography.caption2, color: c.textSecondary },
  awaitingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  awaitingText: { ...Typography.caption2, color: c.textTertiary, fontStyle: 'italic' },
  cardRight: { alignItems: 'flex-end', gap: 4, paddingTop: 2 },
  clientText: { ...Typography.caption2, color: c.textTertiary, textAlign: 'right', maxWidth: 80, marginTop: 2 },
});

function CaseCard({ item, onPress }: { item: Case; onPress: () => void }) {
  const c = useColors();
  const styles = useMemo(() => makeCardStyles(c), [c]);
  const awaiting = isAwaitingNextDate(item);

  return (
    <TouchableOpacity
      testID={`case-card-${item.id}`}
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardRow}>
        <View style={styles.cardLeft}>
          <View style={styles.numRow}>
            <View style={[styles.dot, item.status === 'ACTIVE' && styles.dotOn]} />
            <Text style={styles.caseNum}>{item.caseNumber}</Text>
            {item.priority === 'HIGH' && <View style={styles.highDot} />}
          </View>
          <Text style={styles.caseTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.court} numberOfLines={1}>{item.courtName} · {item.courtCity}</Text>
          {item.nextHearingDate ? (
            <View style={styles.nextRow}>
              <Feather name="calendar" size={11} color={c.textSecondary} />
              <Text style={styles.nextText}>Next: {fmtDate(item.nextHearingDate)}</Text>
            </View>
          ) : awaiting ? (
            <View style={styles.awaitingRow}>
              <Feather name="alert-circle" size={11} color={c.textTertiary} />
              <Text style={styles.awaitingText}>Awaiting Next Date</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.cardRight}>
          <StatusBadge status={item.status} small />
          <Text style={styles.clientText} numberOfLines={2}>{item.clientName}</Text>
          <Feather name="chevron-right" size={14} color={c.textTertiary} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: {
    paddingHorizontal: Spacing.m,
    paddingTop: Spacing.s,
    paddingBottom: Spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.m },
  title: { ...Typography.largeTitle, color: c.textPrimary },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: c.textPrimary, alignItems: 'center', justifyContent: 'center',
  },
  filterBar: {
    paddingHorizontal: Spacing.m,
    paddingTop: Spacing.s,
    paddingBottom: Spacing.m,
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: Radius.full, borderWidth: 1,
    borderColor: c.border, backgroundColor: c.background,
  },
  filterChipOn: { backgroundColor: c.textPrimary, borderColor: c.textPrimary },
  filterText: { ...Typography.caption1, fontWeight: '600', color: c.textSecondary },
  filterTextOn: { color: c.background },
  list: { flex: 1 },
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: { ...Typography.headline, color: c.textPrimary, marginTop: Spacing.m },
  emptyText: { ...Typography.subhead, color: c.textSecondary, marginTop: 4, textAlign: 'center' },
  emptyBtn: {
    marginTop: Spacing.l, paddingHorizontal: Spacing.l, paddingVertical: Spacing.m,
    backgroundColor: c.textPrimary, borderRadius: Radius.m,
  },
  emptyBtnText: { ...Typography.subhead, fontWeight: '600', color: c.background },
  listHeader: { height: Spacing.m },
  listFooter: { height: 100 },
});

export default function CasesScreen() {
  const router = useRouter();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { cases, deleteCase, syncStatus, isProUser } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CaseStatus | 'ALL'>('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const handleNewCase = () => {
    if (!isProUser && cases.length >= 10) {
      setShowPaywall(true);
      return;
    }
    router.push('/cases/new' as any);
  };

  const filtered = useMemo(() => {
    let r = filter === 'ALL' ? [...cases] : cases.filter(x => x.status === filter);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(x =>
        x.title.toLowerCase().includes(q) ||
        x.caseNumber.toLowerCase().includes(q) ||
        x.courtName.toLowerCase().includes(q) ||
        x.clientName?.toLowerCase().includes(q)
      );
    }
    return r.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [cases, filter, search]);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 500));
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Cases</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.s }}>
            {syncStatus === 'syncing' && (
              <Text testID="cases-syncing-label" style={{ fontSize: 12, color: c.textTertiary }}>
                Syncing...
              </Text>
            )}
            <TouchableOpacity
              testID="new-case-btn"
              style={styles.addBtn}
              onPress={handleNewCase}
              activeOpacity={0.7}
            >
              <Feather name="plus" size={20} color={c.background} />
            </TouchableOpacity>
          </View>
        </View>
        <CFSearchBar
          testID="cases-search"
          placeholder="Search cases…"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={item => item.value}
          contentContainerStyle={styles.filterBar}
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`filter-${item.value}`}
              style={[styles.filterChip, filter === item.value && styles.filterChipOn]}
              onPress={() => setFilter(item.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterText, filter === item.value && styles.filterTextOn]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        style={styles.list}
        ListHeaderComponent={<View style={styles.listHeader} />}
        ListFooterComponent={<View style={styles.listFooter} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.textPrimary} />
        }
        renderItem={({ item }) => (
          <CaseCard
            item={item}
            onPress={() => router.push(`/cases/${item.id}` as any)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="briefcase" size={48} color={c.textTertiary} />
            <Text style={styles.emptyTitle}>{search || filter !== 'ALL' ? 'No Results' : 'No Cases Yet'}</Text>
            <Text style={styles.emptyText}>
              {search || filter !== 'ALL' ? 'Try a different search or filter' : 'Add your first case to get started'}
            </Text>
            {!search && filter === 'ALL' && (
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={handleNewCase}
                activeOpacity={0.7}
              >
                <Text style={styles.emptyBtnText}>Add First Case</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
      <PaywallSheet
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        featureName="Unlimited Cases"
      />
    </SafeAreaView>
  );
}
