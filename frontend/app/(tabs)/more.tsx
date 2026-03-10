import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Animated, Modal, Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../../src/theme';
import { useApp } from '../../src/context/AppContext';
import { PaywallSheet } from '../../src/components/PaywallSheet';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const WARNING = '#FF9500';
const SUCCESS = '#34C759';
const DESTRUCTIVE = '#FF3B30';

function fmtExpiry(expiry: string | null): string {
  if (!expiry) return '';
  const d = new Date(expiry);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function isExpiryWithin30Days(expiry: string | null): boolean {
  if (!expiry) return false;
  const diff = new Date(expiry).getTime() - Date.now();
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
}

function isGracePeriod(expiry: string | null): boolean {
  if (!expiry) return false;
  const diff = new Date(expiry).getTime() - Date.now();
  return diff < 0 && diff > -3 * 24 * 60 * 60 * 1000;
}

function fmtHistoryEntry(entry: any): string {
  const d = new Date(entry.paidAt);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dateStr = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  const amt = entry.period === 'yearly' ? '₹999' : '₹99';
  const period = entry.period === 'yearly' ? 'Yearly' : 'Monthly';
  return `Pro · ${period} · ${dateStr} · ${amt}`;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

interface RowProps {
  label: string;
  sub?: string;
  onPress: () => void;
  danger?: boolean;
  testID?: string;
  isLast?: boolean;
}

function MenuRow({ label, sub, onPress, danger, testID, isLast }: RowProps) {
  const c = useColors();
  const scale = React.useRef(new Animated.Value(1)).current;
  const animate = (toValue: number) =>
    Animated.timing(scale, { toValue, duration: 150, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        testID={testID}
        style={[
          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.m, paddingVertical: 14, minHeight: 48, gap: Spacing.m },
          !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
        ]}
        onPress={onPress}
        onPressIn={() => animate(0.98)}
        onPressOut={() => animate(1)}
        activeOpacity={1}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ ...Typography.subhead, fontWeight: '500', fontSize: 14, color: danger ? DESTRUCTIVE : c.textPrimary }}>{label}</Text>
          {sub ? <Text style={{ ...Typography.caption1, color: c.textSecondary, marginTop: 2 }}>{sub}</Text> : null}
        </View>
        <Feather
          name="chevron-right"
          size={15}
          color={danger ? DESTRUCTIVE : c.textTertiary}
        />
      </TouchableOpacity>
    </Animated.View>
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
  title: { ...Typography.largeTitle, color: c.textPrimary },
  content: { paddingHorizontal: Spacing.m, paddingBottom: 32 },

  profileStrip: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.l, gap: Spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    marginBottom: Spacing.s,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: c.textPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: c.background, letterSpacing: 0.5 },
  profileInfo: { flex: 1 },
  profileName: { ...Typography.headline, color: c.textPrimary },
  profileSub: { ...Typography.footnote, color: c.textSecondary, marginTop: 2 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: c.textSecondary,
    letterSpacing: 0.8, marginBottom: Spacing.s, marginTop: Spacing.l,
    paddingTop: Spacing.xs,
  },
  section: {
    backgroundColor: c.surface,
    borderRadius: Radius.m,
    overflow: 'hidden',
  },

  // Phase 27 — Plan card styles
  planCard: {
    backgroundColor: c.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    padding: Spacing.m,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.m,
    marginTop: Spacing.m,
  },
  planCardGrace: {
    borderColor: DESTRUCTIVE,
  },
  planCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planCardBody: { flex: 1 },
  planCardTitle: { ...Typography.subhead, fontWeight: '700', color: c.textPrimary },
  planCardTitleGrace: { color: DESTRUCTIVE },
  planCardSub: { ...Typography.caption1, color: c.textSecondary, marginTop: 2 },
  planCardCta: { ...Typography.caption1, color: WARNING, fontWeight: '700' },

  activePill: {
    backgroundColor: SUCCESS + '22',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  activePillText: { ...Typography.caption2, color: SUCCESS, fontWeight: '700' },

  // Payment history modal
  historyModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  historySheet: {
    backgroundColor: c.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.m,
    maxHeight: 400,
  },
  historyTitle: { ...Typography.headline, color: c.textPrimary, marginBottom: Spacing.m },
  historyItem: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  historyItemText: { ...Typography.subhead, color: c.textPrimary },
  historyCloseBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  historyCloseBtnText: { ...Typography.subhead, color: c.textSecondary },

  // Refer a Friend
  referralCode: { ...Typography.largeTitle, fontWeight: '800', color: c.textPrimary, letterSpacing: 3, textAlign: 'center', marginBottom: 4 },
  referralSubtext: { ...Typography.caption1, color: c.textSecondary, textAlign: 'center', marginBottom: Spacing.m },
  referralBtns: { flexDirection: 'row', gap: 10, marginBottom: Spacing.s },
  referralWA: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#25D366', borderRadius: Radius.m, paddingVertical: 10 },
  referralWAText: { ...Typography.subhead, color: '#fff', fontWeight: '600' },
  referralCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.surface, borderRadius: Radius.m, paddingVertical: 10, borderWidth: 1, borderColor: c.border },
  referralCopyText: { ...Typography.subhead, color: c.textPrimary, fontWeight: '600' },
  referralStats: { ...Typography.caption1, color: c.textSecondary, textAlign: 'center', marginTop: Spacing.xs },
});

