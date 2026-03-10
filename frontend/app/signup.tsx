/**
 * Fix 1 — New User Signup Screen (B&W Apple-style redesign)
 * All auth logic, validation, referral, and navigation unchanged.
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, TextInput,
  StatusBar as RNStatusBar, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Spacing } from '../src/theme';
import { useApp } from '../src/context/AppContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const BAR_COUNCILS = [
  'Bar Council of Andhra Pradesh',
  'Bar Council of Assam, Nagaland, Meghalaya, Manipur, Tripura, Mizoram & Arunachal Pradesh',
  'Bar Council of Bihar',
  'Bar Council of Chhattisgarh',
  'Bar Council of Delhi',
  'Bar Council of Goa',
  'Bar Council of Gujarat',
  'Bar Council of Himachal Pradesh',
  'Bar Council of Jammu & Kashmir',
  'Bar Council of Jharkhand',
  'Bar Council of Karnataka',
  'Bar Council of Kerala',
  'Bar Council of Madhya Pradesh',
  'Bar Council of Maharashtra & Goa',
  'Bar Council of Odisha',
  'Bar Council of Punjab & Haryana',
  'Bar Council of Rajasthan',
  'Bar Council of Tamil Nadu',
  'Bar Council of Telangana',
  'Bar Council of Uttar Pradesh',
  'Bar Council of Uttarakhand',
  'Bar Council of West Bengal',
];

const PRACTICE_AREAS = [
  'Civil', 'Criminal', 'Family', 'Property', 'Corporate',
  'Labour', 'Tax', 'Consumer', 'Constitutional', 'IPR',
  'Cyber', 'Banking', 'Arbitration', 'Writ', 'Human Rights',
];

export default function SignupScreen() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const { updateAdvocateProfile, advocateProfile } = useApp();

  const [name, setName] = useState(advocateProfile.name || '');
  const [barId, setBarId] = useState(advocateProfile.enrollmentNumber || '');
  const [barCouncil, setBarCouncil] = useState(advocateProfile.barCouncil || '');
  const [email, setEmail] = useState(advocateProfile.email || '');
  const [selectedAreas, setSelectedAreas] = useState<string[]>(advocateProfile.practiceAreas || []);
  const [showCouncilPicker, setShowCouncilPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Referral code state
  const [referralInput, setReferralInput] = useState('');
  const [referralStatus, setReferralStatus] = useState<'idle' | 'valid' | 'invalid' | 'checking'>('idle');
  const [referralName, setReferralName] = useState('');

  const validateReferralCode = useCallback(async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setReferralStatus('idle'); return; }
    setReferralStatus('checking');
    try {
      const resp = await fetch(`${BACKEND_URL}/api/referral/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await resp.json();
      if (data.valid) {
        setReferralStatus('valid');
        setReferralName(data.advocateName || '');
      } else {
        setReferralStatus('invalid');
        setReferralName('');
      }
    } catch {
      setReferralStatus('idle');
    }
  }, []);

  const toggleArea = useCallback((area: string) => {
    setSelectedAreas(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    );
  }, []);

  const proceedSave = useCallback(async () => {
    setSaving(true);
    try {
      const update: any = {
        name: name.trim(),
        enrollmentNumber: barId.trim(),
        barCouncil: barCouncil.trim(),
        email: email.trim() || undefined,
        practiceAreas: selectedAreas.length > 0 ? selectedAreas : undefined,
      };
      if (referralStatus === 'valid' && referralInput.trim()) {
        update.referredBy = referralInput.trim().toUpperCase();
      }
      updateAdvocateProfile(update);
      router.replace('/(tabs)');
    } catch (err) {
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [name, barId, barCouncil, email, selectedAreas, referralInput, referralStatus, updateAdvocateProfile, router]);

  const handleSave = useCallback(async () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Full name is required';
    if (!barId.trim()) newErrors.barId = 'Bar ID is required';
    if (!barCouncil.trim()) newErrors.barCouncil = 'Bar Council is required';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (!referralInput.trim() && Platform.OS !== 'web') {
      Alert.alert(
        'No Referral Code?',
        "You'll miss out on bonus days when you upgrade to Pro. Skip anyway?",
        [
          { text: 'Enter Code', style: 'cancel' },
          { text: 'Skip', onPress: proceedSave },
        ]
      );
      return;
    }
    await proceedSave();
  }, [name, barId, barCouncil, referralInput, proceedSave]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <RNStatusBar barStyle="light-content" backgroundColor="#000000" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Set up your advocate profile</Text>

          {/* Full Name */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>FULL NAME</Text>
            <TextInput
              testID="signup-name-input"
              style={[styles.input, errors.name ? styles.inputError : null]}
              value={name}
              onChangeText={(t) => { setName(t); setErrors(e => ({ ...e, name: '' })); }}
              placeholder="Adv. Rajesh Kumar"
              placeholderTextColor="#444"
            />
            {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
          </View>

          {/* Bar ID */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>BAR ID / ENROLLMENT NUMBER</Text>
            <TextInput
              testID="signup-barid-input"
              style={[styles.input, errors.barId ? styles.inputError : null]}
              value={barId}
              onChangeText={(t) => { setBarId(t); setErrors(e => ({ ...e, barId: '' })); }}
              placeholder="MH/2018/12345"
              placeholderTextColor="#444"
            />
            {errors.barId ? <Text style={styles.errorText}>{errors.barId}</Text> : null}
          </View>

          {/* Bar Council */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>BAR COUNCIL / STATE</Text>
            <TouchableOpacity
              testID="signup-barcouncil-picker"
              style={[styles.input, styles.pickerBtn, errors.barCouncil ? styles.inputError : null]}
              onPress={() => setShowCouncilPicker(!showCouncilPicker)}
              activeOpacity={0.7}
            >
              <Text style={[styles.pickerText, !barCouncil && styles.placeholderText]}>
                {barCouncil || 'Select Bar Council'}
              </Text>
            </TouchableOpacity>
            {errors.barCouncil ? <Text style={styles.errorText}>{errors.barCouncil}</Text> : null}
            {showCouncilPicker && (
              <View style={styles.councilList}>
                <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                  {BAR_COUNCILS.map(bc => (
                    <TouchableOpacity
                      key={bc}
                      style={[styles.councilItem, barCouncil === bc && styles.councilItemActive]}
                      onPress={() => {
                        setBarCouncil(bc);
                        setShowCouncilPicker(false);
                        setErrors(e => ({ ...e, barCouncil: '' }));
                      }}
                    >
                      <Text style={[styles.councilText, barCouncil === bc && styles.councilTextActive]}>
                        {bc}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Email (optional) */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>EMAIL (OPTIONAL)</Text>
            <TextInput
              testID="signup-email-input"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="advocate@example.com"
              placeholderTextColor="#444"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Practice Areas (optional) */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>PRACTICE AREAS (OPTIONAL)</Text>
            <View style={styles.chipRow}>
              {PRACTICE_AREAS.map(area => {
                const sel = selectedAreas.includes(area);
                return (
                  <TouchableOpacity
                    key={area}
                    testID={`signup-area-${area.toLowerCase()}`}
                    style={[styles.chip, sel && styles.chipActive]}
                    onPress={() => toggleArea(area)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, sel && styles.chipTextActive]}>{area}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Referral Code (optional) */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>REFERRAL CODE (OPTIONAL)</Text>
            <TextInput
              testID="signup-referral-input"
              style={styles.input}
              value={referralInput}
              onChangeText={(t) => { setReferralInput(t.toUpperCase()); setReferralStatus('idle'); }}
              onBlur={() => validateReferralCode(referralInput)}
              placeholder="Have a referral code? Enter here"
              placeholderTextColor="#444"
              autoCapitalize="characters"
              maxLength={8}
            />
            {referralStatus === 'valid' && (
              <View style={styles.referralRow} testID="referral-valid-msg">
                <Feather name="check-circle" size={14} color="#FFFFFF" />
                <Text style={[styles.referralMsg, { color: '#FFFFFF' }]}>
                  {' '}Referred by {referralName} ✓
                </Text>
              </View>
            )}
            {referralStatus === 'invalid' && (
              <Text style={[styles.referralMsg, { color: '#FF453A' }]} testID="referral-invalid-msg">
                Invalid referral code
              </Text>
            )}
            {referralStatus === 'checking' && (
              <Text style={[styles.referralMsg, { color: '#666666' }]}>
                Checking...
              </Text>
            )}
          </View>

          {/* Save button */}
          <TouchableOpacity
            testID="signup-save-btn"
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
            style={[styles.ctaBtn, styles.saveBtn, saving && styles.ctaBtnDisabled]}
          >
            {saving
              ? <ActivityIndicator color="#000" size="small" />
              : <Text style={styles.ctaBtnText}>Save & Continue</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  scroll: { flex: 1 },
  content: { padding: 24, paddingBottom: 48 },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: '#888888',
    marginBottom: 32,
  },

  fieldWrap: { marginBottom: 20 },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666666',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#111111',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    height: 52,
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: '400',
    color: '#FFFFFF',
  },
  inputError: { borderColor: '#FF453A' },
  errorText: {
    fontSize: 13,
    color: '#FF453A',
    marginTop: 4,
  },

  pickerBtn: {
    justifyContent: 'center',
  },
  pickerText: { fontSize: 15, color: '#FFFFFF' },
  placeholderText: { color: '#444444' },

  councilList: {
    backgroundColor: '#111111',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    marginTop: 4,
    overflow: 'hidden',
  },
  councilItem: { paddingHorizontal: 16, paddingVertical: 12 },
  councilItemActive: { backgroundColor: '#1A1A1A' },
  councilText: { fontSize: 15, color: '#AAAAAA' },
  councilTextActive: { color: '#FFFFFF', fontWeight: '600' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, backgroundColor: '#111111',
    borderWidth: 1.5, borderColor: '#2A2A2A',
  },
  chipActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  chipText: { fontSize: 13, color: '#666666' },
  chipTextActive: { color: '#000000', fontWeight: '600' },

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
  saveBtn: { marginTop: 8 },

  referralRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  referralMsg: { fontSize: 13, marginTop: 4 },
});
