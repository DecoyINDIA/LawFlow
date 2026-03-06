import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../src/theme';
import { CFButton } from '../src/components/common/CFButton';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  verifyOtp as apiVerifyOtp,
  requestOtp as apiRequestOtp,
  NetworkError,
} from '../src/services/api';
import { useApp } from '../src/context/AppContext';

const OTP_LEN = 6;
const MOCK_OTP = '123456';

export default function OTPScreen() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const params = useLocalSearchParams();
  const phone = (params.phone as string) || '';
  const { signIn } = useApp();

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(30);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const t = setInterval(() => setResendTimer(v => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const handleVerify = async () => {
    if (otp.length < OTP_LEN) return;
    setError('');
    setLoading(true);

    try {
      // Try real backend verification
      const result = await apiVerifyOtp('+91' + phone, otp);
      if (result.success && result.token) {
        // Store advocate data in AppContext
        signIn(result.token, result.advocate as Record<string, unknown>);
        setLoading(false);
        router.replace('/(tabs)');
        return;
      }
    } catch (err: any) {
      if (err instanceof NetworkError) {
        // Backend unreachable — use mock fallback
        if (otp === MOCK_OTP) {
          setLoading(false);
          router.replace('/(tabs)');
          return;
        }
        setError('Network error. Use 123456 for offline mode.');
        setLoading(false);
        return;
      }
      // Backend returned error (wrong OTP etc.)
      if (err?.status === 400) {
        // Also try mock fallback for dev convenience
        if (otp === MOCK_OTP) {
          setLoading(false);
          router.replace('/(tabs)');
          return;
        }
        setError('Invalid OTP. Please try again.');
        setLoading(false);
        return;
      }
      // Other error
      setError('Something went wrong. Please try again.');
    }

    setLoading(false);
  };

  const handleResend = async () => {
    setResendTimer(30);
    setError('');
    try {
      await apiRequestOtp('+91' + phone);
    } catch {
      // Silently fail — offline mode
    }
  };

  const renderBoxes = () =>
    Array.from({ length: OTP_LEN }).map((_, i) => {
      const digit = otp[i] ?? '';
      const isActive = otp.length === i;
      const isFilled = !!digit;
      return (
        <TouchableOpacity
          key={i}
          testID={`otp-box-${i}`}
          onPress={() => inputRef.current?.focus()}
          activeOpacity={1}
          style={[
            styles.box,
            isActive && styles.boxActive,
            isFilled && styles.boxFilled,
          ]}
        >
          <Text style={styles.digit}>{digit}</Text>
        </TouchableOpacity>
      );
    });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Back */}
        <TouchableOpacity
          testID="back-btn"
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="arrow-left" size={22} color={c.textPrimary} />
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.title}>Enter OTP</Text>
          <Text style={styles.subtitle}>
            We sent a code to{'\n'}
            <Text style={styles.phoneText}>+91 {phone}</Text>
          </Text>
          <Text style={styles.demoHint}>(Demo: enter 123456)</Text>

          {/* OTP Boxes */}
          <View style={styles.boxesRow}>
            <TextInput
              ref={inputRef}
              testID="otp-input"
              value={otp}
              onChangeText={(t) => {
                setOtp(t.replace(/\D/g, '').slice(0, OTP_LEN));
                setError('');
              }}
              keyboardType="number-pad"
              maxLength={OTP_LEN}
              style={styles.hidden}
              autoFocus
            />
            {renderBoxes()}
          </View>

          {error ? (
            <Text testID="otp-error" style={styles.errorText}>{error}</Text>
          ) : null}

          <CFButton
            testID="verify-btn"
            title="Verify & Continue"
            onPress={handleVerify}
            loading={loading}
            disabled={otp.length < OTP_LEN}
            style={styles.verifyBtn}
          />

          <View style={styles.resendRow}>
            <Text style={styles.resendLabel}>Didn't receive it? </Text>
            {resendTimer > 0 ? (
              <Text style={styles.timerText}>Resend in {resendTimer}s</Text>
            ) : (
              <TouchableOpacity testID="resend-btn" onPress={handleResend}>
                <Text style={styles.resendLink}>Resend OTP</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  backBtn: { padding: Spacing.m },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.l,
    paddingTop: Spacing.s,
  },
  title: { ...Typography.title1, color: c.textPrimary, marginBottom: Spacing.s },
  subtitle: {
    ...Typography.subhead,
    color: c.textSecondary,
    lineHeight: 22,
    marginBottom: 4,
  },
  phoneText: { fontWeight: '600', color: c.textPrimary },
  demoHint: {
    ...Typography.caption1,
    color: c.textTertiary,
    marginBottom: Spacing.xl,
  },
  boxesRow: {
    flexDirection: 'row',
    gap: Spacing.s,
    marginBottom: Spacing.s,
    position: 'relative',
  },
  hidden: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  box: {
    flex: 1,
    height: 56,
    borderRadius: Radius.m,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  boxActive: {
    borderColor: c.textPrimary,
    backgroundColor: c.background,
  },
  boxFilled: {
    backgroundColor: c.surfaceHighlight,
  },
  digit: { ...Typography.title2, color: c.textPrimary },
  errorText: {
    ...Typography.caption1,
    color: c.textPrimary,
    opacity: 0.5,
    marginBottom: Spacing.m,
  },
  verifyBtn: { marginTop: Spacing.l, marginBottom: Spacing.m },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendLabel: { ...Typography.subhead, color: c.textSecondary },
  timerText: { ...Typography.subhead, color: c.textTertiary },
  resendLink: { ...Typography.subhead, color: c.textPrimary, fontWeight: '600' },
});
