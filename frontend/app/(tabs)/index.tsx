import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, ActivityIndicator,
  Alert, Linking, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../../src/theme';
import { useApp, SyncStatus } from '../../src/context/AppContext';
import { StatCard } from '../../src/components/dashboard/StatCard';
import { HearingCard } from '../../src/components/dashboard/HearingCard';
import { UpcomingHearingRow } from '../../src/components/dashboard/UpcomingHearingRow';
import { CFAvatar } from '../../src/components/common/CFAvatar';
import { printDashboardReport, printCauseList } from '../../src/utils/pdfReports';
import { applyTemplate } from '../../src/utils/messageTemplates';

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good Morning,';
  if (h >= 12 && h < 17) return 'Good Afternoon,';
  if (h >= 17 && h < 21) return 'Good Evening,';
  return 'Good Night,';
}

// ── Sync Status Icon ─────────────────────────────────────────────────────
function SyncIcon({ status, onRetry }: { status: SyncStatus; onRetry: () => void }) {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(true);
  const prevStatus = useRef(status);

  useEffect(() => {
    if (status === 'syncing') {
      setVisible(true);
      Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
      ).start();
    } else {
      spinAnim.stopAnimation();
      spinAnim.setValue(0);
      if (status === 'synced' && prevStatus.current !== 'synced') {
        setVisible(true);
        const t = setTimeout(() => setVisible(false), 2000);
        return () => clearTimeout(t);
      } else if (status === 'offline' || status === 'error') {
        setVisible(true);
      }
    }
    prevStatus.current = status;
  }, [status]);

  if (!visible) return null;

  const rotate = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  if (status === 'syncing') {
    return (
      <Animated.Text
        testID="sync-status-icon"
        style={{ fontSize: 16, transform: [{ rotate }] }}
      >
        🔄
      </Animated.Text>
    );
  }
  if (status === 'synced') {
    return (
      <Text testID="sync-status-icon" style={{ fontSize: 16 }}>☁️</Text>
    );
  }
  // offline or error — show tappable Retry button
  return (
    <TouchableOpacity
      testID="sync-retry-btn"
      onPress={onRetry}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
    >
      <Text style={{ fontSize: 13, color: '#FF9500', fontWeight: '600' }}>⚠️ Retry</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  scrollContent: { paddingBottom: 32 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.m,
    paddingTop: Spacing.s,
    paddingBottom: Spacing.m,
  },
  greetingBox: { flex: 1, marginRight: Spacing.s },
  greeting: { ...Typography.subhead, color: c.textSecondary },
  name: { ...Typography.title2, color: c.textPrimary },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: c.textPrimary,
    borderWidth: 1.5,
    borderColor: c.background,
    zIndex: 1,
  },

  statRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.m,
    gap: Spacing.s,
    marginBottom: Spacing.l,
  },
  freeBanner: {
    marginHorizontal: Spacing.m,
    marginBottom: Spacing.m,
    backgroundColor: c.surface,
    borderRadius: Radius.m,
    paddingHorizontal: Spacing.m,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: c.border,
  },
  freeBannerText: { ...Typography.caption1, color: c.textSecondary },
  freeBannerCta: { ...Typography.caption1, color: '#FF9500', fontWeight: '600' },

  missedCard: {
    marginHorizontal: Spacing.m,
    marginBottom: Spacing.l,
    backgroundColor: c.surface,
    borderRadius: Radius.m,
    padding: Spacing.m,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 2.5,
    borderLeftColor: c.textPrimary,
  },
  missedLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.s },
  missedTitle: { ...Typography.subhead, fontWeight: '600', color: c.textPrimary },
  missedRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  missedSub: { ...Typography.caption1, color: c.textSecondary },

  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.m,
    marginBottom: Spacing.m,
  },
  sectionTitle: { ...Typography.title3, color: c.textPrimary },
  seeAll: { ...Typography.subhead, color: c.textSecondary },

  emptyBox: {
    marginHorizontal: Spacing.m,
    backgroundColor: c.surface,
    borderRadius: Radius.m,
    paddingVertical: Spacing.l,
    alignItems: 'center',
    marginBottom: Spacing.s,
  },
  emptyText: { ...Typography.subhead, color: c.textSecondary },

  toggle: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderRadius: Radius.full,
    padding: 3,
  },
  tBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  tBtnOn: { backgroundColor: c.textPrimary },
  tText: { ...Typography.caption1, fontWeight: '600', color: c.textSecondary },
  tTextOn: { color: c.background },

  upcomingBox: {
    marginHorizontal: Spacing.m,
    backgroundColor: c.background,
    borderRadius: Radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    overflow: 'hidden',
  },
  emptyUpcoming: {
    paddingVertical: Spacing.l,
    alignItems: 'center',
  },

  todayCaseCard: {
    marginHorizontal: Spacing.m,
    marginBottom: Spacing.s,
    backgroundColor: c.surface,
    borderRadius: Radius.m,
    padding: Spacing.m,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  todayCaseLeft: { flex: 1, gap: 2 },
  todayCaseNum: { ...Typography.caption1, color: c.textTertiary, letterSpacing: 0.5 },
  todayCaseTitle: { ...Typography.subhead, fontWeight: '600', color: c.textPrimary },
  todayCaseCourt: { ...Typography.footnote, color: c.textSecondary },

  upcomingCaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  upcomingCaseRowLast: { borderBottomWidth: 0 },
  upcomingCaseDate: {
    width: 40,
    alignItems: 'center',
    marginRight: Spacing.m,
  },
  upcomingCaseDateNum: { ...Typography.headline, color: c.textPrimary },
  upcomingCaseDateMonth: { ...Typography.caption2, color: c.textSecondary, textTransform: 'uppercase' },
  upcomingCaseInfo: { flex: 1, gap: 2 },
  upcomingCaseTitle: { ...Typography.subhead, color: c.textPrimary },
  upcomingCaseCourt: { ...Typography.caption1, color: c.textSecondary },

  // At-Risk Section (accent colors stay as-is per design)
  atRiskSection: {
    marginHorizontal: Spacing.m,
    marginBottom: Spacing.l,
    borderRadius: Radius.m,
    borderWidth: 1,
    borderColor: '#FF9500',
    overflow: 'hidden',
  },
  atRiskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF8EE',
    paddingHorizontal: Spacing.m,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FF9500',
  },
  atRiskTitle: { fontSize: 12, fontWeight: '700', color: '#FF9500', letterSpacing: 0.5 },
  atRiskCount: { fontSize: 12, color: '#FF9500', fontWeight: '500' },
  atRiskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.m,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#FFE0B2',
    backgroundColor: c.background,
  },
  atRiskLeft: { flex: 1, marginRight: Spacing.m },
  atRiskCaseNum: { fontSize: 12, fontWeight: '700', color: c.textPrimary, letterSpacing: 0.3 },
  atRiskCourt: { fontSize: 11, color: c.textSecondary, marginTop: 2 },
  reasonBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1 },
  reasonRed: { backgroundColor: '#FFF0F0', borderColor: '#FF3B30' },
  reasonOrange: { backgroundColor: '#FFF8EE', borderColor: '#FF9500' },
  reasonGray: { backgroundColor: c.surface, borderColor: c.border },
  reasonText: { fontSize: 10, fontWeight: '600', color: '#FF9500' },
  reasonTextRed: { color: '#FF3B30' },
  atRiskViewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    backgroundColor: '#FFF8EE',
  },
  atRiskViewAllText: { fontSize: 12, fontWeight: '600', color: '#FF9500' },

  // Tomorrow's Hearings Card
  tmCard: {
    marginHorizontal: Spacing.m,
    marginBottom: Spacing.l,
    backgroundColor: c.surface,
    borderRadius: Radius.m,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
  },
  tmHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.m, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  tmTitle: { fontSize: 13, fontWeight: '700', color: c.textPrimary },
  tmViewAll: { fontSize: 12, fontWeight: '600', color: c.textSecondary },
  bulkBtn: {
    paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: '#E8F5E9', borderRadius: Radius.s,
  },
  bulkBtnText: { fontSize: 11, fontWeight: '700', color: '#25D366' },
  tmRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.m, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    gap: Spacing.m,
  },
  tmInfo: { flex: 1 },
  tmCaseNum: { fontSize: 12, fontWeight: '700', color: c.textPrimary, letterSpacing: 0.3 },
  tmCourt: { fontSize: 11, color: c.textSecondary, marginTop: 2 },
  tmPurpose: { fontSize: 11, color: c.textTertiary, marginTop: 1 },
  tmWaBtn: {
    borderWidth: 1, borderColor: c.textSecondary,
    borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5,
  },
  tmWaBtnText: { fontSize: 11, fontWeight: '600', color: c.textSecondary },
  tmMore: { paddingHorizontal: Spacing.m, paddingVertical: 10 },
  tmMoreText: { fontSize: 12, color: c.textSecondary },
});

