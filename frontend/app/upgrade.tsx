import React, { useState, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Animated, Alert, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useApp } from '../src/context/AppContext';
import { createOrder, buildPaymentUrl } from '../src/services/razorpay';

const DARK_BG = '#0A0A0A';
const AMBER = '#F59E0B';
const CARD_BG = '#1A1A1A';
const CHECK_GREEN = '#34C759';
const CROSS_GREY = '#4A4A4A';
const SCREEN_W = Dimensions.get('window').width;

const FREE_FEATURES = [
  { label: '10 Cases', included: true },
  { label: '10 Clients', included: true },
  { label: 'Basic Hearings', included: true },
  { label: 'Client Portal', included: true },
  { label: 'eCourts', included: false },
  { label: 'PDF Reports', included: false },
  { label: 'Google Drive', included: false },
  { label: 'Bulk WhatsApp', included: false },
  { label: 'Voice Notes', included: false },
  { label: 'Analytics', included: false },
  { label: 'Calendar Sync', included: false },
];

const PRO_FEATURES = [
  { label: 'Unlimited Cases' },
  { label: 'Unlimited Clients' },
  { label: 'All Free features' },
  { label: 'eCourts Integration' },
  { label: 'PDF Reports' },
  { label: 'Google Drive Storage' },
  { label: 'Bulk WhatsApp' },
  { label: 'Voice Notes' },
  { label: 'Analytics & Export' },
  { label: 'Calendar Sync' },
  { label: 'Priority Support' },
];

