import React, { useMemo } from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { useColors, ColorPalette, Typography, Radius, Spacing } from '../../theme';

interface CFTextInputProps extends TextInputProps {
  label?: string;
  error?: string;
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  group: { marginBottom: Spacing.m },
  label: { fontSize: 11, fontWeight: '600', color: c.textSecondary, letterSpacing: 0.8, marginBottom: Spacing.s },
  input: {
    backgroundColor: c.surface, borderRadius: Radius.m,
    height: 48, paddingHorizontal: Spacing.m,
    ...Typography.body, color: c.textPrimary,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  multiline: { height: 96, paddingTop: Spacing.m, textAlignVertical: 'top' },
  inputErr: { borderColor: c.textPrimary },
  err: { ...Typography.caption1, color: c.textPrimary, opacity: 0.6, marginTop: 4 },
});

export function CFTextInput({ label, error, style, ...rest }: CFTextInputProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={styles.group}>
      {label ? <Text style={styles.label}>{label.toUpperCase()}</Text> : null}
      <TextInput
        style={[styles.input, rest.multiline && styles.multiline, error && styles.inputErr, style]}
        placeholderTextColor={c.textTertiary}
        {...rest}
      />
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  );
}
