import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView,
  TextInput, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../../theme';

interface PartyTypePickerProps {
  label: string;
  value: string;
  partyTypes: string[];
  onSelect: (type: string) => void;
  onAddType: (type: string) => void;
  onDeleteType: (type: string) => void;
  testID?: string;
}

const DEFAULT_TYPES = ['Individual', 'Corporate', 'NGO', 'Government'];

export function PartyTypePicker({
  label, value, partyTypes, onSelect, onAddType, onDeleteType, testID
}: PartyTypePickerProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newType, setNewType] = useState('');

  const allTypes = [...DEFAULT_TYPES, ...partyTypes.filter(t => !DEFAULT_TYPES.includes(t))];

  const handleAddType = () => {
    const trimmed = newType.trim();
    if (!trimmed) return;
    if (allTypes.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert('Exists', 'This type already exists');
      return;
    }
    onAddType(trimmed);
    onSelect(trimmed);
    setNewType('');
    setShowAdd(false);
    setOpen(false);
  };

  const handleDelete = (type: string) => {
    if (DEFAULT_TYPES.includes(type)) {
      Alert.alert('Cannot Delete', 'Default types cannot be deleted');
      return;
    }
    Alert.alert('Delete Type', `Delete "${type}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDeleteType(type) },
    ]);
  };

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <View style={styles.chipsRow}>
        {allTypes.map(t => (
          <TouchableOpacity
            key={t}
            testID={testID ? `${testID}-${t}` : undefined}
            style={[styles.chip, value === t && styles.chipOn]}
            onPress={() => onSelect(t)}
            onLongPress={() => handleDelete(t)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, value === t && styles.chipTextOn]}>{t}</Text>
            {!DEFAULT_TYPES.includes(t) && (
              <TouchableOpacity
                onPress={() => handleDelete(t)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.chipDelete}
              >
                <Feather name="x" size={10} color={value === t ? c.background : c.textTertiary} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={styles.addChip}
          onPress={() => setOpen(true)}
          activeOpacity={0.7}
        >
          <Feather name="plus" size={12} color={c.textSecondary} />
          <Text style={styles.addChipText}>Custom</Text>
        </TouchableOpacity>
      </View>

      {/* Add custom type modal */}
      <Modal visible={open} transparent animationType="fade" statusBarTranslucent>
        <TouchableOpacity
          style={styles.backdrop}
          onPress={() => { setOpen(false); setShowAdd(false); setNewType(''); }}
          activeOpacity={1}
        >
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Add Custom Type</Text>
            <TextInput
              style={styles.input}
              value={newType}
              onChangeText={setNewType}
              placeholder="e.g., Trust, Society, Partnership"
              placeholderTextColor={c.textTertiary}
              autoFocus
              autoCapitalize="words"
            />
            <View style={styles.btns}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setOpen(false); setNewType(''); }}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={handleAddType}
                activeOpacity={0.8}
              >
                <Text style={styles.addBtnText}>Add Type</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  group: { marginBottom: Spacing.m },
  label: { fontSize: 11, fontWeight: '600', color: c.textSecondary, letterSpacing: 0.8, marginBottom: Spacing.s },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.s },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full,
    backgroundColor: c.surface,
  },
  chipOn: { backgroundColor: c.textPrimary },
  chipText: { ...Typography.footnote, fontWeight: '600', color: c.textSecondary },
  chipTextOn: { color: c.background },
  chipDelete: { marginLeft: 2 },
  addChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full,
    borderWidth: 1, borderColor: c.border, borderStyle: 'dashed',
  },
  addChipText: { ...Typography.footnote, color: c.textSecondary },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  sheet: {
    backgroundColor: c.background, borderRadius: Radius.l, padding: Spacing.l,
    width: '85%', maxWidth: 320,
  },
  sheetTitle: { ...Typography.headline, color: c.textPrimary, marginBottom: Spacing.m },
  input: {
    backgroundColor: c.surface, borderRadius: Radius.m, height: 48, paddingHorizontal: Spacing.m,
    ...Typography.body, color: c.textPrimary, marginBottom: Spacing.m,
  },
  btns: { flexDirection: 'row', gap: Spacing.s },
  cancelBtn: {
    flex: 1, height: 44, backgroundColor: c.surface, borderRadius: Radius.m,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { ...Typography.subhead, fontWeight: '600', color: c.textSecondary },
  addBtn: {
    flex: 1, height: 44, backgroundColor: c.textPrimary, borderRadius: Radius.m,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: { ...Typography.subhead, fontWeight: '600', color: c.background },
});
