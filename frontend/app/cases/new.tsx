import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../../src/theme';
import { useApp } from '../../src/context/AppContext';
import { CFTextInput } from '../../src/components/common/CFTextInput';
import { CFPicker } from '../../src/components/common/CFPicker';
import { CFButton } from '../../src/components/common/CFButton';
import { CFDatePicker } from '../../src/components/common/CFDatePicker';
import { CFStatusPicker } from '../../src/components/common/CFStatusPicker';
import { CFCourtInput } from '../../src/components/common/CFCourtInput';
import { ClientPicker } from '../../src/components/common/ClientPicker';
import { PartyTypePicker } from '../../src/components/common/PartyTypePicker';
import { NotifyClientPopup, generateCaseUpdateMessage } from '../../src/components/common/NotifyClientPopup';
import { PaywallSheet } from '../../src/components/PaywallSheet';
import { CaseType, CasePriority } from '../../src/types';
import { ecourtsLookup, EcourtsResult } from '../../src/services/api';

const DEFAULT_CASE_TYPE_LABELS = [
  'CIVIL','CRIMINAL','FAMILY','PROPERTY','CORPORATE',
  'LABOUR','TAX','CONSTITUTIONAL','CONSUMER','CYBER',
  'IPR','BANKING','ARBITRATION','WRIT','OTHER',
];

