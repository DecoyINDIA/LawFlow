import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../../src/theme';
import { useApp } from '../../src/context/AppContext';
import { CFTextInput } from '../../src/components/common/CFTextInput';
import { ClientType } from '../../src/types';

const CLIENT_TYPES: ClientType[] = ['INDIVIDUAL', 'CORPORATE', 'NGO', 'GOVERNMENT'];

function formatType(t: string): string {
  return t.charAt(0) + t.slice(1).toLowerCase();
}

export default function ClientFormScreen() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const params = useLocalSearchParams();
  const clientId = params.clientId as string | undefined;
  const { addClient, updateClient, getClientById, customPartyTypes, addCustomPartyType } = useApp();

  const isEdit = !!clientId;
  const existing = clientId ? getClientById(clientId) : null;

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');
  const [clientType, setClientType] = useState<ClientType>('INDIVIDUAL');
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [smsOptIn, setSmsOptIn] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // All types including custom
  const allTypes = [...CLIENT_TYPES, ...customPartyTypes.filter(t => !CLIENT_TYPES.includes(t as any))] as string[];

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setPhone(existing.phone.replace('+91', ''));
      setEmail(existing.email ?? '');
      setCity(existing.city ?? '');
      setNotes(existing.notes ?? '');
      setClientType(existing.clientType);
      setWhatsappOptIn(existing.whatsappOptIn);
      setSmsOptIn(existing.smsOptIn);
    }
  }, [clientId]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    if (!phone.trim()) {
      e.phone = 'Phone is required';
    } else if (!/^\d{10}$/.test(phone.replace(/\D/g, ''))) {
      e.phone = 'Enter valid 10-digit phone number';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));

    const cleanPhone = '+91' + phone.replace(/\D/g, '').slice(-10);
    const payload = {
      name: name.trim(),
      phone: cleanPhone,
      email: email.trim() || undefined,
      city: city.trim() || undefined,
      notes: notes.trim() || undefined,
      clientType: clientType as ClientType,
      tags: [],
      whatsappOptIn,
      smsOptIn,
      isActive: true,
    };

    if (isEdit && clientId) {
      updateClient(clientId, payload);
      router.back(); // Go back to client detail
    } else {
      const newClient = addClient(payload);
      router.replace(`/clients/${newClient.id}` as any); // Go to new client detail
    }
    setSaving(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Feather name="x" size={22} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Client' : 'New Client'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.form}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Full Name */}
          <CFTextInput
            testID="client-name-input"
            label="Full Name"
            value={name}
            onChangeText={(t) => { setName(t); setErrors(e => ({ ...e, name: '' })); }}
            placeholder="Rajesh Sharma"
            error={errors.name}
            autoCapitalize="words"
          />

          {/* Phone */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>PHONE *</Text>
            <View style={[styles.phoneRow, errors.phone && styles.phoneRowError]}>
              <Text style={styles.phonePrefix}>+91</Text>
              <CFTextInput
                testID="client-phone-input"
                value={phone}
                onChangeText={(t) => { setPhone(t.replace(/\D/g, '').slice(0, 10)); setErrors(e => ({ ...e, phone: '' })); }}
                placeholder="98765 43210"
                keyboardType="phone-pad"
                style={styles.phoneInput}
              />
            </View>
            {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
          </View>

          {/* Email */}
          <CFTextInput
            label="Email (optional)"
            value={email}
            onChangeText={setEmail}
            placeholder="client@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Client Type */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>CLIENT TYPE *</Text>
            <View style={styles.typeChips}>
              {allTypes.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, clientType === t && styles.typeChipOn]}
                  onPress={() => setClientType(t as ClientType)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.typeChipText, clientType === t && styles.typeChipTextOn]}>
                    {formatType(t)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* City */}
          <CFTextInput
            label="City (optional)"
            value={city}
            onChangeText={setCity}
            placeholder="Mumbai"
          />

          {/* Notes */}
          <CFTextInput
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Important notes about this client…"
            multiline
          />

          {/* Notification Preferences */}
          <View style={styles.prefsSection}>
            <Text style={styles.fieldLabel}>NOTIFICATION PREFERENCES</Text>
            <View style={styles.prefsCard}>
              <View style={styles.prefRow}>
                <View style={styles.prefInfo}>
                  <Text style={styles.prefLabel}>WhatsApp Reminders</Text>
                  <Text style={styles.prefSub}>Send hearing updates via WhatsApp</Text>
                </View>
                <Switch
                  testID="whatsapp-toggle"
                  value={whatsappOptIn}
                  onValueChange={setWhatsappOptIn}
                  trackColor={{ false: '#E5E5E5', true: c.textPrimary }}
                  thumbColor={c.background}
                />
              </View>
              <View style={styles.prefDivider} />
              <View style={styles.prefRow}>
                <View style={styles.prefInfo}>
                  <Text style={styles.prefLabel}>SMS Reminders</Text>
                  <Text style={styles.prefSub}>Send hearing updates via SMS</Text>
                </View>
                <Switch
                  testID="sms-toggle"
                  value={smsOptIn}
                  onValueChange={setSmsOptIn}
                  trackColor={{ false: '#E5E5E5', true: c.textPrimary }}
                  thumbColor={c.background}
                />
              </View>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            testID="save-client-btn"
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <Text style={styles.saveBtnText}>Saving…</Text>
            ) : (
              <Text style={styles.saveBtnText}>{isEdit ? 'Save Changes' : 'Create Client'}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: c.textPrimary },

  // Form
  form: { padding: 16, paddingBottom: 48 },

  // Field Group
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: c.textSecondary, letterSpacing: 0.8, marginBottom: 8 },

  // Phone Row
  phoneRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: c.surface, borderRadius: 12, height: 48, paddingHorizontal: 16,
    borderWidth: 1, borderColor: 'transparent',
  },
  phoneRowError: { borderColor: c.textPrimary },
  phonePrefix: { fontSize: 15, color: c.textSecondary, marginRight: 8 },
  phoneInput: { flex: 1, backgroundColor: 'transparent', marginBottom: 0 },
  errorText: { fontSize: 13, color: c.textSecondary, marginTop: 4 },

  // Type Chips
  typeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
    backgroundColor: c.surface,
  },
  typeChipOn: { backgroundColor: c.textPrimary },
  typeChipText: { fontSize: 14, fontWeight: '600', color: c.textSecondary },
  typeChipTextOn: { color: c.background },

  // Preferences
  prefsSection: { marginTop: 8, marginBottom: 24 },
  prefsCard: { backgroundColor: c.surface, borderRadius: 12, overflow: 'hidden' },
  prefRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16,
  },
  prefInfo: { flex: 1, marginRight: 16 },
  prefLabel: { fontSize: 15, fontWeight: '500', color: c.textPrimary },
  prefSub: { fontSize: 13, color: c.textSecondary, marginTop: 2 },
  prefDivider: { height: 1, backgroundColor: c.border, marginLeft: 16 },

  // Save Button
  saveBtn: {
    backgroundColor: c.textPrimary, borderRadius: 12, height: 50,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 17, fontWeight: '600', color: c.background },
});
