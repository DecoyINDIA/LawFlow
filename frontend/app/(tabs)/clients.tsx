import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../../src/theme';
import { useApp } from '../../src/context/AppContext';
import { CFSearchBar } from '../../src/components/common/CFSearchBar';
import { Client } from '../../src/types';

const makeCardStyles = (c: ColorPalette) => StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.m, paddingVertical: Spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: c.textPrimary, alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.m,
  },
  avatarText: { fontSize: 15, fontWeight: '700', color: c.background },
  info: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  name: { ...Typography.subhead, fontWeight: '600', color: c.textPrimary },
  typeBadge: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: Radius.full, borderWidth: 1,
    borderColor: c.border, backgroundColor: c.surfaceHighlight,
  },
  typeBadgeText: { ...Typography.caption2, color: c.textSecondary },
  phone: { ...Typography.footnote, color: c.textSecondary },
  sub: { ...Typography.caption1, color: c.textTertiary },
  right: { alignItems: 'center', marginLeft: Spacing.m },
  caseCount: { ...Typography.headline, color: c.textPrimary },
  casesLabel: { ...Typography.caption2, color: c.textTertiary },
});

function ClientCard({ item, caseCount, onPress }: { item: Client; caseCount: number; onPress: () => void }) {
  const c = useColors();
  const styles = useMemo(() => makeCardStyles(c), [c]);
  const initials = item.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const typeLabel = item.clientType.charAt(0) + item.clientType.slice(1).toLowerCase();

  return (
    <TouchableOpacity
      testID={`client-card-${item.id}`}
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{typeLabel}</Text>
          </View>
        </View>
        <Text style={styles.phone}>{item.phone}</Text>
        <Text style={styles.sub}>{item.city ?? 'Location not set'}</Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.caseCount}>{caseCount}</Text>
        <Text style={styles.casesLabel}>cases</Text>
        <Feather name="chevron-right" size={14} color={c.textTertiary} />
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
  listBox: {
    flex: 1, backgroundColor: c.surface,
    marginHorizontal: Spacing.m, marginTop: Spacing.m,
    borderRadius: Radius.m, overflow: 'hidden',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyTitle: { ...Typography.headline, color: c.textPrimary, marginTop: Spacing.m },
  emptyText: { ...Typography.subhead, color: c.textSecondary, marginTop: 4, textAlign: 'center' },
  emptyBtn: {
    marginTop: Spacing.l, paddingHorizontal: Spacing.l, paddingVertical: Spacing.m,
    backgroundColor: c.textPrimary, borderRadius: Radius.m,
  },
  emptyBtnText: { ...Typography.subhead, fontWeight: '600', color: c.background },
  listFooter: { height: 100 },
});

export default function ClientsScreen() {
  const router = useRouter();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { clients, getCasesForClient } = useApp();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(() => {
    let r = clients.filter(x => x.isActive);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(x =>
        x.name.toLowerCase().includes(q) ||
        x.phone.includes(q) ||
        (x.city ?? '').toLowerCase().includes(q) ||
        (x.email ?? '').toLowerCase().includes(q)
      );
    }
    return r.sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, search]);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 500));
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Clients</Text>
          <TouchableOpacity
            testID="new-client-btn"
            style={styles.addBtn}
            onPress={() => router.push('/clients/new' as any)}
            activeOpacity={0.7}
          >
            <Feather name="plus" size={20} color={c.background} />
          </TouchableOpacity>
        </View>
        <CFSearchBar
          testID="clients-search"
          placeholder="Search clients…"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="users" size={48} color={c.textTertiary} />
          <Text style={styles.emptyTitle}>{search ? 'No Results' : 'No Clients Yet'}</Text>
          <Text style={styles.emptyText}>
            {search ? 'Try a different search' : 'Add your first client to get started'}
          </Text>
          {!search && (
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push('/clients/new' as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.emptyBtnText}>Add First Client</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.listBox}>
          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            ListFooterComponent={<View style={styles.listFooter} />}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.textPrimary} />
            }
            renderItem={({ item }) => (
              <ClientCard
                item={item}
                caseCount={getCasesForClient(item.id).length}
                onPress={() => router.push(`/clients/${item.id}` as any)}
              />
            )}
          />
        </View>
      )}
    </SafeAreaView>
  );
}