const PRIORITY_OPTS = [
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

export default function CaseFormScreen() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const params = useLocalSearchParams();
  const caseId = params.caseId as string | undefined;
  const {
    addCase, updateCase, getCaseById, clients, addClient,
    getAllStatuses, addCustomStatus, deleteCustomStatus,
    savedCourtNames, deleteCourtName, getClientById,
    customPartyTypes, addCustomPartyType, deleteCustomPartyType,
    sendWhatsAppMessage, sendSMSMessage, advocateName,
    getAllCaseTypes, addCustomCaseType,
    cases, isProUser,
  } = useApp();

  const isEdit = !!caseId;
  const existing = caseId ? getCaseById(caseId) : null;

  // Form state
  const [caseNumber, setCaseNumber] = useState('');
  const [title, setTitle] = useState('');
  const [caseType, setCaseType] = useState<string>('CIVIL');
  const [showCustomTypeInput, setShowCustomTypeInput] = useState(false);
  const [customTypeText, setCustomTypeText] = useState('');
  const [courtName, setCourtName] = useState('');
  const [courtCity, setCourtCity] = useState('');
  const [clientId, setClientId] = useState('');
  const [plaintiffPetitioner, setPlaintiffPetitioner] = useState('');
  const [plaintiffType, setPlaintiffType] = useState('Individual');
  const [defendant, setDefendant] = useState('');
  const [defendantType, setDefendantType] = useState('Individual');
  const [registrationDate, setRegistrationDate] = useState<number | undefined>();
  const [nextHearingDate, setNextHearingDate] = useState<number | undefined>();
  const [status, setStatus] = useState('FILED');
  const [priority, setPriority] = useState<CasePriority>('MEDIUM');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── eCourts CNR auto-detection ─────────────────────────────────────────
  const [cnrBanner, setCnrBanner] = useState(false);
  const [cnrFetching, setCnrFetching] = useState(false);
  const [ecourtsFilledFields, setEcourtsFilledFields] = useState<string[]>([]);
  const pendingHearingRef = useRef<EcourtsResult | null>(null);
  const cnrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect CNR pattern as advocate types (debounced 600ms)
  useEffect(() => {
    if (caseId) return; // Skip in edit mode
    if (cnrTimerRef.current) clearTimeout(cnrTimerRef.current);
    const clean = caseNumber.replace(/[\s\-\.]/g, '').toUpperCase();
    const looksLikeCnr = clean.length >= 14 && clean.length <= 18 && /^[A-Z]{2}[A-Z0-9]+$/.test(clean);
    cnrTimerRef.current = setTimeout(() => {
      setCnrBanner(looksLikeCnr && !ecourtsFilledFields.length);
    }, 600);
    return () => { if (cnrTimerRef.current) clearTimeout(cnrTimerRef.current); };
  }, [caseNumber, caseId, ecourtsFilledFields.length]);

  const handleFetchCnr = useCallback(async () => {
    const cnr = caseNumber.replace(/[\s\-\.]/g, '').toUpperCase();
    setCnrFetching(true);
    setCnrBanner(false);
    try {
      const resp = await ecourtsLookup({ cnr_number: cnr });
      const data = resp?.data;
      pendingHearingRef.current = data || null;

      const filled: string[] = [];
      if (data?.courtName && !courtName) { setCourtName(data.courtName); filled.push('courtName'); }
      if (data?.respondent && !defendant) { setDefendant(data.respondent); filled.push('defendant'); }
      if (data?.petitioner && !plaintiffPetitioner) { setPlaintiffPetitioner(data.petitioner); filled.push('plaintiffPetitioner'); }
      if (data?.nextHearingDateTimestamp && !nextHearingDate) { setNextHearingDate(data.nextHearingDateTimestamp); filled.push('nextHearingDate'); }
      setEcourtsFilledFields(filled);

      if (!data?.found) {
        // Not found / unavailable → still go to ecourts-review for manual entry
        await AsyncStorage.setItem('lawflow_ecourts_pending', JSON.stringify(
          data || { found: false, source: 'unavailable', error: 'eCourts portal unavailable.', fetchedFields: [] }
        ));
        // Store temp caseId flag so review screen knows it's a new case
        await AsyncStorage.setItem('lawflow_ecourts_new_case', '1');
        router.push({ pathname: '/ecourts-review', params: { caseId: '__new__' } });
      }
    } catch {
      // Silently dismiss
    } finally {
      setCnrFetching(false);
    }
  }, [caseNumber, courtName, defendant, plaintiffPetitioner, nextHearingDate, router]);

  // Notification popup
  const [showNotify, setShowNotify] = useState(false);
  const [savedCaseData, setSavedCaseData] = useState<any>(null);
  // Phase 27 — Paywall
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    if (existing) {
      setCaseNumber(existing.caseNumber);
      setTitle(existing.title);
      setCaseType(existing.caseType);
      setCourtName(existing.courtName);
      setCourtCity(existing.courtCity);
      setClientId(existing.clientId);
      setPlaintiffPetitioner(existing.plaintiffPetitioner ?? '');
      setPlaintiffType(existing.plaintiffType ?? 'Individual');
      setDefendant(existing.defendant ?? '');
      setDefendantType(existing.defendantType ?? 'Individual');
      setRegistrationDate(existing.registrationDate ?? existing.filingDate);
      setNextHearingDate(existing.nextHearingDate);
      setStatus(existing.status);
      setPriority(existing.priority);
      setNotes(existing.notes ?? '');
      setTags(existing.tags.join(', '));
    }
  }, [caseId]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!caseNumber.trim()) e.caseNumber = 'Required';
    if (!title.trim()) e.title = 'Required';
    if (!courtName.trim()) e.courtName = 'Required';
    // registrationDate is optional — no required validation
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    // Phase 27 — Paywall check (only when creating, not editing)
    if (!isEdit && !isProUser && cases.length >= 10) {
      setShowPaywall(true);
      return;
    }
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));

    const client = clients.find(c => c.id === clientId);
    const payload = {
      caseNumber: caseNumber.trim(),
      title: title.trim(),
      caseType,
      courtName: courtName.trim(),
      courtCity: courtCity.trim(),
      clientId,
      clientName: client?.name ?? '',
      plaintiffPetitioner: plaintiffPetitioner.trim(),
      plaintiffType,
      defendant: defendant.trim(),
      defendantType,
      registrationDate,
      filingDate: registrationDate,
      nextHearingDate,
      status,
      priority,
      notes: notes.trim(),
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      isActive: true,
    };

    let newCase;
    if (isEdit && caseId) {
      updateCase(caseId, payload);
      newCase = { ...existing, ...payload };
    } else {
      newCase = addCase(payload);
    }

    setSaving(false);
    setSavedCaseData(newCase);

    // Always navigate back immediately after save
    router.back();
  };

  const handleNotifyClose = () => {
    setShowNotify(false);
    router.back();
  };

  const client = clientId ? getClientById(clientId) : null;
  const notifyMessage = savedCaseData && client
    ? generateCaseUpdateMessage(savedCaseData, client.name, advocateName, 'update')
    : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Feather name="x" size={22} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Case' : 'New Case'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.form}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <CFTextInput
            testID="case-number-input"
            label="Case Number"
            value={caseNumber}
            onChangeText={(v) => { setCaseNumber(v); setEcourtsFilledFields([]); }}
            placeholder="CRL/2024/0892 or MHMT010123222024"
            error={errors.caseNumber}
            autoCapitalize="characters"
          />

          {/* CNR Auto-Detection Banner */}
          {(cnrBanner || cnrFetching) && (
            <TouchableOpacity
              testID="cnr-ecourts-banner"
              style={styles.cnrBanner}
              onPress={handleFetchCnr}
              disabled={cnrFetching}
              activeOpacity={0.8}
            >
              {cnrFetching
                ? <ActivityIndicator size="small" color="#1A73E8" />
                : <Feather name="globe" size={15} color="#1A73E8" />
              }
              <View style={{ flex: 1 }}>
                <Text style={styles.cnrBannerTitle}>
                  {cnrFetching ? 'Fetching from eCourts…' : 'Looks like a CNR number'}
                </Text>
                {!cnrFetching && (
                  <Text style={styles.cnrBannerSub}>
                    Tap to auto-fill court details from eCourts portal
                  </Text>
                )}
              </View>
              {!cnrFetching && <Feather name="chevron-right" size={16} color="#1A73E8" />}
            </TouchableOpacity>
          )}

          {/* eCourts auto-filled badge */}
          {ecourtsFilledFields.length > 0 && (
            <View style={styles.ecourtsFilledBadge} testID="ecourts-filled-badge">
              <Feather name="check-circle" size={13} color="#34C759" />
              <Text style={styles.ecourtsFilledText}>
                {ecourtsFilledFields.length} field{ecourtsFilledFields.length > 1 ? 's' : ''} auto-filled from eCourts
              </Text>
              <TouchableOpacity onPress={() => setEcourtsFilledFields([])}>
                <Feather name="x" size={13} color="#8E8E93" />
              </TouchableOpacity>
            </View>
          )}

          <CFTextInput
            testID="case-title-input"
            label="Case Title"
            value={title}
            onChangeText={setTitle}
            placeholder="State vs Rajesh Sharma"
            error={errors.title}
          />

          {/* Case Type with custom option */}
          <CFPicker
            label="Case Type"
            value={caseType}
            options={[
              ...getAllCaseTypes().map(v => ({
                value: v,
                label: v.charAt(0) + v.slice(1).toLowerCase().replace('_', ' '),
              })),
              { value: '__ADD_CUSTOM__', label: '➕ Add Custom Type' },
            ]}
            onSelect={(v) => {
              if (v === '__ADD_CUSTOM__') {
                setShowCustomTypeInput(true);
              } else {
                setCaseType(v as CaseType);
              }
            }}
          />
          {showCustomTypeInput && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: -8, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <CFTextInput
                  testID="custom-case-type-input"
                  label=""
                  value={customTypeText}
                  onChangeText={setCustomTypeText}
                  placeholder="Enter custom type name"
                />
              </View>
              <TouchableOpacity
                testID="save-custom-case-type-btn"
                style={{ alignSelf: 'center', backgroundColor: c.textPrimary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 }}
                onPress={() => {
                  if (customTypeText.trim()) {
                    const upper = customTypeText.trim().toUpperCase();
                    addCustomCaseType(upper);
                    setCaseType(upper as CaseType);
                    setCustomTypeText('');
                    setShowCustomTypeInput(false);
                  }
                }}
              >
                <Text style={{ color: c.background, fontWeight: '600', fontSize: 13 }}>Add</Text>
              </TouchableOpacity>
            </View>
          )}

          <CFCourtInput
            testID="court-name-input"
            label="Court Name"
            value={courtName}
            onChangeText={setCourtName}
            savedCourts={savedCourtNames}
            onDeleteCourt={deleteCourtName}
            placeholder="Bombay High Court"
            error={errors.courtName}
          />

          <CFTextInput
            label="Court City"
            value={courtCity}
            onChangeText={setCourtCity}
            placeholder="Mumbai"
          />

          <CFDatePicker
            testID="registration-date"
            label="Registration Date"
            value={registrationDate}
            onChange={setRegistrationDate}
            placeholder="Select registration date…"
            required
          />
          {errors.registrationDate && (
            <Text style={styles.dateError}>{errors.registrationDate}</Text>
          )}

          <CFDatePicker
            testID="next-date"
            label="Next Date"
            value={nextHearingDate}
            onChange={setNextHearingDate}
            placeholder="Select next hearing date…"
          />

          <ClientPicker
            testID="client-picker"
            value={clientId}
            clients={clients}
            onSelect={setClientId}
            onAddClient={addClient}
          />

          <CFTextInput
            label="Plaintiff / Petitioner Name"
            value={plaintiffPetitioner}
            onChangeText={setPlaintiffPetitioner}
            placeholder="State of Maharashtra"
          />

          <PartyTypePicker
            testID="plaintiff-type"
            label="Petitioner Type"
            value={plaintiffType}
            partyTypes={customPartyTypes}
            onSelect={setPlaintiffType}
            onAddType={addCustomPartyType}
            onDeleteType={deleteCustomPartyType}
          />

          <CFTextInput
            label="Defendant Name"
            value={defendant}
            onChangeText={setDefendant}
            placeholder="Accused / Respondent name"
          />

          <PartyTypePicker
            testID="defendant-type"
            label="Defendant Type"
            value={defendantType}
            partyTypes={customPartyTypes}
            onSelect={setDefendantType}
            onAddType={addCustomPartyType}
            onDeleteType={deleteCustomPartyType}
          />

          <CFStatusPicker
            testID="status-picker"
            label="Status"
            value={status}
            statuses={getAllStatuses()}
            onSelect={setStatus}
            onAddStatus={addCustomStatus}
            onDeleteStatus={deleteCustomStatus}
          />

          <CFPicker
            label="Priority"
            value={priority}
            options={PRIORITY_OPTS}
            onSelect={(v) => setPriority(v as CasePriority)}
          />

          <CFTextInput
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Case notes and remarks…"
            multiline
          />

          <CFTextInput
            label="Tags (comma separated)"
            value={tags}
            onChangeText={setTags}
            placeholder="criminal, bail, urgent"
          />

          <CFButton
            testID="save-case-btn"
            title={isEdit ? 'Save Changes' : 'Create Case'}
            onPress={handleSave}
            loading={saving}
            style={{ marginTop: Spacing.s }}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Notification Popup */}
      <NotifyClientPopup
        visible={showNotify}
        onClose={handleNotifyClose}
        client={client}
        caseData={savedCaseData}
        advocateName={advocateName}
        message={notifyMessage}
        title="Notify Client?"
        onSendWhatsApp={sendWhatsAppMessage}
        onSendSMS={sendSMSMessage}
      />
      {/* Phase 27 — Paywall */}
      <PaywallSheet
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        featureName="Unlimited Cases"
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.m, paddingTop: Spacing.s, paddingBottom: Spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.headline, color: c.textPrimary },
  form: { padding: Spacing.m, paddingBottom: 48 },
  dateError: { ...Typography.caption1, color: c.textPrimary, opacity: 0.6, marginTop: -12, marginBottom: Spacing.m },

  // CNR auto-detection banner
  cnrBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.s,
    backgroundColor: 'rgba(26,115,232,0.07)', borderRadius: Radius.m,
    borderWidth: 1, borderColor: 'rgba(26,115,232,0.2)',
    paddingHorizontal: Spacing.m, paddingVertical: 10,
    marginBottom: Spacing.m,
  },
  cnrBannerTitle: { ...Typography.footnote, fontWeight: '600', color: '#1A73E8' },
  cnrBannerSub: { ...Typography.caption1, color: '#1A73E8', opacity: 0.7, marginTop: 1 },

  // eCourts filled badge
  ecourtsFilledBadge: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.s,
    backgroundColor: 'rgba(52,199,89,0.08)', borderRadius: Radius.m,
    borderWidth: 1, borderColor: 'rgba(52,199,89,0.2)',
    paddingHorizontal: Spacing.m, paddingVertical: 7,
    marginBottom: Spacing.m,
  },
  ecourtsFilledText: { ...Typography.footnote, color: '#34C759', flex: 1 },
});
