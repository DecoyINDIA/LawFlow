import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../../theme';
import { CauseListItem } from '../../types';

interface UpcomingHearingRowProps {
  item: CauseListItem;
  onPress?: () => void;
  isLast?: boolean;
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.m,
    gap: Spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  rowLast: { borderBottomWidth: 0 },
  dateBox: { width: 40, alignItems: 'center' },
  day: { ...Typography.title3, color: c.textPrimary },
  month: { ...Typography.caption2, color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  info: { flex: 1, gap: 3 },
  title: { ...Typography.subhead, fontWeight: '600', color: c.textPrimary },
  court: { ...Typography.caption1, color: c.textSecondary },
  meta: { flexDirection: 'row', gap: Spacing.xs },
  purpose: { ...Typography.caption2, color: c.textTertiary },
  arrow: { marginLeft: 'auto' as any },
  primary: { backgroundColor: c.textPrimary },
  ghost: {},
  primaryText: { color: c.background },
  ghostText: { color: c.textPrimary },
});

export function UpcomingHearingRow({ item, onPress, isLast }: UpcomingHearingRowProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { case: cas, hearing } = item;
  const d = new Date(hearing.hearingDate);
  const day = d.getDate();
  const month = d.toLocaleString('en-US', { month: 'short' });

  return (
    <TouchableOpacity
      testID={`upcoming-row-${hearing.id}`}
      style={[styles.row, isLast && styles.rowLast]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.dateBox}>
        <Text style={styles.day}>{day}</Text>
        <Text style={styles.month}>{month}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{cas.title}</Text>
        <Text style={styles.court} numberOfLines={1}>{cas.courtName}</Text>
        {hearing.purpose ? (
          <View style={styles.meta}>
            <Text style={styles.purpose}>{hearing.purpose}</Text>
          </View>
        ) : null}
      </View>
      <Feather name="chevron-right" size={14} color={c.textTertiary} />
    </TouchableOpacity>
  );
}