export default function DashboardScreen() {
  const router = useRouter();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState<'7' | '30'>('7');
  const [printing, setPrinting] = useState(false);

  const {
    cases, clients, hearings, getTodayHearings, getUpcomingHearings, getMissedHearings,
    getActiveStats, advocateName, advocateProfile, unreadNotificationCount, sendWhatsAppMessage, syncStatus,
    retrySyncAll, isProUser, inboxUnreadCount,
  } = useApp();

  const todayHearings = getTodayHearings();
  const upcomingHearings = getUpcomingHearings(range === '7' ? 7 : 30);
  const missedHearings = getMissedHearings();
  const stats = getActiveStats();

  const todayFromCases = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const endMs = todayMs + 86400000;
    return cases.filter(c =>
      c.nextHearingDate &&
      c.nextHearingDate >= todayMs &&
      c.nextHearingDate < endMs
    );
  }, [cases]);

  const upcomingFromCases = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startMs = today.getTime() + 86400000;
    const endMs = startMs + (range === '7' ? 7 : 30) * 86400000;
    const coveredCaseIds = new Set(upcomingHearings.map((item: any) => item.case.id));
    return cases
      .filter(c => c.nextHearingDate && c.nextHearingDate >= startMs && c.nextHearingDate <= endMs && !coveredCaseIds.has(c.id))
      .sort((a, b) => (a.nextHearingDate ?? 0) - (b.nextHearingDate ?? 0));
  }, [cases, range, upcomingHearings]);

  const atRiskCases = useMemo(() => {
    const now = Date.now();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const thirtyDaysAgo = now - 30 * 86400000;

    type RiskReason = 'Missed Hearing' | 'No Next Date' | '30d Inactive';
    const result: Array<{ id: string; caseNumber: string; courtName: string; reason: RiskReason }> = [];

    cases.forEach(c => {
      if (!c.isActive || c.status === 'DISPOSED') return;
      const caseHearings = hearings.filter(h => h.caseId === c.id);

      const hasMissed = caseHearings.some(h => h.hearingDate < todayMs && !h.outcome);
      if (hasMissed) {
        result.push({ id: c.id, caseNumber: c.caseNumber, courtName: c.courtName, reason: 'Missed Hearing' });
        return;
      }
      if (c.status === 'ACTIVE' && !c.nextHearingDate) {
        result.push({ id: c.id, caseNumber: c.caseNumber, courtName: c.courtName, reason: 'No Next Date' });
        return;
      }
      const lastHearing = caseHearings.length > 0 ? Math.max(...caseHearings.map(h => h.hearingDate)) : 0;
      const lastActivity = Math.max(c.updatedAt, lastHearing);
      if (lastActivity < thirtyDaysAgo) {
        result.push({ id: c.id, caseNumber: c.caseNumber, courtName: c.courtName, reason: '30d Inactive' });
      }
    });
    return result;
  }, [cases, hearings]);

  const tomorrowHearings = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tmStart = today.getTime() + 86400000;
    const tmEnd = tmStart + 86400000;
    return hearings
      .filter(h => h.hearingDate >= tmStart && h.hearingDate < tmEnd)
      .sort((a, b) => a.hearingDate - b.hearingDate)
      .map(h => { const c = cases.find(x => x.id === h.caseId); return c ? { hearing: h, case: c } : null; })
      .filter(Boolean) as Array<{ hearing: any; case: any }>;
  }, [hearings, cases]);

  // ── Feature 1: Daily Briefing ──────────────────────────────────────
  const handleSendBriefing = async () => {
    const caseIdsInHearings = new Set(todayHearings.map(h => h.case.id));
    const briefingItems: Array<{ case: any; hearing: any }> = [
      ...todayHearings,
      ...todayFromCases
        .filter(c => !caseIdsInHearings.has(c.id))
        .map(c => ({ case: c, hearing: null })),
    ];

    if (briefingItems.length === 0) {
      Alert.alert('No Hearings Today', 'You have no hearings scheduled for today.');
      return;
    }

    const dateStr = new Date().toLocaleDateString('en-IN', {
      weekday: 'long', day: '2-digit', month: 'short', year: 'numeric',
    });

    const name = (advocateName || '').trim() || 'the Advocate';
    let msg = `📋 Daily Briefing — ${dateStr}\n${name}\n\nToday's Hearings: ${briefingItems.length}\n\n`;
    briefingItems.forEach((item, i) => {
      msg += `${i + 1}. ${item.case.caseNumber} — ${item.case.courtName}\n`;
      const parts: string[] = [];
      if (item.hearing?.purpose) parts.push(item.hearing.purpose);
      if (item.hearing?.hearingTime) parts.push(item.hearing.hearingTime);
      if (parts.length > 0) msg += `   ${parts.join(' | ')}\n`;
    });
    msg += `\nSent via LawFlow`;

    const waUrl = `whatsapp://send?text=${encodeURIComponent(msg)}`;
    const waWebUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    try {
      const canOpen = await Linking.canOpenURL(waUrl);
      await Linking.openURL(canOpen ? waUrl : waWebUrl);
    } catch {
      await Linking.openURL(waWebUrl);
    }
  };

  const handleWhatsAppReminder = (caseData: any, hearing: any) => {
    const client = clients.find(c => c.id === caseData.clientId);
    if (!client?.phone) return;
    const dateStr = new Date(hearing.hearingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const message = applyTemplate('hearing_reminder' as any, {
      clientName: client.name,
      caseNumber: caseData.caseNumber,
      courtName: caseData.courtName,
      nextHearingDate: dateStr,
      nextHearingTime: hearing.hearingTime ?? '',
      advocateName,
    });
    sendWhatsAppMessage(client.phone, message);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 500));
    setRefreshing(false);
  };

  const handlePrint = async () => {
    setPrinting(true);
    const todayItems = getTodayHearings();
    const causeListItems = todayItems.map(item => ({
      case: item.case,
      hearing: item.hearing,
      client: clients.find(cl => cl.id === item.case.clientId) ?? null,
    }));
    const riskIds = atRiskCases.map(r => r.id);
    await printCauseList({
      advocate: {
        advocateName: advocateProfile.name,
        barCouncil: advocateProfile.barCouncil,
        enrollmentNumber: advocateProfile.enrollmentNumber,
        phone: advocateProfile.phone,
        email: advocateProfile.email,
      },
      todayHearings: causeListItems,
      atRiskCaseIds: riskIds,
    });
    setPrinting(false);
  };

  const handleCasePress = (caseId: string) => {
    router.push(`/cases/${caseId}` as any);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.textPrimary}
          />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.greetingBox}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.name} numberOfLines={1}>{advocateName}</Text>
          </View>
          <View style={styles.actions}>
            <SyncIcon status={syncStatus} onRetry={retrySyncAll} />
            <TouchableOpacity
              testID="search-btn"
              style={styles.iconBtn}
              activeOpacity={0.6}
              onPress={() => router.push('/search' as any)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="search" size={20} color={c.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              testID="gift-refer-btn"
              style={styles.iconBtn}
              activeOpacity={0.6}
              onPress={() => router.push('/(tabs)/more?scrollTo=refer' as any)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="gift-outline" size={22} color={c.textPrimary} />
            </TouchableOpacity>
            <View>
              <TouchableOpacity
                testID="notifications-btn"
                style={styles.iconBtn}
                activeOpacity={0.6}
                onPress={() => router.push('/notifications' as any)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="bell" size={20} color={c.textPrimary} />
              </TouchableOpacity>
              {(unreadNotificationCount + inboxUnreadCount) > 0 && <View style={styles.notifBadge} />}
            </View>
            <CFAvatar
              testID="avatar-btn"
              name={advocateName}
              size={36}
              onPress={() => {}}
            />
          </View>
        </View>

        {/* ── Stat Strip ── */}
        <View style={styles.statRow}>
          <StatCard label="Today" count={stats.today + todayFromCases.length} />
          <StatCard label="This Week" count={stats.thisWeek} />
          <StatCard label="Active Cases" count={stats.active} />
        </View>

        {/* Phase 27 — Free tier usage banner */}
        {!isProUser && (
          <TouchableOpacity
            testID="pro-upgrade-banner"
            style={styles.freeBanner}
            onPress={() => router.push('/upgrade' as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.freeBannerText}>
              {cases.length}/10 cases · {clients.length}/10 clients
            </Text>
            <Text style={styles.freeBannerCta}>Get Pro →</Text>
          </TouchableOpacity>
        )}

        {/* ── At-Risk Cases ── */}
        {atRiskCases.length > 0 && (
          <View style={styles.atRiskSection}>
            <View style={styles.atRiskHeader}>
              <Text style={styles.atRiskTitle}>⚠ NEEDS ATTENTION</Text>
              <Text style={styles.atRiskCount}>{atRiskCases.length} case{atRiskCases.length !== 1 ? 's' : ''}</Text>
            </View>
            {atRiskCases.slice(0, 3).map(item => (
              <TouchableOpacity
                key={item.id}
                testID={`at-risk-${item.id}`}
                style={styles.atRiskCard}
                onPress={() => router.push(`/cases/${item.id}` as any)}
                activeOpacity={0.7}
              >
                <View style={styles.atRiskLeft}>
                  <Text style={styles.atRiskCaseNum}>{item.caseNumber}</Text>
                  <Text style={styles.atRiskCourt} numberOfLines={1}>{item.courtName}</Text>
                </View>
                <View style={[
                  styles.reasonBadge,
                  item.reason === 'Missed Hearing' && styles.reasonRed,
                  item.reason === 'No Next Date' && styles.reasonOrange,
                  item.reason === '30d Inactive' && styles.reasonGray,
                ]}>
                  <Text style={[
                    styles.reasonText,
                    item.reason === 'Missed Hearing' && styles.reasonTextRed,
                  ]}>{item.reason}</Text>
                </View>
              </TouchableOpacity>
            ))}
            {atRiskCases.length > 3 && (
              <TouchableOpacity
                style={styles.atRiskViewAll}
                onPress={() => router.push('/(tabs)/cases' as any)}
                activeOpacity={0.7}
              >
                <Text style={styles.atRiskViewAllText}>View all {atRiskCases.length}</Text>
                <Feather name="chevron-right" size={13} color="#FF9500" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Tomorrow's Hearings Card ── */}
        {tomorrowHearings.length > 0 && (
          <View style={styles.tmCard} testID="tomorrow-card">
            <View style={styles.tmHeader}>
              <Text style={styles.tmTitle}>📋 Tomorrow's Hearings</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.s }}>
                <TouchableOpacity
                  testID="bulk-reminders-btn"
                  onPress={() => router.push('/bulk-reminders' as any)}
                  activeOpacity={0.7}
                  style={styles.bulkBtn}
                >
                  <Text style={styles.bulkBtnText}>📤 Bulk Remind</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/(tabs)/calendar' as any)} activeOpacity={0.7}>
                  <Text style={styles.tmViewAll}>View All</Text>
                </TouchableOpacity>
              </View>
            </View>
            {tomorrowHearings.slice(0, 2).map(({ hearing, case: cas }) => {
              const client = clients.find(cl => cl.id === cas.clientId);
              return (
                <View key={hearing.id} style={styles.tmRow}>
                  <View style={styles.tmInfo}>
                    <Text style={styles.tmCaseNum}>{cas.caseNumber}</Text>
                    <Text style={styles.tmCourt} numberOfLines={1}>{cas.courtName}</Text>
                    <Text style={styles.tmPurpose} numberOfLines={1}>{hearing.purpose || 'Hearing'}</Text>
                  </View>
                  {client?.phone ? (
                    <TouchableOpacity
                      testID={`whatsapp-remind-${hearing.id}`}
                      style={styles.tmWaBtn}
                      onPress={() => handleWhatsAppReminder(cas, hearing)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.tmWaBtnText}>💬 Remind Client</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
            {tomorrowHearings.length > 2 && (
              <TouchableOpacity
                style={styles.tmMore}
                onPress={() => router.push('/(tabs)/calendar' as any)}
                activeOpacity={0.7}
              >
                <Text style={styles.tmMoreText}>+ {tomorrowHearings.length - 2} more</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Missed Hearings Alert ── */}
        {missedHearings.length > 0 && (
          <TouchableOpacity
            testID="missed-alert"
            style={styles.missedCard}
            activeOpacity={0.8}
          >
            <View style={styles.missedLeft}>
              <Feather name="alert-circle" size={15} color={c.textPrimary} />
              <Text style={styles.missedTitle}>
                {missedHearings.length} Missed Hearing{missedHearings.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <View style={styles.missedRight}>
              <Text style={styles.missedSub}>Requires outcome</Text>
              <Feather name="chevron-right" size={13} color={c.textSecondary} />
            </View>
          </TouchableOpacity>
        )}

        {/* ── Today's Hearings ── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Today's Hearings</Text>
          <TouchableOpacity testID="see-all-today" activeOpacity={0.6}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>

        {todayHearings.length === 0 && todayFromCases.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No hearings scheduled today</Text>
          </View>
        ) : (
          <>
            {todayHearings.map(item => (
              <HearingCard
                key={item.hearing.id}
                item={item}
                showRecordOutcome
                onPress={() => handleCasePress(item.case.id)}
                onRecordOutcome={() => {}}
              />
            ))}
            {todayFromCases.map(caseItem => (
              <TouchableOpacity
                key={caseItem.id}
                style={styles.todayCaseCard}
                onPress={() => handleCasePress(caseItem.id)}
                activeOpacity={0.7}
              >
                <View style={styles.todayCaseLeft}>
                  <Text style={styles.todayCaseNum}>{caseItem.caseNumber}</Text>
                  <Text style={styles.todayCaseTitle} numberOfLines={1}>{caseItem.title}</Text>
                  <Text style={styles.todayCaseCourt}>{caseItem.courtName}</Text>
                </View>
                <Feather name="chevron-right" size={16} color={c.textTertiary} />
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* ── Upcoming Hearings ── */}
        <View style={[styles.sectionRow, { marginTop: Spacing.l }]}>
          <Text style={styles.sectionTitle}>Upcoming</Text>
          <View style={styles.toggle}>
            <TouchableOpacity
              testID="toggle-7d"
              onPress={() => setRange('7')}
              style={[styles.tBtn, range === '7' && styles.tBtnOn]}
              activeOpacity={0.7}
            >
              <Text style={[styles.tText, range === '7' && styles.tTextOn]}>7 Days</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="toggle-30d"
              onPress={() => setRange('30')}
              style={[styles.tBtn, range === '30' && styles.tBtnOn]}
              activeOpacity={0.7}
            >
              <Text style={[styles.tText, range === '30' && styles.tTextOn]}>30 Days</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.upcomingBox}>
          {upcomingHearings.length === 0 && upcomingFromCases.length === 0 ? (
            <View style={styles.emptyUpcoming}>
              <Text style={styles.emptyText}>No upcoming hearings</Text>
            </View>
          ) : (
            <>
              {upcomingHearings.map((item, idx) => (
                <UpcomingHearingRow
                  key={item.hearing.id}
                  item={item}
                  onPress={() => handleCasePress(item.case.id)}
                  isLast={idx === upcomingHearings.length - 1 && upcomingFromCases.length === 0}
                />
              ))}
              {upcomingFromCases.map((caseItem, idx) => (
                <TouchableOpacity
                  key={caseItem.id}
                  style={[
                    styles.upcomingCaseRow,
                    idx === upcomingFromCases.length - 1 && styles.upcomingCaseRowLast
                  ]}
                  onPress={() => handleCasePress(caseItem.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.upcomingCaseDate}>
                    <Text style={styles.upcomingCaseDateNum}>
                      {caseItem.nextHearingDate ? new Date(caseItem.nextHearingDate).getDate() : '—'}
                    </Text>
                    <Text style={styles.upcomingCaseDateMonth}>
                      {caseItem.nextHearingDate
                        ? new Date(caseItem.nextHearingDate).toLocaleString('en-US', { month: 'short' })
                        : ''}
                    </Text>
                  </View>
                  <View style={styles.upcomingCaseInfo}>
                    <Text style={styles.upcomingCaseTitle} numberOfLines={1}>{caseItem.title}</Text>
                    <Text style={styles.upcomingCaseCourt}>{caseItem.courtName}</Text>
                  </View>
                  <Feather name="chevron-right" size={14} color={c.textTertiary} />
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
