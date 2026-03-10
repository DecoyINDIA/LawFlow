/**
 * eCourts Review Screen
 *
 * Shown after a POST /api/ecourts/lookup call.
 * Reads fetched data from AsyncStorage key 'lawflow_ecourts_pending'.
 * Each field pre-filled from eCourts shows an "eCourts" badge.
 * All fields are freely editable before saving.
 *
 * Flow:
 *   Confirm & Save → addHearing() via AppContext (offline-first) → back to Case Detail
 *   Discard → back to Case Detail, nothing saved
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../src/theme';
import { useApp } from '../src/context/AppContext';
import { CFDatePicker } from '../src/components/common/CFDatePicker';

const ECOURTS_PENDING_KEY = 'lawflow_ecourts_pending';

// ── Types ─────────────────────────────────────────────────────────────────

interface EcourtsData {
  found: boolean;
  source: string;
  error?: string;
  cnrNumber?: string;
  caseNumber?: string;
  caseType?: string;
  filingDate?: string;
  registrationDate?: string;
  nextHearingDate?: string;
  nextHearingDateTimestamp?: number;
  courtName?: string;
  judgeName?: string;
  caseStatus?: string;
  petitioner?: string;
  respondent?: string;
  remarks?: string;
  fetchedFields: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────

function tomorrow(): number {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function fmtTs(ts: number): string {
  const d = new Date(ts);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate().toString().padStart(2,'0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ── ECourts badge component ───────────────────────────────────────────────

function ECourtsBadge({ c }: { c: ColorPalette }) {
  return (
    <View style={{
      backgroundColor: '#E8F4FD',
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    }}>
      <Feather name="globe" size={9} color="#1A73E8" />
      <Text style={{ fontSize: 9, fontWeight: '700', color: '#1A73E8', letterSpacing: 0.3 }}>
        eCOURTS
      </Text>
    </View>
  );
}

// ── Field row component ───────────────────────────────────────────────────

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  fromEcourts?: boolean;
  multiline?: boolean;
  c: ColorPalette;
  styles: ReturnType<typeof makeStyles>;
  testID?: string;
}

function FieldRow({ label, value, onChangeText, placeholder, fromEcourts, multiline, c, styles, testID }: FieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {fromEcourts && <ECourtsBadge c={c} />}
      </View>
      <TextInput
        testID={testID}
        style={[styles.fieldInput, multiline && styles.fieldInputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || `Enter ${label.toLowerCase()}`}
        placeholderTextColor={c.textTertiary}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'auto'}
      />
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────

export default function EcourtsReviewScreen() {
  const router = useRouter();
  const { caseId } = useLocalSearchParams<{ caseId: string }>();
  const { addHearing, updateCase, getCaseById } = useApp();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ecourtsData, setEcourtsData] = useState<EcourtsData | null>(null);

  // Editable form state
  const [hearingDate, setHearingDate] = useState<number | undefined>(tomorrow());
  const [hearingTime, setHearingTime] = useState('');
  const [courtName, setCourtName] = useState('');
  const [judgeName, setJudgeName] = useState('');
  const [caseStatus, setCaseStatus] = useState('');
  const [opposingParty, setOpposingParty] = useState('');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');

  const caseData = getCaseById(caseId);

  // Load pending eCourts data from AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ECOURTS_PENDING_KEY);
        if (raw) {
          const data: EcourtsData = JSON.parse(raw);
          setEcourtsData(data);
          // Pre-fill editable fields
          if (data.nextHearingDateTimestamp) setHearingDate(data.nextHearingDateTimestamp);
          if (data.courtName) setCourtName(data.courtName);
          if (data.judgeName) setJudgeName(data.judgeName);
          if (data.caseStatus) setCaseStatus(data.caseStatus);
          if (data.petitioner || data.respondent) {
            setOpposingParty(data.respondent || data.petitioner || '');
          }
          if (data.remarks) setNotes(data.remarks);
          // Clear after reading
          await AsyncStorage.removeItem(ECOURTS_PENDING_KEY);
        }
      } catch (e) {
        // non-fatal
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isFetched = useCallback(
    (field: string) => (ecourtsData?.fetchedFields ?? []).includes(field),
    [ecourtsData]
  );

  const handleSave = async () => {
    if (!caseId) {
      Alert.alert('Error', 'No case selected. Please go back and try again.');
      return;
    }
    if (!hearingDate) {
      Alert.alert('Required', 'Please select a hearing date before saving.');
      return;
    }
    setSaving(true);
    try {
      const newHearing = addHearing({
        caseId,
        hearingDate,
        hearingTime: hearingTime.trim() || undefined,
        courtRoom: courtName.trim() || caseData?.courtName || undefined,
        purpose: purpose.trim() || undefined,
        notes: [
          judgeName.trim() ? `Judge: ${judgeName.trim()}` : '',
          caseStatus.trim() ? `Status: ${caseStatus.trim()}` : '',
          opposingParty.trim() ? `Opposing Party: ${opposingParty.trim()}` : '',
          notes.trim(),
        ].filter(Boolean).join('\n') || undefined,
        clientNotified: false,
      });

      // Update case nextHearingDate if this is earlier
      if (!caseData?.nextHearingDate || hearingDate < caseData.nextHearingDate) {
        updateCase(caseId, { nextHearingDate: hearingDate });
      }
      // Update case status if fetched from eCourts
      if (caseStatus.trim() && isFetched('caseStatus')) {
        updateCase(caseId, { status: caseStatus.trim() });
      }

      Alert.alert(
        'Hearing Saved',
        `Hearing on ${fmtTs(hearingDate)} has been added to the case.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e) {
      Alert.alert('Error', 'Could not save the hearing. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (Platform.OS === 'web') {
      // Alert.alert / window.confirm are blocked in browser iframes — navigate directly on web
      router.back();
      return;
    }
    Alert.alert(
      'Discard Changes',
      'Nothing will be saved. Go back to case details?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={c.textPrimary} />
          <Text style={styles.loadingText}>Loading eCourts data…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const sourceLabel = ecourtsData?.found
    ? 'Fetched from eCourts — review and edit before saving'
    : ecourtsData?.source === 'unavailable'
    ? 'eCourts unavailable — enter details manually'
    : 'Case not found on eCourts — enter details manually';

  const sourceBanner = ecourtsData?.found ? 'success' : 'warning';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleDiscard}
          style={styles.backBtn}
          testID="ecourts-review-discard-header"
        >
          <Feather name="x" size={22} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Hearing</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Source banner */}
          <View style={[styles.banner, sourceBanner === 'success' ? styles.bannerSuccess : styles.bannerWarning]}>
            <Feather
              name={sourceBanner === 'success' ? 'check-circle' : 'alert-circle'}
              size={16}
              color={sourceBanner === 'success' ? '#34C759' : '#FF9500'}
            />
            <Text style={[styles.bannerText, sourceBanner === 'success' ? styles.bannerTextSuccess : styles.bannerTextWarning]}>
              {sourceLabel}
            </Text>
          </View>

          {/* Error message (when eCourts unreachable) */}
          {ecourtsData?.error && !ecourtsData.found && (
            <View style={styles.errorBox} testID="ecourts-error-message">
              <Text style={styles.errorText}>{ecourtsData.error}</Text>
            </View>
          )}

          {/* CNR info if present */}
          {ecourtsData?.cnrNumber && (
            <View style={styles.cnrRow}>
              <Text style={styles.cnrLabel}>CNR:</Text>
              <Text style={styles.cnrValue}>{ecourtsData.cnrNumber}</Text>
            </View>
          )}

          {/* Section: Hearing Date & Time */}
          <Text style={styles.sectionTitle}>HEARING DATE & TIME</Text>
          <View style={styles.card}>
            <View style={styles.fieldWrap}>
              {isFetched('nextHearingDate') && (
                <View style={{ alignSelf: 'flex-start', marginBottom: 4 }}>
                  <ECourtsBadge c={c} />
                </View>
              )}
              <CFDatePicker
                label="Next Hearing Date"
                value={hearingDate}
                onChange={setHearingDate}
                required
                testID="ecourts-hearing-date"
              />
            </View>

            <FieldRow
              label="Hearing Time"
              value={hearingTime}
              onChangeText={setHearingTime}
              placeholder="e.g. 10:30 AM"
              c={c}
              styles={styles}
              testID="ecourts-hearing-time"
            />
          </View>

          {/* Section: Court Details */}
          <Text style={styles.sectionTitle}>COURT DETAILS</Text>
          <View style={styles.card}>
            <FieldRow
              label="Court Name / Bench"
              value={courtName}
              onChangeText={setCourtName}
              placeholder="e.g. Sessions Court, Mumbai"
              fromEcourts={isFetched('courtName')}
              c={c}
              styles={styles}
              testID="ecourts-court-name"
            />
            <View style={styles.fieldDivider} />
            <FieldRow
              label="Judge Name"
              value={judgeName}
              onChangeText={setJudgeName}
              placeholder="e.g. Hon. Justice M. Sharma"
              fromEcourts={isFetched('judgeName')}
              c={c}
              styles={styles}
              testID="ecourts-judge-name"
            />
          </View>

          {/* Section: Case Status */}
          <Text style={styles.sectionTitle}>CASE STATUS</Text>
          <View style={styles.card}>
            <FieldRow
              label="Status"
              value={caseStatus}
              onChangeText={setCaseStatus}
              placeholder="e.g. Active, Adjourned, Disposed"
              fromEcourts={isFetched('caseStatus')}
              c={c}
              styles={styles}
              testID="ecourts-case-status"
            />
          </View>

          {/* Section: Parties */}
          <Text style={styles.sectionTitle}>PARTIES</Text>
          <View style={styles.card}>
            <FieldRow
              label="Opposing Party"
              value={opposingParty}
              onChangeText={setOpposingParty}
              placeholder="Respondent or opposing party name"
              fromEcourts={isFetched('respondent') || isFetched('petitioner')}
              c={c}
              styles={styles}
              testID="ecourts-opposing-party"
            />
          </View>

          {/* Section: Purpose & Notes */}
          <Text style={styles.sectionTitle}>PURPOSE & NOTES</Text>
          <View style={styles.card}>
            <FieldRow
              label="Purpose"
              value={purpose}
              onChangeText={setPurpose}
              placeholder="e.g. Arguments, Evidence, Final Hearing"
              c={c}
              styles={styles}
              testID="ecourts-purpose"
            />
            <View style={styles.fieldDivider} />
            <FieldRow
              label="Notes / Remarks"
              value={notes}
              onChangeText={setNotes}
              placeholder="Any additional notes"
              fromEcourts={isFetched('remarks')}
              multiline
              c={c}
              styles={styles}
              testID="ecourts-notes"
            />
          </View>

          {/* Help text */}
          <Text style={styles.helpText}>
            Fields marked with{' '}
            <Text style={{ color: '#1A73E8', fontWeight: '600' }}>eCOURTS</Text>
            {' '}were auto-filled from the eCourts portal. Review and edit freely before saving.
          </Text>
        </ScrollView>

        {/* Bottom Action Bar */}
        <View style={styles.actionBar}>
          <TouchableOpacity
            testID="ecourts-review-discard-btn"
            style={styles.discardBtn}
            onPress={handleDiscard}
            activeOpacity={0.7}
          >
            <Text style={styles.discardBtnText}>Discard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="ecourts-review-save-btn"
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : (
                <>
                  <Feather name="check" size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>Confirm & Save</Text>
                </>
              )
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.m },
  loadingText: { ...Typography.subhead, color: c.textSecondary },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.m, paddingVertical: Spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.headline, color: c.textPrimary },

  scroll: { flex: 1, paddingHorizontal: Spacing.m, paddingTop: Spacing.m },

  // Banner
  banner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.s,
    borderRadius: Radius.m, padding: Spacing.m, marginBottom: Spacing.m,
  },
  bannerSuccess: { backgroundColor: 'rgba(52,199,89,0.1)' },
  bannerWarning: { backgroundColor: 'rgba(255,149,0,0.1)' },
  bannerText: { ...Typography.footnote, flex: 1 },
  bannerTextSuccess: { color: '#34C759' },
  bannerTextWarning: { color: '#FF9500' },

  // Error box
  errorBox: {
    backgroundColor: c.surface, borderRadius: Radius.m, padding: Spacing.m,
    marginBottom: Spacing.m, borderLeftWidth: 3, borderLeftColor: '#FF9500',
  },
  errorText: { ...Typography.footnote, color: c.textSecondary, lineHeight: 18 },

  // CNR row
  cnrRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.s,
    marginBottom: Spacing.m,
  },
  cnrLabel: { ...Typography.caption1, fontWeight: '600', color: c.textTertiary, letterSpacing: 0.5 },
  cnrValue: { ...Typography.footnote, fontWeight: '600', color: c.textPrimary, fontFamily: 'monospace' },

  // Section title
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: c.textSecondary,
    letterSpacing: 0.8, marginBottom: Spacing.s, marginTop: Spacing.m,
  },

  // Card
  card: {
    backgroundColor: c.surface, borderRadius: Radius.l, padding: Spacing.m,
    marginBottom: Spacing.s,
  },

  // Field
  fieldWrap: { marginBottom: Spacing.s },
  fieldHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  fieldLabel: {
    fontSize: 11, fontWeight: '600', color: c.textSecondary,
    letterSpacing: 0.5, textTransform: 'uppercase',
  },
  fieldInput: {
    backgroundColor: c.background, borderRadius: Radius.m, borderWidth: 1,
    borderColor: c.border, paddingHorizontal: Spacing.m, paddingVertical: 10,
    ...Typography.subhead, color: c.textPrimary,
  },
  fieldInputMulti: {
    minHeight: 80, textAlignVertical: 'top', paddingTop: 10,
  },
  fieldDivider: {
    height: StyleSheet.hairlineWidth, backgroundColor: c.border,
    marginVertical: Spacing.s,
  },

  // Help text
  helpText: {
    ...Typography.caption1, color: c.textTertiary, textAlign: 'center',
    marginTop: Spacing.l, paddingHorizontal: Spacing.l,
  },

  // Action bar
  actionBar: {
    flexDirection: 'row', gap: Spacing.s,
    paddingHorizontal: Spacing.m, paddingVertical: Spacing.m,
    paddingBottom: Platform.OS === 'ios' ? 28 : Spacing.m,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border,
    backgroundColor: c.background,
  },
  discardBtn: {
    flex: 1, height: 52, alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.m, borderWidth: 1, borderColor: c.border,
  },
  discardBtnText: { ...Typography.headline, color: c.textSecondary },
  saveBtn: {
    flex: 2, height: 52, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: Spacing.s,
    backgroundColor: c.textPrimary, borderRadius: Radius.m,
  },
  saveBtnText: { ...Typography.headline, color: c.background },
});