export default function UpgradeScreen() {
  const router = useRouter();
  const { authToken, advocateProfile, refreshPlan } = useApp();

  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);
  const [awaitingPayment, setAwaitingPayment] = useState(false);

  const scaleMonth = useRef(new Animated.Value(1)).current;
  const scaleYear = useRef(new Animated.Value(1)).current;
  const scaleCta = useRef(new Animated.Value(1)).current;
  const scaleConfirm = useRef(new Animated.Value(1)).current;

  const animPress = (anim: Animated.Value) => ({
    onPressIn: () => Animated.timing(anim, { toValue: 0.97, duration: 150, useNativeDriver: true }).start(),
    onPressOut: () => Animated.timing(anim, { toValue: 1, duration: 150, useNativeDriver: true }).start(),
  });

  const priceLabel = period === 'monthly' ? '₹99/mo' : '₹999/yr';

  const handlePay = async () => {
    if (!authToken) {
      Alert.alert('Not signed in', 'Please sign in first.');
      return;
    }
    setLoading(true);
    try {
      const order = await createOrder(period, authToken);
      const callbackUrl = `${process.env.EXPO_PUBLIC_BACKEND_URL || ''}/api/payments/webhook`;
      const url = buildPaymentUrl({
        keyId: order.keyId,
        orderId: order.orderId,
        amount: order.amount,
        advocateName: advocateProfile.name || 'Advocate',
        phone: advocateProfile.phone || '',
        callbackUrl,
      });
      await Linking.openURL(url);
      Alert.alert(
        'Complete Payment',
        'Complete payment in your browser. Return to the app when done.',
        [{ text: 'OK' }],
      );
      setAwaitingPayment(true);
    } catch (e: any) {
      Alert.alert('Payment Error', e?.message || 'Could not initiate payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    // no-op placeholder
  };

  const handleConfirmCheck = async () => {
    setLoading(true);
    try {
      await refreshPlan();
    } catch {}
    setLoading(false);
    // userPlan is read from context; re-render after refreshPlan will reflect the new plan
  };

  return (
    <SafeAreaView style={S.safe} edges={['top']}>
      {/* Back button */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn} testID="upgrade-back-btn">
          <Feather name="arrow-left" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.scroll}>
        {/* Premium scales of justice — SVG not installed, emoji fallback */}
        <View style={S.heroContainer}>
          <Text style={S.scalesEmoji}>⚖️</Text>
        </View>

        {/* Title */}
        <View style={S.titleSection}>
          <Text style={S.mainTitle}>LawFlow Pro</Text>
          <Text style={S.subtitle}>Everything you need to run your practice</Text>
        </View>

        {/* Plan cards side-by-side */}
        <View style={S.cardsRow}>
          {/* FREE card */}
          <View style={S.freeCard}>
            <Text style={S.cardLabelFree}>Free</Text>
            <Text style={S.cardSub}>Forever</Text>
            <View style={S.cardDivider} />
            {FREE_FEATURES.map(f => (
              <View key={f.label} style={S.featureItem}>
                <Text style={f.included ? S.check : S.cross}>{f.included ? '✓' : '✗'}</Text>
                <Text style={[S.featureText, !f.included && S.featureTextDim]}>{f.label}</Text>
              </View>
            ))}
          </View>

          {/* PRO card */}
          <View style={S.proCard}>
            <Text style={S.cardLabelPro}>Pro ⚡</Text>
            <Text style={S.cardPriceSub}>{priceLabel}</Text>
            <View style={S.cardDivider} />
            {PRO_FEATURES.map(f => (
              <View key={f.label} style={S.featureItem}>
                <Text style={S.check}>✓</Text>
                <Text style={S.featureText}>{f.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Period toggle */}
        <View style={S.togglePill}>
          <Animated.View style={[{ flex: 1 }, { transform: [{ scale: scaleMonth }] }]}>
            <TouchableOpacity
              testID="toggle-monthly"
              style={[S.toggleTab, period === 'monthly' && S.toggleTabActive]}
              onPress={() => setPeriod('monthly')}
              {...animPress(scaleMonth)}
            >
              <Text style={[S.toggleLabel, period === 'monthly' && S.toggleLabelActive]}>
                Monthly  ₹99
              </Text>
            </TouchableOpacity>
          </Animated.View>
          <Animated.View style={[{ flex: 1 }, { transform: [{ scale: scaleYear }] }]}>
            <TouchableOpacity
              testID="toggle-yearly"
              style={[S.toggleTab, period === 'yearly' && S.toggleTabActive]}
              onPress={() => setPeriod('yearly')}
              {...animPress(scaleYear)}
            >
              <Text style={[S.toggleLabel, period === 'yearly' && S.toggleLabelActive]}>
                Yearly  ₹999
              </Text>
              <View style={S.saveBadge}>
                <Text style={S.saveBadgeText}>Save 17%</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* CTA */}
        {!awaitingPayment ? (
          <Animated.View style={{ transform: [{ scale: scaleCta }] }}>
            <TouchableOpacity
              testID="continue-to-payment-btn"
              style={S.ctaBtn}
              onPress={handlePay}
              disabled={loading}
              {...animPress(scaleCta)}
            >
              {loading
                ? <ActivityIndicator color="#000000" />
                : <Text style={S.ctaText}>Upgrade to Pro →</Text>
              }
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <Animated.View style={{ transform: [{ scale: scaleConfirm }] }}>
            <TouchableOpacity
              testID="confirm-payment-btn"
              style={S.confirmBtn}
              onPress={handleConfirmCheck}
              disabled={loading}
              {...animPress(scaleConfirm)}
            >
              {loading
                ? <ActivityIndicator color={AMBER} />
                : <Text style={S.confirmText}>I've Completed Payment</Text>
              }
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Fine print */}
        <Text style={S.finePrint}>Cancel anytime · Secure payment via Razorpay</Text>
        <TouchableOpacity onPress={handleConfirmCheck} style={S.restoreBtn}>
          <Text style={S.restoreText}>Restore Purchase</Text>
        </TouchableOpacity>

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DARK_BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },

  scroll: { paddingBottom: 24 },

  // Hero — scales emoji replaces hero image
  heroContainer: {
    width: SCREEN_W,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DARK_BG,
  },
  scalesEmoji: {
    fontSize: 72,
    textAlign: 'center',
  },

  // Title
  titleSection: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20, alignItems: 'center' },
  mainTitle: { fontSize: 28, fontWeight: '800' as const, color: '#FFFFFF', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: AMBER, textAlign: 'center', fontWeight: '500' as const },

  // Plan cards
  cardsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 20 },
  freeCard: {
    flex: 1, backgroundColor: CARD_BG, borderRadius: 16,
    borderWidth: 1, borderColor: '#333333',
    padding: 12,
  },
  proCard: {
    flex: 1, backgroundColor: CARD_BG, borderRadius: 16,
    borderWidth: 2, borderColor: AMBER,
    padding: 12,
    shadowColor: AMBER, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  cardLabelFree: { fontSize: 16, fontWeight: '700' as const, color: '#FFFFFF', marginBottom: 2 },
  cardLabelPro: { fontSize: 16, fontWeight: '700' as const, color: AMBER, marginBottom: 2 },
  cardSub: { fontSize: 11, color: '#666666', marginBottom: 8 },
  cardPriceSub: { fontSize: 11, color: AMBER, marginBottom: 8, fontWeight: '600' as const },
  cardDivider: { height: 1, backgroundColor: '#2A2A2A', marginBottom: 8 },
  featureItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginBottom: 4 },
  check: { fontSize: 11, color: CHECK_GREEN, fontWeight: '700' as const, width: 12 },
  cross: { fontSize: 11, color: CROSS_GREY, fontWeight: '700' as const, width: 12 },
  featureText: { fontSize: 11, color: '#CCCCCC', flex: 1, lineHeight: 16 },
  featureTextDim: { color: '#555555' },

  // Toggle
  togglePill: {
    flexDirection: 'row', backgroundColor: '#1A1A1A', borderRadius: 12,
    marginHorizontal: 16, marginBottom: 20, padding: 4, gap: 4,
  },
  toggleTab: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', position: 'relative' as const },
  toggleTabActive: { backgroundColor: AMBER },
  toggleLabel: { fontSize: 13, color: '#888888', fontWeight: '500' as const },
  toggleLabelActive: { color: '#000000', fontWeight: '700' as const },
  saveBadge: {
    position: 'absolute' as const, top: -7, right: -2,
    backgroundColor: CHECK_GREEN, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2,
  },
  saveBadgeText: { fontSize: 9, color: '#FFFFFF', fontWeight: '700' as const },

  // CTA
  ctaBtn: {
    backgroundColor: AMBER, borderRadius: 12, marginHorizontal: 16,
    paddingVertical: 16, alignItems: 'center', marginBottom: 12,
  },
  ctaText: { fontSize: 16, fontWeight: '700' as const, color: '#000000' },
  confirmBtn: {
    borderWidth: 1.5, borderColor: AMBER, borderRadius: 12, marginHorizontal: 16,
    paddingVertical: 16, alignItems: 'center', marginBottom: 12,
  },
  confirmText: { fontSize: 16, fontWeight: '600' as const, color: AMBER },

  // Fine print
  finePrint: { fontSize: 12, color: '#555555', textAlign: 'center', marginHorizontal: 16 },
  restoreBtn: { alignItems: 'center', paddingVertical: 12 },
  restoreText: { fontSize: 12, color: '#555555', textDecorationLine: 'underline' as const },
});
