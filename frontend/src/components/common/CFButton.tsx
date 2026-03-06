import React, { useMemo } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { useColors, ColorPalette, Typography, Radius } from '../../theme';

interface CFButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  base: { height: 50, borderRadius: Radius.m, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  primary: { backgroundColor: c.textPrimary },
  secondary: { backgroundColor: c.surface },
  ghost: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.4 },
  text: { ...Typography.headline },
  primaryText: { color: c.background },
  secondaryText: { color: c.textPrimary },
  ghostText: { color: c.textPrimary },
});

export function CFButton({ title, onPress, variant = 'primary', loading, disabled, style, testID }: CFButtonProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? c.background : c.textPrimary} size="small" />
      ) : (
        <Text style={[
          styles.text,
          variant === 'primary' && styles.primaryText,
          variant === 'secondary' && styles.secondaryText,
          variant === 'ghost' && styles.ghostText,
        ]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}
