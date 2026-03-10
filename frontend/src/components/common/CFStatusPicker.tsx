import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView,
  TextInput, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../../theme';

interface CFStatusPickerProps {
  label: string;
  value: string;
  statuses: string[];
  onSelect: (status: string) => void;
  onAddStatus: (status: string) => void;
  onDeleteStatus: (status: string) => void;
  testID?: string;
}

const DEFAULT_STATUSES = ['FILED', 'ACTIVE', 'ADJOURNED', 'STAYED', 'PENDING', 'DISPOSED'];

function formatStatus(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/_/g, ' ');
}

export function CFStatusPicker({
  label, value, statuses, onSelect, onAddStatus, onDeleteStatus, testID
}: CFStatusPickerProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  const handleAddStatus = () => {
    const trimmed = newStatus.trim().toUpperCase().replace(/\s+/g, '_');
    if (!trimmed) return;
    if (statuses.includes(trimmed)) {
      Alert.alert('Exists', 'This status already exists');
      return;
    }
    onAddStatus(trimmed);
    onSelect(trimmed);
    setNewStatus('');
    setShowAdd(false);
    setOpen(false);
  };

  const handleDelete = (status: string) => {
    if (DEFAULT_STATUSES.includes(status)) {
      Alert.alert('Cannot Delete', 'Default statuses cannot be deleted');
      return;
    }
    Alert.alert('Delete Status', `Delete "${formatStatus(status)}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDeleteStatus(status) },
    ]);
  };

  return (
    <>
      <View style={styles.group}>
        <Text style={styles.label}>{label.toUpperCase()}</Text>
        <TouchableOpacity
          testID={testID}
          style={styles.trigger}
          onPress={() => setOpen(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.statusDot, value === 'ACTIVE' && styles.statusDotActive]} />
          <Text style={styles.triggerText}>{formatStatus(value)}</Text>
          <Feather name="chevron-down" size={15} color={c.textSecondary} />
        </TouchableOpacity>
      </View>

      <Modal visible={open} transparent animationType="slide" statusBarTranslucent>
        <TouchableOpacity
          style={styles.backdrop}
          onPress={() => { setOpen(false); setShowAdd(false); }}
          activeOpacity={1}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Select Status</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {statuses.map(s => (
                <TouchableOpacity
                  key={s}
                  style={styles.opt}
                  onPress={() => { onSelect(s); setOpen(false); }}
                  onLongPress={() => handleDelete(s)}
                  activeOpacity={0.7}
                >
                  <View style={styles.optLeft}>
                    <View style={[styles.statusDot, s === 'ACTIVE' && styles.statusDotActive]} />
                    <Text style={[styles.optText, value === s && styles.optTextActive]}>
                      {formatStatus(s)}
                    </Text>
                  </View>
                  {value === s ? (
                    <Feather name="check" size={16} color={c.textPrimary} />
                  ) : !DEFAULT_STATUSES.includes(s) ? (
                    <TouchableOpacity
                      onPress={() => handleDelete(s)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Feather name="x" size={14} color={c.textTertiary} />
                    </TouchableOpacity>
                  ) : null}
                </TouchableOpacity>
              ))}

              {/* Add Custom Status */}
              {showAdd ? (
                <View style={styles.addForm}>
                  <TextInput
                    style={styles.addInput}
                    value={newStatus}
                    onChangeText={setNewStatus}
                    placeholder="Custom status name…"
                    placeholderTextColor={c.textTertiary}
                    autoFocus
                    autoCapitalize="words"
                  />
                  <View style={styles.addBtns}>
                    <TouchableOpacity
                      style={styles.addCancelBtn}
                      onPress={() => { setShowAdd(false); setNewStatus(''); }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.addCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.addSaveBtn}
                      onPress={handleAddStatus}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.addSaveText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.addStatusBtn}
                  onPress={() => setShowAdd(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.addIcon}>
                    <Feather name="plus" size={14} color={c.background} />
                  </View>
                  <Text style={styles.addStatusText}>Add Custom Status</Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            <Text style={styles.hint}>Long press to delete custom status</Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  group: { marginBottom: Spacing.m },
  label: { fontSize: 11, fontWeight: '600', color: c.textSecondary, letterSpacing: 0.8, marginBottom: Spacing.s },
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.m,
    backgroundColor: c.surface, borderRadius: Radius.m, height: 48, paddingHorizontal: Spacing.m,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.textTertiary },
  statusDotActive: { backgroundColor: c.textPrimary },
  triggerText: { flex: 1, ...Typography.body, color: c.textPrimary },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 40, maxHeight: '70%',
  },
  handle: { width: 36, height: 4, backgroundColor: c.surfaceHighlight, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: Spacing.m },
  sheetTitle: { ...Typography.headline, color: c.textPrimary, paddingHorizontal: Spacing.l, marginBottom: Spacing.m },

  opt: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.l, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  optLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.m },
  optText: { ...Typography.body, color: c.textPrimary },
  optTextActive: { fontWeight: '600' },

  addStatusBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.m,
    paddingHorizontal: Spacing.l, paddingVertical: 14,
  },
  addIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: c.textPrimary, alignItems: 'center', justifyContent: 'center' },
  addStatusText: { ...Typography.subhead, fontWeight: '600', color: c.textPrimary },

  addForm: { paddingHorizontal: Spacing.l, paddingVertical: Spacing.m },
  addInput: {
    backgroundColor: c.surface, borderRadius: Radius.m, height: 44, paddingHorizontal: Spacing.m,
    ...Typography.body, color: c.textPrimary, marginBottom: Spacing.m,
  },
  addBtns: { flexDirection: 'row', gap: Spacing.s },
  addCancelBtn: {
    flex: 1, height: 40, backgroundColor: c.surface, borderRadius: Radius.m,
    alignItems: 'center', justifyContent: 'center',
  },
  addCancelText: { ...Typography.subhead, fontWeight: '600', color: c.textSecondary },
  addSaveBtn: {
    flex: 1, height: 40, backgroundColor: c.textPrimary, borderRadius: Radius.m,
    alignItems: 'center', justifyContent: 'center',
  },
  addSaveText: { ...Typography.subhead, fontWeight: '600', color: c.background },

  hint: { ...Typography.caption1, color: c.textTertiary, textAlign: 'center', marginTop: Spacing.m },
});
