import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Modal,
  StyleSheet, ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../../theme';

export interface PickerOption { label: string; value: string; }

interface CFPickerProps {
  label: string;
  value: string;
  options: PickerOption[];
  onSelect: (value: string) => void;
  placeholder?: string;
  testID?: string;
}

export function CFPicker({
  label, value, options, onSelect, placeholder = 'Select...', testID
}: CFPickerProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

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
          <Text style={[styles.triggerText, !selected && styles.ph]}>
            {selected?.label ?? placeholder}
          </Text>
          <Feather name="chevron-down" size={15} color={c.textSecondary} />
        </TouchableOpacity>
      </View>

      <Modal visible={open} transparent animationType="slide" statusBarTranslucent>
        <TouchableOpacity
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          activeOpacity={1}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{label}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {options.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={styles.opt}
                  onPress={() => { onSelect(opt.value); setOpen(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optText, value === opt.value && styles.optActive]}>
                    {opt.label}
                  </Text>
                  {value === opt.value && (
                    <Feather name="check" size={16} color={c.textPrimary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: c.surface, borderRadius: Radius.m, height: 48, paddingHorizontal: Spacing.m,
  },
  triggerText: { ...Typography.body, color: c.textPrimary },
  ph: { color: c.textTertiary },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 44, maxHeight: '65%',
  },
  handle: { width: 36, height: 4, backgroundColor: c.surfaceHighlight, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: Spacing.m },
  sheetTitle: { ...Typography.headline, color: c.textPrimary, paddingHorizontal: Spacing.l, marginBottom: 4 },
  opt: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.l, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  optText: { ...Typography.body, color: c.textPrimary },
  optActive: { fontWeight: '600' },
});
