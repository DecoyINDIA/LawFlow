import React, { useMemo } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Radius, Spacing } from '../../theme';

interface CFSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  testID?: string;
  autoFocus?: boolean;
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: c.surface, borderRadius: Radius.m,
    paddingHorizontal: Spacing.m, height: 40, gap: Spacing.s,
  },
  input: { flex: 1, ...Typography.subhead, color: c.textPrimary, height: 40 },
});

export function CFSearchBar({ value, onChangeText, placeholder = 'Search...', testID, autoFocus }: CFSearchBarProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={styles.wrap}>
      <Feather name="search" size={15} color={c.textSecondary} />
      <TextInput
        testID={testID}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textTertiary}
        returnKeyType="search"
        autoFocus={autoFocus}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="x-circle" size={14} color={c.textTertiary} />
        </TouchableOpacity>
      )}
    </View>
  );
}
