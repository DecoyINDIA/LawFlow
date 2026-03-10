import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Spacing, Radius } from '../../theme';
import { CFDatePicker } from './CFDatePicker';
import { Hearing } from '../../types';

interface AddHearingModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (hearing: {
    hearingDate: number;
    hearingTime?: string;
    courtName: string;
    purpose?: string;
    notes?: string;
  }) => void;
  courtName: string;  // Pre-filled from case
  existingHearing?: Hearing;  // For edit mode
}

export function AddHearingModal({
  visible, onClose, onSave, courtName: defaultCourtName, existingHearing
}: AddHearingModalProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [hearingDate, setHearingDate] = useState<number | undefined>();
  const [hearingTime, setHearingTime] = useState('');
  const [courtName, setCourtName] = useState(defaultCourtName);
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEdit = !!existingHearing;

  useEffect(() => {
    if (visible) {
      if (existingHearing) {
        setHearingDate(existingHearing.hearingDate);
        setHearingTime(existingHearing.hearingTime ?? '');
        setCourtName(existingHearing.courtRoom ?? defaultCourtName);
        setPurpose(existingHearing.purpose ?? '');
        setNotes(existingHearing.notes ?? '');
      } else {
        setHearingDate(undefined);
        setHearingTime('');
        setCourtName(defaultCourtName);
        setPurpose('');
        setNotes('');
      }
      setErrors({});
    }
  }, [visible, existingHearing, defaultCourtName]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!hearingDate) e.date = 'Date is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({
      hearingDate: hearingDate!,
      hearingTime: hearingTime.trim() || undefined,
      courtName: courtName.trim(),
      purpose: purpose.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

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
              <Text style={styles.title}>{isEdit ? 'Edit Hearing' : 'Add Hearing'}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Feather name="x" size={20} color={c.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Hearing Date */}
              <CFDatePicker
                label="Hearing Date"
                value={hearingDate}
                onChange={setHearingDate}
                placeholder="Select date…"
                required
              />
              {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}

              {/* Hearing Time */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>HEARING TIME (OPTIONAL)</Text>
                <TextInput
                  style={styles.input}
                  value={hearingTime}
                  onChangeText={setHearingTime}
                  placeholder="e.g., 10:30 AM"
                  placeholderTextColor="#6E6E73"
                />
              </View>

              {/* Court Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>COURT NAME</Text>
                <TextInput
                  style={styles.input}
                  value={courtName}
                  onChangeText={setCourtName}
                  placeholder="Bombay High Court"
                  placeholderTextColor="#6E6E73"
                />
              </View>

              {/* Purpose / Stage */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>PURPOSE / STAGE</Text>
                <TextInput
                  style={styles.input}
                  value={purpose}
                  onChangeText={setPurpose}
                  placeholder="e.g., Arguments, Evidence, Judgment"
                  placeholderTextColor="#6E6E73"
                />
              </View>

              {/* Notes */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>NOTES (OPTIONAL)</Text>
                <TextInput
                  style={[styles.input, styles.inputMulti]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Additional notes…"
                  placeholderTextColor="#6E6E73"
                  multiline
                  textAlignVertical="top"
                />
              </View>

              {/* Save Button */}
              <TouchableOpacity testID="save-hearing-btn" style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
                <Text style={styles.saveBtnText}>{isEdit ? 'Save Changes' : 'Add Hearing'}</Text>
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
    marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: '700', color: c.textPrimary },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#6E6E73', letterSpacing: 0.8, marginBottom: 8 },
  input: {
    backgroundColor: '#F5F5F5', borderRadius: 12, height: 48, paddingHorizontal: 16,
    fontSize: 15, color: c.textPrimary, borderWidth: 1, borderColor: 'transparent',
  },
  inputMulti: { height: 100, paddingTop: 14, paddingBottom: 14 },
  errorText: { fontSize: 13, color: '#6E6E73', marginTop: -12, marginBottom: 16 },

  saveBtn: {
    backgroundColor: c.textPrimary, borderRadius: 12, height: 50,
    alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 16,
  },
  saveBtnText: { fontSize: 17, fontWeight: '600', color: c.background },
});
