import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView,
  TextInput, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../../theme';
import { ClientType, Client } from '../../types';

interface ClientPickerProps {
  value: string;
  clients: Client[];
  onSelect: (clientId: string) => void;
  onAddClient: (client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => Client;
  testID?: string;
}

const CLIENT_TYPES: ClientType[] = ['INDIVIDUAL', 'CORPORATE', 'NGO', 'GOVERNMENT'];

export function ClientPicker({
  value, clients, onSelect, onAddClient, testID
}: ClientPickerProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [open, setOpen] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [search, setSearch] = useState('');

  // New client form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsappSame, setWhatsappSame] = useState(true);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [clientType, setClientType] = useState<ClientType>('INDIVIDUAL');
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [smsOptIn, setSmsOptIn] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selected = clients.find(c => c.id === value);

  const filtered = search
    ? clients.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search)
      )
    : clients;

  const resetForm = () => {
    setName('');
    setPhone('');
    setWhatsappSame(true);
    setWhatsappPhone('');
    setEmail('');
    setAddress('');
    setCity('');
    setClientType('INDIVIDUAL');
    setWhatsappOptIn(true);
    setSmsOptIn(true);
    setErrors({});
  };

  const validateForm = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Full name is required';
    if (!phone.trim()) {
      e.phone = 'Phone number is required';
    } else if (!/^\d{10}$/.test(phone.replace(/\D/g, ''))) {
      e.phone = 'Enter valid 10-digit phone number';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleAddClient = () => {
    if (!validateForm()) return;

    const cleanPhone = '+91' + phone.replace(/\D/g, '').slice(-10);
    const cleanWhatsapp = whatsappSame ? cleanPhone : '+91' + whatsappPhone.replace(/\D/g, '').slice(-10);

    const newClient = onAddClient({
      name: name.trim(),
      phone: cleanPhone,
      alternatePhone: whatsappSame ? undefined : cleanWhatsapp,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      clientType,
      tags: [],
      whatsappOptIn,
      smsOptIn,
      isActive: true,
    });

    // Select the newly created client
    onSelect(newClient.id);
    setShowAddClient(false);
    setOpen(false);
    resetForm();
  };

  const handleOpenAddClient = () => {
    setOpen(false);
    setTimeout(() => setShowAddClient(true), 300);
  };

  const handleCloseAddClient = () => {
    setShowAddClient(false);
    resetForm();
  };

  return (
    <>
      <View style={styles.group}>
        <Text style={styles.label}>PLAINTIFF / PETITIONER</Text>
        <TouchableOpacity
          testID={testID}
          style={styles.trigger}
          onPress={() => setOpen(true)}
          activeOpacity={0.7}
        >
          <View style={styles.triggerContent}>
            {selected ? (
              <>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {selected.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                  </Text>
                </View>
                <View style={styles.selectedInfo}>
                  <Text style={styles.selectedName}>{selected.name}</Text>
                  <Text style={styles.selectedSub}>{selected.clientType} · {selected.phone}</Text>
                </View>
              </>
            ) : (
              <Text style={styles.placeholder}>Select or add client…</Text>
            )}
          </View>
          <Feather name="chevron-down" size={15} color={c.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ─── CLIENT SELECTION MODAL ─── */}
      <Modal visible={open} transparent animationType="slide" statusBarTranslucent>
        <TouchableOpacity
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          activeOpacity={1}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Select Client</Text>

            {/* Search */}
            <View style={styles.searchWrap}>
              <Feather name="search" size={15} color={c.textSecondary} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search by name or phone…"
                placeholderTextColor={c.textTertiary}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Feather name="x-circle" size={14} color={c.textTertiary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Add New Client Button */}
            <TouchableOpacity
              testID="add-new-client-btn"
              style={styles.addClientBtn}
              onPress={handleOpenAddClient}
              activeOpacity={0.7}
            >
              <View style={styles.addIconWrap}>
                <Feather name="plus" size={16} color={c.background} />
              </View>
              <Text style={styles.addClientText}>Add New Client</Text>
            </TouchableOpacity>

            {/* Client List */}
            <ScrollView style={styles.clientList} showsVerticalScrollIndicator={false}>
              {/* None option */}
              <TouchableOpacity
                style={styles.clientOpt}
                onPress={() => { onSelect(''); setOpen(false); }}
                activeOpacity={0.7}
              >
                <View style={styles.clientOptLeft}>
                  <View style={[styles.avatar, styles.avatarEmpty]}>
                    <Feather name="user-x" size={14} color={c.textTertiary} />
                  </View>
                  <Text style={styles.clientOptName}>No client</Text>
                </View>
                {value === '' && <Feather name="check" size={16} color={c.textPrimary} />}
              </TouchableOpacity>

              {filtered.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.clientOpt}
                  onPress={() => { onSelect(c.id); setOpen(false); }}
                  activeOpacity={0.7}
                >
                  <View style={styles.clientOptLeft}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {c.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.clientOptName}>{c.name}</Text>
                      <Text style={styles.clientOptSub}>{c.clientType} · {c.phone}</Text>
                    </View>
                  </View>
                  {value === c.id && <Feather name="check" size={16} color={c.textPrimary} />}
                </TouchableOpacity>
              ))}

              {filtered.length === 0 && search && (
                <View style={styles.emptySearch}>
                  <Text style={styles.emptySearchText}>No clients found</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── ADD NEW CLIENT MODAL ─── */}
      <Modal visible={showAddClient} transparent animationType="slide" statusBarTranslucent>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.addBackdrop}>
            <View style={styles.addSheet}>
              <View style={styles.addHeader}>
                <TouchableOpacity onPress={handleCloseAddClient} style={styles.addCloseBtn}>
                  <Feather name="x" size={20} color={c.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.addTitle}>Add New Client</Text>
                <View style={{ width: 36 }} />
              </View>

              <ScrollView
                style={styles.addForm}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Full Name */}
                <Text style={styles.fieldLabel}>FULL NAME *</Text>
                <TextInput
                  testID="client-name-input"
                  style={[styles.fieldInput, errors.name && styles.fieldInputError]}
                  value={name}
                  onChangeText={(t) => { setName(t); setErrors(e => ({ ...e, name: '' })); }}
                  placeholder="Rajesh Sharma"
                  placeholderTextColor={c.textTertiary}
                  autoCapitalize="words"
                />
                {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}

                {/* Phone Number */}
                <Text style={styles.fieldLabel}>PHONE NUMBER *</Text>
                <View style={[styles.phoneRow, errors.phone && styles.fieldInputError]}>
                  <Text style={styles.prefix}>+91</Text>
                  <TextInput
                    testID="client-phone-input"
                    style={styles.phoneInput}
                    value={phone}
                    onChangeText={(t) => { setPhone(t.replace(/\D/g, '').slice(0, 10)); setErrors(e => ({ ...e, phone: '' })); }}
                    placeholder="98765 43210"
                    placeholderTextColor={c.textTertiary}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
                {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}

                {/* WhatsApp Same */}
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setWhatsappSame(!whatsappSame)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, whatsappSame && styles.checkboxOn]}>
                    {whatsappSame && <Feather name="check" size={12} color={c.background} />}
                  </View>
                  <Text style={styles.checkboxLabel}>WhatsApp number same as phone</Text>
                </TouchableOpacity>

                {/* WhatsApp Number (if different) */}
                {!whatsappSame && (
                  <>
                    <Text style={styles.fieldLabel}>WHATSAPP NUMBER</Text>
                    <View style={styles.phoneRow}>
                      <Text style={styles.prefix}>+91</Text>
                      <TextInput
                        style={styles.phoneInput}
                        value={whatsappPhone}
                        onChangeText={(t) => setWhatsappPhone(t.replace(/\D/g, '').slice(0, 10))}
                        placeholder="98765 43210"
                        placeholderTextColor={c.textTertiary}
                        keyboardType="phone-pad"
                        maxLength={10}
                      />
                    </View>
                  </>
                )}

                {/* Email */}
                <Text style={styles.fieldLabel}>EMAIL (OPTIONAL)</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="rajesh@example.com"
                  placeholderTextColor={c.textTertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                {/* Address */}
                <Text style={styles.fieldLabel}>ADDRESS (OPTIONAL)</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="123 Main Street, Andheri West"
                  placeholderTextColor={c.textTertiary}
                />

                {/* City */}
                <Text style={styles.fieldLabel}>CITY (OPTIONAL)</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={city}
                  onChangeText={setCity}
                  placeholder="Mumbai"
                  placeholderTextColor={c.textTertiary}
                />

                {/* Client Type */}
                <Text style={styles.fieldLabel}>CLIENT TYPE</Text>
                <View style={styles.typeRow}>
                  {CLIENT_TYPES.map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeChip, clientType === t && styles.typeChipOn]}
                      onPress={() => setClientType(t)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.typeChipText, clientType === t && styles.typeChipTextOn]}>
                        {t.charAt(0) + t.slice(1).toLowerCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Communication Consent */}
                <Text style={[styles.fieldLabel, { marginTop: Spacing.m }]}>COMMUNICATION CONSENT</Text>
                <View style={styles.consentCard}>
                  <View style={styles.consentRow}>
                    <View style={styles.consentLeft}>
                      <Feather name="message-circle" size={18} color={c.textPrimary} />
                      <Text style={styles.consentLabel}>WhatsApp Reminders</Text>
                    </View>
                    <Switch
                      value={whatsappOptIn}
                      onValueChange={setWhatsappOptIn}
                      trackColor={{ false: c.surfaceHighlight, true: c.textPrimary }}
                      thumbColor={c.background}
                    />
                  </View>
                  <View style={styles.consentDivider} />
                  <View style={styles.consentRow}>
                    <View style={styles.consentLeft}>
                      <Feather name="smartphone" size={18} color={c.textPrimary} />
                      <Text style={styles.consentLabel}>SMS Reminders</Text>
                    </View>
                    <Switch
                      value={smsOptIn}
                      onValueChange={setSmsOptIn}
                      trackColor={{ false: c.surfaceHighlight, true: c.textPrimary }}
                      thumbColor={c.background}
                    />
                  </View>
                </View>

                {/* Save Button */}
                <TouchableOpacity
                  testID="save-new-client-btn"
                  style={styles.saveBtn}
                  onPress={handleAddClient}
                  activeOpacity={0.8}
                >
                  <Text style={styles.saveBtnText}>Save & Select Client</Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  group: { marginBottom: Spacing.m },
  label: { fontSize: 11, fontWeight: '600', color: c.textSecondary, letterSpacing: 0.8, marginBottom: Spacing.s },
  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: c.surface, borderRadius: Radius.m, minHeight: 56, paddingHorizontal: Spacing.m,
    paddingVertical: Spacing.s,
  },
  triggerContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.m },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.textPrimary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, fontWeight: '700', color: c.background },
  avatarEmpty: { backgroundColor: c.surfaceHighlight },
  selectedInfo: { flex: 1 },
  selectedName: { ...Typography.subhead, fontWeight: '600', color: c.textPrimary },
  selectedSub: { ...Typography.caption1, color: c.textSecondary },
  placeholder: { ...Typography.body, color: c.textTertiary },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24, maxHeight: '75%',
  },
  handle: { width: 36, height: 4, backgroundColor: c.surfaceHighlight, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: Spacing.m },
  sheetTitle: { ...Typography.headline, color: c.textPrimary, paddingHorizontal: Spacing.l, marginBottom: Spacing.m },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface,
    borderRadius: Radius.m, marginHorizontal: Spacing.l, paddingHorizontal: Spacing.m, height: 40, gap: Spacing.s,
  },
  searchInput: { flex: 1, ...Typography.subhead, color: c.textPrimary, height: 40 },

  addClientBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.m,
    marginHorizontal: Spacing.l, marginTop: Spacing.m, marginBottom: Spacing.s,
    backgroundColor: c.surface, borderRadius: Radius.m, padding: Spacing.m,
  },
  addIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: c.textPrimary, alignItems: 'center', justifyContent: 'center' },
  addClientText: { ...Typography.subhead, fontWeight: '600', color: c.textPrimary },

  clientList: { flex: 1, paddingHorizontal: Spacing.l },
  clientOpt: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.m, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  clientOptLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.m },
  clientOptName: { ...Typography.body, color: c.textPrimary },
  clientOptSub: { ...Typography.caption1, color: c.textSecondary },

  emptySearch: { alignItems: 'center', paddingVertical: Spacing.xl },
  emptySearchText: { ...Typography.subhead, color: c.textSecondary },

  // Add Client Modal
  addBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  addSheet: {
    backgroundColor: c.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '92%',
  },
  addHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.m, paddingTop: Spacing.m, paddingBottom: Spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  addCloseBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  addTitle: { ...Typography.headline, color: c.textPrimary },
  addForm: { paddingHorizontal: Spacing.l, paddingTop: Spacing.l },

  fieldLabel: { fontSize: 11, fontWeight: '600', color: c.textSecondary, letterSpacing: 0.8, marginBottom: Spacing.s, marginTop: Spacing.m },
  fieldInput: {
    backgroundColor: c.surface, borderRadius: Radius.m, height: 48, paddingHorizontal: Spacing.m,
    ...Typography.body, color: c.textPrimary, borderWidth: 1.5, borderColor: 'transparent',
  },
  fieldInputError: { borderColor: c.textPrimary },
  errorText: { ...Typography.caption1, color: c.textPrimary, opacity: 0.6, marginTop: 4 },

  phoneRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface,
    borderRadius: Radius.m, height: 48, paddingHorizontal: Spacing.m, borderWidth: 1.5, borderColor: 'transparent',
  },
  prefix: { ...Typography.body, color: c.textSecondary, marginRight: Spacing.s },
  phoneInput: { flex: 1, ...Typography.body, color: c.textPrimary, height: 48 },

  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.m, marginTop: Spacing.m },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: c.textTertiary,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: c.textPrimary, borderColor: c.textPrimary },
  checkboxLabel: { ...Typography.subhead, color: c.textPrimary },

  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.s },
  typeChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full,
    backgroundColor: c.surface,
  },
  typeChipOn: { backgroundColor: c.textPrimary },
  typeChipText: { ...Typography.footnote, fontWeight: '600', color: c.textSecondary },
  typeChipTextOn: { color: c.background },

  consentCard: {
    backgroundColor: c.surface, borderRadius: Radius.m, overflow: 'hidden',
  },
  consentRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.m, paddingVertical: Spacing.m,
  },
  consentLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.m },
  consentLabel: { ...Typography.subhead, color: c.textPrimary },
  consentDivider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: Spacing.m },

  saveBtn: {
    backgroundColor: c.textPrimary, borderRadius: Radius.m, height: 50,
    alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xl,
  },
  saveBtnText: { ...Typography.headline, color: c.background },
});