export default function MoreScreen() {
  const router = useRouter();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { advocateProfile, signOut, isProUser, userPlan, planExpiry, planHistory, referralCode, authToken } = useApp();
  const params = useLocalSearchParams<{ scrollTo?: string }>();
  const scrollViewRef = useRef<ScrollView>(null);
  const referSectionRef = useRef<View>(null);
  const [referHighlight, setReferHighlight] = useState(false);
  const [referralStats, setReferralStats] = useState<{ totalReferred: number; totalRewarded: number }>({ totalReferred: 0, totalRewarded: 0 });
  const [copied, setCopied] = useState(false);
  const [showFirmPaywall, setShowFirmPaywall] = useState(false);

  useEffect(() => {
    if (!authToken) return;
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
    fetch(`${backendUrl}/api/referral/stats`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(r => r.json())
      .then(d => { if (d.totalReferred !== undefined) setReferralStats(d); })
      .catch(() => setReferralStats({ totalReferred: 0, totalRewarded: 0 }));
  }, [authToken]);

  // Scroll to Refer a Friend section when navigated via gift icon
  useEffect(() => {
    if (params.scrollTo === 'refer') {
      setTimeout(() => {
        if (referSectionRef.current && scrollViewRef.current) {
          referSectionRef.current.measureLayout(
            scrollViewRef.current as any,
            (_x: number, y: number) => { scrollViewRef.current?.scrollTo({ y, animated: true }); },
            () => {}
          );
        }
        setReferHighlight(true);
        setTimeout(() => setReferHighlight(false), 700);
      }, 350);
    }
  }, [params.scrollTo]);

  const handleCopyCode = useCallback(async () => {
    if (!referralCode) return;
    await Clipboard.setStringAsync(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [referralCode]);

  const handleShareWhatsApp = useCallback(() => {
    if (!referralCode) return;
    const msg = `Hey! I use LawFlow to manage my legal practice. Use my code ${referralCode} when signing up and get bonus days on Pro! Download: https://lawflow.in`;
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg)}`).catch(() =>
      Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`)
    );
  }, [referralCode]);
  const initials = getInitials(advocateProfile.name);
  const [showHistory, setShowHistory] = useState(false);

  const grace = isGracePeriod(planExpiry);
  const within30 = isExpiryWithin30Days(planExpiry);

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      // Alert.alert is blocked in browser iframes — logout directly on web
      signOut().then(() => router.replace('/login' as any));
      return;
    }
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/login' as any);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>More</Text>
      </View>

      <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Profile mini-header */}
        <TouchableOpacity
          style={styles.profileStrip}
          onPress={() => router.push('/profile' as any)}
          activeOpacity={0.8}
          testID="profile-strip"
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{advocateProfile.name}</Text>
            <Text style={styles.profileSub}>
              {[advocateProfile.enrollmentNumber, advocateProfile.designation].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Feather name="chevron-right" size={16} color={c.textTertiary} />
        </TouchableOpacity>

        {/* Phase 27 — Plan section */}
        {isProUser && !grace ? (
          <>
            <Text style={styles.sectionLabel}>MY PLAN</Text>
            <View style={styles.section}>
              {/* Row 1: Pro Plan + expiry + Active pill */}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.m, paddingVertical: 14, gap: Spacing.s }}>
                <Feather name="award" size={18} color={SUCCESS} />
                <View style={{ flex: 1, marginLeft: Spacing.s }}>
                  <Text style={{ ...Typography.subhead, fontWeight: '600', color: c.textPrimary }}>Pro Plan</Text>
                  {planExpiry && <Text style={{ ...Typography.caption1, color: c.textSecondary }}>Expires {fmtExpiry(planExpiry)}</Text>}
                </View>
                <View style={styles.activePill}>
                  <Text style={styles.activePillText}>Active</Text>
                </View>
              </View>
              {/* Row 2: Renew if expiry within 30 days */}
              {within30 && (
                <TouchableOpacity
                  testID="renew-subscription-btn"
                  onPress={() => router.push('/upgrade' as any)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.m, paddingVertical: 14, gap: Spacing.s, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }}
                >
                  <Feather name="refresh-cw" size={16} color={WARNING} />
                  <Text style={{ ...Typography.subhead, color: c.textPrimary, flex: 1, marginLeft: Spacing.s }}>Renew Subscription</Text>
                  <Feather name="chevron-right" size={15} color={c.textTertiary} />
                </TouchableOpacity>
              )}
              {/* Row 3: Payment History */}
              <TouchableOpacity
                testID="payment-history-btn"
                onPress={() => setShowHistory(true)}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.m, paddingVertical: 14, gap: Spacing.s, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }}
              >
                <Feather name="clock" size={16} color={c.textSecondary} />
                <Text style={{ ...Typography.subhead, color: c.textPrimary, flex: 1, marginLeft: Spacing.s }}>Payment History</Text>
                <Feather name="chevron-right" size={15} color={c.textTertiary} />
              </TouchableOpacity>
            </View>
          </>
        ) : grace ? (
          // Grace period — expired within 3 days
          <TouchableOpacity
            testID="grace-period-card"
            style={[styles.planCard, styles.planCardGrace]}
            onPress={() => router.push('/upgrade' as any)}
            activeOpacity={0.8}
          >
            <View style={styles.planCardIcon}>
              <Feather name="alert-circle" size={22} color={DESTRUCTIVE} />
            </View>
            <View style={styles.planCardBody}>
              <Text style={[styles.planCardTitle, styles.planCardTitleGrace]}>Pro Expired</Text>
              <Text style={styles.planCardSub}>Renew now to keep your Pro features</Text>
            </View>
            <Feather name="chevron-right" size={15} color={DESTRUCTIVE} />
          </TouchableOpacity>
        ) : (
          // Free user — Get Pro card
          <TouchableOpacity
            testID="get-pro-card"
            style={styles.planCard}
            onPress={() => router.push('/upgrade' as any)}
            activeOpacity={0.8}
          >
            <View style={styles.planCardIcon}>
              <Feather name="award" size={22} color={WARNING} />
            </View>
            <View style={styles.planCardBody}>
              <Text style={styles.planCardTitle}>Get Pro</Text>
              <Text style={styles.planCardSub}>Unlock unlimited cases, eCourts sync, PDF reports & more</Text>
            </View>
            <Text style={styles.planCardCta}>₹99/mo →</Text>
          </TouchableOpacity>
        )}

        {/* REFER A FRIEND */}
        <Text style={styles.sectionLabel}>REFER A FRIEND</Text>
        <View testID="refer-friend-card" style={[styles.section, { paddingVertical: Spacing.m, paddingHorizontal: Spacing.m }]}>
          <Text testID="referral-code-display" style={styles.referralCode}>{referralCode || '——'}</Text>
          <Text style={styles.referralSubtext}>Share your code · Earn 1 month free when they go Pro</Text>
          <View style={styles.referralBtns}>
            <TouchableOpacity
              testID="referral-whatsapp-btn"
              style={styles.referralWA}
              onPress={handleShareWhatsApp}
              activeOpacity={0.8}
            >
              <Feather name="message-circle" size={16} color="#fff" />
              <Text style={styles.referralWAText}>Share via WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="referral-copy-btn"
              style={styles.referralCopy}
              onPress={handleCopyCode}
              activeOpacity={0.8}
            >
              <Feather name={copied ? 'check' : 'copy'} size={16} color={c.textPrimary} />
              <Text style={styles.referralCopyText}>{copied ? 'Copied!' : 'Copy Code'}</Text>
            </TouchableOpacity>
          </View>
          <Text testID="referral-stats-text" style={styles.referralStats}>
            {`${referralStats.totalReferred} advocates referred · ${referralStats.totalRewarded} rewards earned`}
          </Text>
        </View>

        {/* ACCOUNT */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.section}>
          <MenuRow testID="menu-profile" label="My Profile" sub="Edit your advocate details" onPress={() => router.push('/profile' as any)} />
          <MenuRow testID="menu-settings" label="Settings" sub="Appearance, notifications & data" onPress={() => router.push('/settings' as any)} isLast />
        </View>

        {/* FIRM & PORTAL */}
        <Text style={styles.sectionLabel}>FIRM & SHARING</Text>
        <View style={styles.section}>
          <MenuRow
            testID="menu-firm"
            label="Law Firm"
            sub={isProUser ? "Manage your firm & team" : "Pro feature \u00b7 Upgrade to unlock"}
            onPress={() => {
              if (!isProUser) {
                setShowFirmPaywall(true);
                return;
              }
              router.push('/firm' as any);
            }}
          />
          <MenuRow testID="menu-portal" label="Client Portal" sub="Manage shared links for clients" onPress={() => router.push('/client-portal' as any)} isLast />
        </View>

        {/* TOOLS */}
        <Text style={styles.sectionLabel}>TOOLS</Text>
        <View style={styles.section}>
          <MenuRow testID="menu-bulk-reminders" label="📤 Bulk Reminders" sub="Send WhatsApp to all clients with hearings tomorrow" onPress={() => router.push('/bulk-reminders' as any)} />
          <MenuRow testID="menu-analytics" label="Analytics" sub="Practice stats and trends" onPress={() => router.push('/analytics' as any)} />
          <MenuRow testID="menu-templates" label="Message Templates" sub="Used in WhatsApp & SMS" onPress={() => router.push('/communication' as any)} />
          <MenuRow testID="menu-notifications" label="Notifications" sub="Reminders & alerts" onPress={() => router.push('/notifications' as any)} isLast />
        </View>

        {/* SUPPORT */}
        <Text style={styles.sectionLabel}>SUPPORT</Text>
        <View style={styles.section}>
          <MenuRow testID="menu-help" label="Help & FAQ" sub="Guides and common questions" onPress={() => router.push('/faq' as any)} />
          <MenuRow testID="menu-feedback" label="Share Feedback" sub="Tell us how to improve" onPress={() => Alert.alert('Feedback', 'Thank you! Feedback form coming soon.')} isLast />
        </View>

        {/* SIGN OUT */}
        <Text style={styles.sectionLabel}>SIGN OUT</Text>
        <View style={styles.section}>
          <MenuRow testID="logout-btn" label="Sign Out" onPress={handleLogout} danger isLast />
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>

      {/* Payment History Modal */}      <Modal visible={showHistory} transparent animationType="slide" onRequestClose={() => setShowHistory(false)}>
        <TouchableOpacity style={styles.historyModal} activeOpacity={1} onPress={() => setShowHistory(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.historySheet}>
            <Text style={styles.historyTitle}>Payment History</Text>
            {planHistory.length === 0
              ? <Text style={{ ...Typography.subhead, color: c.textSecondary }}>No payment history yet.</Text>
              : planHistory.map((entry, i) => (
                <View key={i} style={styles.historyItem}>
                  <Text style={styles.historyItemText}>{fmtHistoryEntry(entry)}</Text>
                </View>
              ))
            }
            <TouchableOpacity testID="history-close-btn" onPress={() => setShowHistory(false)} style={styles.historyCloseBtn}>
              <Text style={styles.historyCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Law Firm Paywall */}
      <PaywallSheet
        visible={showFirmPaywall}
        onClose={() => setShowFirmPaywall(false)}
        featureName="Law Firm"
      />
    </SafeAreaView>
  );
}
