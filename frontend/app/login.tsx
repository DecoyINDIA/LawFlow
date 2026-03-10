import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, TouchableOpacity,
  ScrollView, StatusBar as RNStatusBar, Animated, Easing,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../src/theme';
import { requestOtp } from '../src/services/api';

export default function LoginScreen() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Breathing white glow animation ───────────────────────────────
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.04, 0.12],
  });

  const glowScale = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1.2],
  });
  // ─────────────────────────────────────────────────────────────────

  const handleSendOTP = async () => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await requestOtp('+91' + cleaned);
    } catch {
      // Backend unreachable — continue in offline mode
    }
    setLoading(false);
    router.push({ pathname: '/otp', params: { phone: cleaned } });
  };

  return (
    <View style={styles.container}>
      <RNStatusBar barStyle="light-content" backgroundColor="#000000" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo area with breathing white glow */}
          <View style={styles.topArea}>
            <View style={styles.logoContainer}>
              <Animated.View
                style={[
                  styles.glow,
                  { opacity: glowOpacity, transform: [{ scale: glowScale }] },
                ]}
              />
              <Text style={styles.brandLogo}>LF</Text>
            </View>
            <Text style={styles.tagline}>Your Legal Practice, Organised</Text>
          </View>

          {/* Seamless black form area */}
          <View style={styles.sheet}>
            <Text style={styles.title}>Welcome to{'\n'}LawFlow</Text>
            <Text style={styles.subtitle}>
              Enter your phone number to continue
            </Text>

            {/* Phone input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PHONE NUMBER</Text>
              <View style={[styles.inputRow, error ? styles.inputRowError : null]}>
                <Text style={styles.prefix}>+91</Text>
                <View style={styles.vDivider} />
                <TextInput
                  testID="phone-input"
                  style={styles.input}
                  value={phone}
                  onChangeText={(t) => {
                    setPhone(t.replace(/\D/g, ''));
                    setError('');
                  }}
                  keyboardType="phone-pad"
                  maxLength={10}
                  placeholder="98765 43210"
                  placeholderTextColor="#444"
                  autoFocus
                />
              </View>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>

            {/* B&W CTA button */}
            <TouchableOpacity
              testID="send-otp-btn"
              onPress={handleSendOTP}
              disabled={phone.length < 10 || loading}
              activeOpacity={0.85}
              style={[styles.ctaBtn, (phone.length < 10 || loading) && styles.ctaBtnDisabled]}
            >
              {loading
                ? <ActivityIndicator color="#000" size="small" />
                : <Text style={styles.ctaBtnText}>Send OTP</Text>
              }
            </TouchableOpacity>

            <Text style={styles.terms}>
              By continuing, you agree to our{' '}
              <Text style={styles.termsLink}>Terms of Service</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  scroll: { flexGrow: 1 },

  topArea: {
    flex: 1,
    minHeight: 240,
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingHorizontal: 24,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 12,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
    height: 100,
  },
  glow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#FFFFFF',
  },
  brandLogo: {
    fontSize: 64,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    zIndex: 1,
  },
  tagline: {
    fontSize: 13,
    fontWeight: '400',
    color: '#555555',
    letterSpacing: 0.5,
    marginLeft: 4,
  },

  sheet: {
    backgroundColor: '#000000',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 48 : 36,
    minHeight: 360,
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
    marginBottom: 32,
  },

  inputGroup: { marginBottom: 24 },
  inputLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666666',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    height: 52,
    paddingHorizontal: 16,
    gap: 10,
  },
  inputRowError: { borderColor: '#FF453A' },
  prefix: {
    fontSize: 15,
    fontWeight: '400',
    color: '#FFFFFF',
  },
  vDivider: {
    width: StyleSheet.hairlineWidth,
    height: 20,
    backgroundColor: '#333',
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    color: '#FFFFFF',
    height: 52,
  },
  errorText: {
    fontSize: 13,
    color: '#FF453A',
    marginTop: 6,
  },

  ctaBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  ctaBtnDisabled: { opacity: 0.35 },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },

  terms: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',
    marginTop: 16,
  },
  termsLink: {
    color: '#666666',
    textDecorationLine: 'underline',
  },
});
