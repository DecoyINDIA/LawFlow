import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../src/theme';
import { useApp } from '../src/context/AppContext';

const EXPORTS = [
  { id: 'all-cases-csv', icon: 'list', title: 'All Cases (CSV)', sub: 'Export complete case registry', ext: 'CSV' },
  { id: 'active-cases-pdf', icon: 'file-text', title: 'Active Cases (PDF)', sub: 'Summary of all active cases', ext: 'PDF' },
  { id: 'cause-list', icon: 'calendar', title: "Today's Cause List", sub: 'All hearings scheduled today', ext: 'PDF' },
  { id: 'upcoming-hearings', icon: 'clock', title: 'Upcoming Hearings (7 days)', sub: 'Next week hearing schedule', ext: 'PDF' },
  { id: 'clients-csv', icon: 'users', title: 'Clients Directory (CSV)', sub: 'All client contact details', ext: 'CSV' },
  { id: 'hearing-history', icon: 'archive', title: 'Hearing History', sub: 'Complete hearing log with outcomes', ext: 'CSV' },
];

export default function ExportScreen() {
  const router = useRouter();
  const { cases, clients, hearings } = useApp();
  const [loading, setLoading] = useState<string | null>(null);

  const handleExport = async (id: string, title: string) => {
    setLoading(id);
    await new Promise(r => setTimeout(r, 1200));
    setLoading(null);
    Alert.alert('✓ Export Ready', `"${title}" has been generated.\n\nIn production this would download to your device.`);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Export</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {/* Summary stats */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statNum}>{cases.length}</Text>
            <Text style={s.statLabel}>Cases</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statNum}>{clients.length}</Text>
            <Text style={s.statLabel}>Clients</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statNum}>{hearings.length}</Text>
            <Text style={s.statLabel}>Hearings</Text>
          </View>
        </View>

        <Text style={s.sectionLabel}>EXPORT OPTIONS</Text>

        {EXPORTS.map(exp => (
          <TouchableOpacity
            key={exp.id}
            testID={`export-${exp.id}`}
            style={s.exportCard}
            onPress={() => handleExport(exp.id, exp.title)}
            activeOpacity={0.7}
          >
            <View style={s.exportIcon}>
              <Feather name={exp.icon as any} size={20} color={Colors.textPrimary} />
            </View>
            <View style={s.exportInfo}>
              <Text style={s.exportTitle}>{exp.title}</Text>
              <Text style={s.exportSub}>{exp.sub}</Text>
            </View>
            <View style={s.extBadge}>
              <Text style={s.extText}>{exp.ext}</Text>
            </View>
            {loading === exp.id ? (
              <View style={s.loadingIndicator}>
                <Feather name="loader" size={16} color={Colors.textSecondary} />
              </View>
            ) : (
              <Feather name="download" size={16} color={Colors.textSecondary} />
            )}
          </TouchableOpacity>
        ))}

        <Text style={s.disclaimer}>
          Exports are currently in mock mode. In production, files will be generated and saved to your device.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.m, paddingTop: Spacing.s, paddingBottom: Spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, ...Typography.headline, color: Colors.textPrimary, textAlign: 'center' },
  content: { padding: Spacing.m, paddingBottom: 32 },
  statsRow: { flexDirection: 'row', gap: Spacing.s, marginBottom: Spacing.l },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.m, padding: Spacing.m, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  statLabel: { ...Typography.caption1, color: Colors.textSecondary, marginTop: 2 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.8, marginBottom: Spacing.m },
  exportCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.m,
    backgroundColor: Colors.surface, borderRadius: Radius.m,
    padding: Spacing.m, marginBottom: Spacing.s,
  },
  exportIcon: { width: 44, height: 44, borderRadius: Radius.s, backgroundColor: Colors.surfaceHighlight, alignItems: 'center', justifyContent: 'center' },
  exportInfo: { flex: 1, gap: 3 },
  exportTitle: { ...Typography.subhead, fontWeight: '500', color: Colors.textPrimary },
  exportSub: { ...Typography.caption1, color: Colors.textSecondary },
  extBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, backgroundColor: Colors.surfaceHighlight },
  extText: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.3 },
  loadingIndicator: { width: 16, alignItems: 'center' },
  disclaimer: { ...Typography.caption1, color: Colors.textTertiary, textAlign: 'center', marginTop: Spacing.l, lineHeight: 18 },
});
