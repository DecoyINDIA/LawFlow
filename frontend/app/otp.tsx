import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator, StatusBar as RNStatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useColors, ColorPalette, Typography, Spacing } from '../src/theme';
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
  const submittingRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setResendTimer(v => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const handleVerify = async () => {
    if (otp.length < OTP_LEN || submittingRef.current) return;
    submittingRef.current = true;
    setError('');
    setLoading(true);

    try {
      const result = await apiVerifyOtp('+91' + phone, otp);
      if (result.success && result.token) {
        const adv = result.advocate as Record<string, unknown>;
        signIn(result.token, adv);
        setLoading(false);
        const isProfileComplete = !!(adv?.name && adv?.enrollmentNumber && adv?.barCouncil);
        if (!isProfileComplete) {
          router.replace('/signup');
        } else {
          router.replace('/(tabs)');
        }
        return;
      }
    } catch (err: any) {
      if (err instanceof NetworkError) {
        if (otp === MOCK_OTP) {
          setLoading(false);
          try {
            const stored = await AsyncStorage.getItem('lawflow_advocate_profile');
            const profile = stored ? JSON.parse(stored) : null;
            const done = !!(profile?.name && profile?.enrollmentNumber && profile?.barCouncil);
            router.replace(done ? '/(tabs)' : '/signup');
          } catch {
            router.replace('/signup');
          }
          return;
        }
        setError('Network error. Use 123456 for offline mode.');
        setLoading(false);
        submittingRef.current = false;
        return;
      }
      if (err?.status === 400) {
        if (otp === MOCK_OTP) {
          setLoading(false);
          try {
            const stored = await AsyncStorage.getItem('lawflow_advocate_profile');
            const profile = stored ? JSON.parse(stored) : null;
            const done = !!(profile?.name && profile?.enrollmentNumber && profile?.barCouncil);
            router.replace(done ? '/(tabs)' : '/signup');
          } catch {
            router.replace('/signup');
          }
          return;
        }
        setError('Invalid OTP. Please try again.');
        setLoading(false);
        submittingRef.current = false;
        return;
      }
      setError('Something went wrong. Please try again.');
    }

    setLoading(false);
    submittingRef.current = false;
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
      <RNStatusBar barStyle="light-content" backgroundColor="#000000" />
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
          <Feather name="arrow-left" size={22} color="#FFFFFF" />
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

          {/* B&W Verify button */}
          <TouchableOpacity
            testID="verify-btn"
            onPress={handleVerify}
            disabled={otp.length < OTP_LEN || loading}
            activeOpacity={0.85}
            style={[styles.ctaBtn, (otp.length < OTP_LEN || loading) && styles.ctaBtnDisabled, styles.verifyBtn]}
          >
            {loading
              ? <ActivityIndicator color="#000" size="small" />
              : <Text style={styles.ctaBtnText}>Verify & Continue</Text>
            }
          </TouchableOpacity>

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
  safe: { flex: 1, backgroundColor: '#000000' },
  backBtn: { padding: 16 },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: '#888888',
    lineHeight: 22,
    marginBottom: 4,
  },
  phoneText: {
    fontWeight: '600',
    color: '#FFFFFF',
  },
  demoHint: {
    fontSize: 12,
    color: '#444444',
    marginBottom: 32,
  },
  boxesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
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
    borderRadius: 12,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
  },
  boxActive: {
    borderColor: '#FFFFFF',
    backgroundColor: '#111111',
  },
  boxFilled: {
    backgroundColor: '#1A1A1A',
    borderColor: '#444444',
  },
  digit: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  errorText: {
    fontSize: 13,
    color: '#FF453A',
    marginBottom: 16,
  },
  ctaBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtnDisabled: { opacity: 0.35 },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  verifyBtn: { marginTop: 24, marginBottom: 16 },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendLabel: { fontSize: 15, color: '#666666' },
  timerText: { fontSize: 15, color: '#444444' },
  resendLink: { fontSize: 15, color: '#FFFFFF', fontWeight: '600' },
});
