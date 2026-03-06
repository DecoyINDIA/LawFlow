import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, TouchableOpacity,
  ScrollView, StatusBar as RNStatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../src/theme';
import { CFButton } from '../src/components/common/CFButton';
import { Feather } from '@expo/vector-icons';
import { requestOtp } from '../src/services/api';

export default function LoginScreen() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      <RNStatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Black top area */}
          <View style={styles.topArea}>
            <Text style={styles.brandLogo}>LF</Text>
          </View>

          {/* White sheet */}
          <View style={styles.sheet}>
            <Text style={styles.title}>Welcome to{'\n'}LawFlow</Text>
            <Text style={styles.subtitle}>
              Enter your phone number to continue
            </Text>

            {/* Input */}
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
                  placeholderTextColor={c.textTertiary}
                  autoFocus
                />
              </View>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>

            <CFButton
              testID="send-otp-btn"
              title="Send OTP"
              onPress={handleSendOTP}
              loading={loading}
              disabled={phone.length < 10}
            />

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
  container: { flex: 1, backgroundColor: c.textPrimary },
  scroll: { flexGrow: 1 },
  topArea: {
    flex: 1,
    minHeight: 200,
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingHorizontal: Spacing.l,
  },
  brandLogo: {
    fontSize: 56,
    fontWeight: '800',
    color: c.background,
    letterSpacing: -2,
  },
  sheet: {
    backgroundColor: c.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.l,
    paddingTop: Spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 48 : 36,
    minHeight: 440,
  },
  title: {
    ...Typography.title1,
    color: c.textPrimary,
    marginBottom: Spacing.s,
  },
  subtitle: {
    ...Typography.subhead,
    color: c.textSecondary,
    marginBottom: Spacing.xl,
  },
  inputGroup: { marginBottom: Spacing.l },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: c.textSecondary,
    letterSpacing: 0.8,
    marginBottom: Spacing.s,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: Radius.m,
    borderWidth: 1.5,
    borderColor: 'transparent',
    height: 52,
    paddingHorizontal: Spacing.m,
    gap: Spacing.s,
  },
  inputRowError: {
    borderColor: c.textPrimary,
  },
  prefix: {
    ...Typography.body,
    fontWeight: '600',
    color: c.textPrimary,
  },
  vDivider: {
    width: StyleSheet.hairlineWidth,
    height: 20,
    backgroundColor: c.border,
  },
  input: {
    flex: 1,
    ...Typography.body,
    color: c.textPrimary,
    height: 52,
  },
  errorText: {
    ...Typography.caption1,
    color: c.textPrimary,
    opacity: 0.6,
    marginTop: Spacing.s,
  },
  terms: {
    ...Typography.caption1,
    color: c.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.m,
  },
  termsLink: {
    color: c.textSecondary,
    textDecorationLine: 'underline',
  },
});
