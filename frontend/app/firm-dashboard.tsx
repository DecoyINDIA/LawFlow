import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../src/theme';
import { useApp } from '../src/context/AppContext';

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.m, paddingVertical: Spacing.s,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.headline, color: c.textPrimary },
  content: { padding: Spacing.m, paddingBottom: 48 },
  statRow: { flexDirection: 'row', gap: Spacing.s, marginBottom: Spacing.m },
  statCard: {
    flex: 1, backgroundColor: c.surface, borderRadius: Radius.m,
    padding: Spacing.m, alignItems: 'center',
  },
  statValue: { ...Typography.title1, color: c.textPrimary },
  statLabel: { ...Typography.caption1, color: c.textSecondary, marginTop: 4 },
  section: {
    backgroundColor: c.surface, borderRadius: Radius.m,
    padding: Spacing.m, marginBottom: Spacing.m,
  },
  sectionTitle: { ...Typography.headline, color: c.textPrimary, marginBottom: Spacing.s },
  memberCard: {
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    paddingVertical: Spacing.s,
  },
  memberCardLast: { borderBottomWidth: 0 },
  memberPhone: { ...Typography.body, fontWeight: '600' as const, color: c.textPrimary },
  memberRole: { ...Typography.caption1, color: c.textSecondary, marginTop: 2 },
  memberStats: {
    flexDirection: 'row', gap: Spacing.m, marginTop: Spacing.xs,
  },
  memberStat: { ...Typography.footnote, color: c.textSecondary },
  emptyText: { ...Typography.subhead, color: c.textTertiary, textAlign: 'center', paddingVertical: Spacing.l },
});

export default function FirmDashboardScreen() {
  const router = useRouter();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { loadFirmDashboard, firmDashboard } = useApp();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFirmDashboard().finally(() => setLoading(false));
  }, [loadFirmDashboard]);

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Feather name="arrow-left" size={22} color={c.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Firm Dashboard</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={c.textPrimary} />
        </View>
      </SafeAreaView>
    );
  }

  const data = firmDashboard as any;
  const firmInfo = data?.firm;
  const totalCases = data?.totalCases ?? 0;
  const totalHearings = data?.totalHearings ?? 0;
  const workload = data?.workload ?? {};
  const members: any[] = firmInfo?.members ?? [];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="dashboard-back">
          <Feather name="arrow-left" size={22} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Firm Dashboard</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {!data ? (
          <Text style={s.emptyText}>Dashboard unavailable. Only the firm owner can view this.</Text>
        ) : (
          <>
            <Text style={{ ...Typography.title2, color: c.textPrimary, marginBottom: Spacing.m }}>
              {firmInfo?.name ?? 'My Firm'}
            </Text>

            <View style={s.statRow}>
              <View style={s.statCard}>
                <Text style={s.statValue}>{totalCases}</Text>
                <Text style={s.statLabel}>Total Cases</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statValue}>{totalHearings}</Text>
                <Text style={s.statLabel}>Total Hearings</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statValue}>{members.length}</Text>
                <Text style={s.statLabel}>Members</Text>
              </View>
            </View>

            <View style={s.section}>
              <Text style={s.sectionTitle}>Team Workload</Text>
              {members.length === 0 ? (
                <Text style={s.emptyText}>No team members</Text>
              ) : (
                members.map((m: any, i: number) => {
                  const mw = workload[m.advocateId] ?? {};
                  return (
                    <View
                      key={m.advocateId || i}
                      style={[s.memberCard, i === members.length - 1 && s.memberCardLast]}
                    >
                      <Text style={s.memberPhone}>{m.name || m.phone}</Text>
                      <Text style={s.memberRole}>
                        {m.role === 'owner' ? 'Owner' : 'Junior Advocate'}
                      </Text>
                      <View style={s.memberStats}>
                        <Text style={s.memberStat}>
                          {mw.totalCases ?? 0} cases
                        </Text>
                        <Text style={s.memberStat}>
                          {mw.activeCases ?? 0} active
                        </Text>
                        <Text style={s.memberStat}>
                          {mw.totalHearings ?? 0} hearings
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
