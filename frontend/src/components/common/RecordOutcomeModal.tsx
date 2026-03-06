import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Spacing, Radius } from '../../theme';
import { CFDatePicker } from './CFDatePicker';
import { Hearing } from '../../types';

interface RecordOutcomeModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: {
    outcome: string;
    nextDate?: number;
    notes?: string;
    shouldUpdateCaseStatus?: boolean;
  }) => void;
  hearing: Hearing | null;
}

const OUTCOME_OPTIONS = [
  { value: 'HEARD', label: 'Heard' },
  { value: 'ADJOURNED', label: 'Adjourned' },
  { value: 'STAYED', label: 'Stayed' },
  { value: 'PART_HEARD', label: 'Part Heard' },
  { value: 'JUDGMENT_RESERVED', label: 'Judgment Reserved' },
  { value: 'DISPOSED', label: 'Disposed' },
];

export function RecordOutcomeModal({
  visible, onClose, onSave, hearing
}: RecordOutcomeModalProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [outcome, setOutcome] = useState('');
  const [nextDate, setNextDate] = useState<number | undefined>();
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Show next date picker for Adjourned or Part Heard
  const showNextDate = outcome === 'ADJOURNED' || outcome === 'PART_HEARD';
  const isDisposed = outcome === 'DISPOSED';

  useEffect(() => {
    if (visible) {
      setOutcome(hearing?.outcome ?? '');
      setNextDate(undefined);
      setNotes(hearing?.notes ?? '');
      setErrors({});
    }
  }, [visible, hearing]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!outcome) e.outcome = 'Please select an outcome';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const outcomeLabel = OUTCOME_OPTIONS.find(o => o.value === outcome)?.label ?? outcome;
    onSave({
      outcome: outcomeLabel,
      nextDate: showNextDate ? nextDate : undefined,
      notes: notes.trim() || undefined,
      shouldUpdateCaseStatus: isDisposed,
    });
    onClose();
  };

  if (!hearing) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            {/* Drag Handle */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Record Outcome</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Feather name="x" size={20} color={c.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Hearing Info */}
              <View style={styles.hearingInfo}>
                <Text style={styles.hearingDate}>
                  {new Date(hearing.hearingDate).toLocaleDateString('en-US', {
                    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                  })}
                </Text>
                {hearing.purpose && <Text style={styles.hearingPurpose}>{hearing.purpose}</Text>}
              </View>

              {/* Outcome Selection */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>OUTCOME *</Text>
                <View style={styles.outcomeChips}>
                  {OUTCOME_OPTIONS.map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.outcomeChip,
                        outcome === opt.value && styles.outcomeChipOn,
                        opt.value === 'DISPOSED' && styles.outcomeChipDisposed,
                        outcome === opt.value && opt.value === 'DISPOSED' && styles.outcomeChipDisposedOn,
                      ]}
                      onPress={() => setOutcome(opt.value)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.outcomeChipText,
                        outcome === opt.value && styles.outcomeChipTextOn,
                        opt.value === 'DISPOSED' && styles.outcomeChipTextDisposed,
                        outcome === opt.value && opt.value === 'DISPOSED' && styles.outcomeChipTextDisposedOn,
                      ]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {errors.outcome && <Text style={styles.errorText}>{errors.outcome}</Text>}
              </View>

              {/* Next Date (conditional) */}
              {showNextDate && (
                <CFDatePicker
                  label="Next Date"
                  value={nextDate}
                  onChange={setNextDate}
                  placeholder="Select next hearing date…"
                />
              )}

              {/* Disposed Warning */}
              {isDisposed && (
                <View style={styles.disposedWarning}>
                  <Feather name="alert-circle" size={16} color="#34C759" />
                  <Text style={styles.disposedWarningText}>
                    Case status will be updated to "Disposed"
                  </Text>
                </View>
              )}

              {/* Notes */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>NOTES (OPTIONAL)</Text>
                <TextInput
                  style={[styles.input, styles.inputMulti]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Outcome details, remarks…"
                  placeholderTextColor="#6E6E73"
                  multiline
                  textAlignVertical="top"
                />
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveBtn, !outcome && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={!outcome}
                activeOpacity={0.8}
              >
                <Text style={styles.saveBtnText}>Save Outcome</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.background, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '90%',
  },
  handle: {
    width: 36, height: 4, backgroundColor: '#E5E5E5', borderRadius: 2,
    alignSelf: 'center', marginTop: 8, marginBottom: 16,
  },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '700', color: c.textPrimary },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  hearingInfo: {
    backgroundColor: '#F5F5F5', borderRadius: 12, padding: 16, marginBottom: 20,
  },
  hearingDate: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
  hearingPurpose: { fontSize: 14, color: '#6E6E73', marginTop: 4 },

  fieldGroup: { marginBottom: 20 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#6E6E73', letterSpacing: 0.8, marginBottom: 12 },

  outcomeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  outcomeChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  outcomeChipOn: { backgroundColor: c.textPrimary },
  outcomeChipDisposed: { borderWidth: 1, borderColor: '#34C759', backgroundColor: 'transparent' },
  outcomeChipDisposedOn: { backgroundColor: '#34C759', borderColor: '#34C759' },
  outcomeChipText: { fontSize: 14, fontWeight: '600', color: '#6E6E73' },
  outcomeChipTextOn: { color: c.background },
  outcomeChipTextDisposed: { color: '#34C759' },
  outcomeChipTextDisposedOn: { color: c.background },

  errorText: { fontSize: 13, color: '#6E6E73', marginTop: 8 },

  disposedWarning: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(52, 199, 89, 0.1)', borderRadius: 12, padding: 14, marginBottom: 20,
  },
  disposedWarningText: { fontSize: 14, color: '#34C759', flex: 1 },

  input: {
    backgroundColor: '#F5F5F5', borderRadius: 12, height: 48, paddingHorizontal: 16,
    fontSize: 15, color: c.textPrimary,
  },
  inputMulti: { height: 100, paddingTop: 14, paddingBottom: 14 },

  saveBtn: {
    backgroundColor: c.textPrimary, borderRadius: 12, height: 50,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 17, fontWeight: '600', color: c.background },
});
