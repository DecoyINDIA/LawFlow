import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../../theme';
import { StatusBadge } from '../common/StatusBadge';
import { CauseListItem } from '../../types';

interface HearingCardProps {
  item: CauseListItem;
  showRecordOutcome?: boolean;
  onPress?: () => void;
  onRecordOutcome?: () => void;
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  card: {
    backgroundColor: c.background,
    borderRadius: Radius.m,
    marginHorizontal: Spacing.m,
    marginBottom: Spacing.s,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', padding: Spacing.m, gap: Spacing.m },
  left: { flex: 1, gap: 4 },
  caseNumRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotFilled: { backgroundColor: c.textPrimary },
  dotEmpty: { backgroundColor: c.surfaceHighlight },
  caseNum: { ...Typography.caption1, color: c.textTertiary, letterSpacing: 0.5, textTransform: 'uppercase' },
  title: { ...Typography.headline, color: c.textPrimary },
  court: { ...Typography.footnote, color: c.textSecondary },
  right: { alignItems: 'flex-end', gap: 6 },
  time: { ...Typography.caption1, color: c.textSecondary, fontWeight: '600' },
  purposeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.m, paddingBottom: Spacing.m, marginTop: -4,
  },
  purpose: { ...Typography.footnote, color: c.textSecondary },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border },
  outcomeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.m, paddingVertical: 11,
  },
  outcomeBtnText: { ...Typography.subhead, fontWeight: '500', color: c.textPrimary },
});

export function HearingCard({ item, showRecordOutcome, onPress, onRecordOutcome }: HearingCardProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { case: cas, hearing } = item;

  return (
    <TouchableOpacity testID={`hearing-card-${hearing.id}`} onPress={onPress} activeOpacity={0.7} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.left}>
          <View style={styles.caseNumRow}>
            <View style={[styles.dot, cas.status === 'ACTIVE' ? styles.dotFilled : styles.dotEmpty]} />
            <Text style={styles.caseNum}>{cas.caseNumber}</Text>
          </View>
          <Text style={styles.title} numberOfLines={1}>{cas.title}</Text>
          <Text style={styles.court} numberOfLines={1}>
            {cas.courtName}{hearing.courtRoom ? ` · ${hearing.courtRoom}` : ''}
          </Text>
        </View>
        <View style={styles.right}>
          <StatusBadge status={cas.status} small />
          {hearing.hearingTime ? <Text style={styles.time}>{hearing.hearingTime}</Text> : null}
        </View>
      </View>

      {hearing.purpose ? (
        <View style={styles.purposeRow}>
          <Feather name="file-text" size={11} color={c.textTertiary} />
          <Text style={styles.purpose}>{hearing.purpose}</Text>
        </View>
      ) : null}

      {showRecordOutcome && (
        <>
          <View style={styles.divider} />
          <TouchableOpacity
            testID={`record-outcome-${hearing.id}`}
            onPress={onRecordOutcome}
            style={styles.outcomeBtn}
            activeOpacity={0.6}
          >
            <Text style={styles.outcomeBtnText}>Record Outcome</Text>
            <Feather name="chevron-right" size={13} color={c.textSecondary} />
          </TouchableOpacity>
        </>
      )}
    </TouchableOpacity>
  );
}
