import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../../theme';

interface StatCardProps {
  label: string;
  count: number;
  style?: object;
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: Radius.m,
    paddingVertical: Spacing.m,
    paddingHorizontal: Spacing.s,
    alignItems: 'center',
    minHeight: 80,
    justifyContent: 'center',
  },
  count: {
    fontSize: 28,
    fontWeight: '700',
    color: c.textPrimary,
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  label: {
    ...Typography.caption1,
    color: c.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
});

export function StatCard({ label, count, style }: StatCardProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.card, style, { transform: [{ scale }], opacity }]}>
      <Text style={styles.count}>{count}</Text>
      <Text
        style={styles.label}
        numberOfLines={1}
        adjustsFontSizeToFit={true}
        minimumFontScale={0.7}
      >
        {label}
      </Text>
    </Animated.View>
  );
}
