import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, ColorPalette, Typography, Radius } from '../../theme';
import { CaseStatus, CasePriority } from '../../types';

interface StatusBadgeProps {
  status?: CaseStatus;
  priority?: CasePriority;
  small?: boolean;
}

const STATUS_LABELS: Record<CaseStatus, string> = {
  ACTIVE: 'Active',
  ADJOURNED: 'Adjourned',
  DISPOSED: 'Disposed',
  STAYED: 'Stayed',
  PENDING: 'Pending',
  FILED: 'Filed',
};

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  small: { paddingHorizontal: 6, paddingVertical: 2 },
  filled: { backgroundColor: c.textPrimary },
  outlined: { backgroundColor: c.surfaceHighlight },
  text: { ...Typography.caption2, fontWeight: '700', letterSpacing: 0.4 },
  smallText: { fontSize: 9 },
  filledText: { color: c.background },
  outlinedText: { color: c.textSecondary },
});

export function StatusBadge({ status, priority, small }: StatusBadgeProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const label = status ? STATUS_LABELS[status] : priority ?? null;
  if (!label) return null;
  const isFilled = status === 'ACTIVE' || priority === 'HIGH';

  return (
    <View style={[styles.badge, small && styles.small, isFilled ? styles.filled : styles.outlined]}>
      <Text style={[styles.text, small && styles.smallText, isFilled ? styles.filledText : styles.outlinedText]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}
