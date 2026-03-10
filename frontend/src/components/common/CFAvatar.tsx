import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useColors, ColorPalette } from '../../theme';

interface CFAvatarProps {
  name: string;
  size?: number;
  onPress?: () => void;
  testID?: string;
}

function getInitials(name: string): string {
  const clean = name.replace(/^Adv\.\s*/i, '').trim();
  const parts = clean.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return clean.substring(0, 2).toUpperCase();
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  container: { backgroundColor: c.textPrimary, justifyContent: 'center', alignItems: 'center' },
  initials: { color: c.background, fontWeight: '600', letterSpacing: 0.5 },
});

export function CFAvatar({ name, size = 36, onPress, testID }: CFAvatarProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const fontSize = Math.floor(size * 0.36);

  const content = (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.initials, { fontSize }]}>{getInitials(name)}</Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.8}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}
