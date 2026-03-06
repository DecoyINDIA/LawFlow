import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../src/theme';
import { useApp } from '../src/context/AppContext';
import { exportFullData, exportCasesCSV } from '../src/utils/pdfReports';
import {
  requestPermissions,
  rescheduleAllReminders,
} from '../src/utils/notificationService';
import * as Notifications from 'expo-notifications';

const REMINDER_OPTIONS = [
  { label: 'Same day', value: 0 },
  { label: '1 day before', value: 1 },
  { label: '2 days before', value: 2 },
];

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.m, paddingTop: Spacing.s, paddingBottom: Spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, ...Typography.headline, color: c.textPrimary, textAlign: 'center' },
  content: { paddingHorizontal: Spacing.m, paddingBottom: 48 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: c.textSecondary,
    letterSpacing: 0.8, marginBottom: Spacing.s, marginTop: Spacing.l,
  },
  section: { backgroundColor: c.surface, borderRadius: Radius.m, overflow: 'hidden' },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.m, paddingVertical: 14, minHeight: 48,
  },
  rowInfo: { flex: 1 },
  rowLabel: { ...Typography.subhead, fontWeight: '500', color: c.textPrimary },
  rowSub: { ...Typography.caption1, color: c.textSecondary, marginTop: 2 },
  danger: { color: '#FF3B30' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginHorizontal: Spacing.m },
  versionText: { ...Typography.footnote, color: c.textSecondary },
  pickerBox: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    backgroundColor: c.background,
  },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.m, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  pickerLabel: { ...Typography.subhead, color: c.textPrimary },
  pickerLabelSelected: { fontWeight: '700' },
  notifMsg: {
    fontSize: 12,
    color: c.textSecondary,
    paddingHorizontal: Spacing.l,
    paddingVertical: 6,
    marginBottom: 4,
  },
});

export default function SettingsScreen() {
  const router = useRouter();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { settings, updateSettings, clearAllData, cases, clients, hearings, advocateName, backupToGoogleDrive, restoreFromGoogleDrive, lastBackupAt } = useApp();
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [backing, setBacking] = useState(false);
  const [notifMsg, setNotifMsg] = useState('');

  const showNotifMsg = useCallback((msg: string) => {
    setNotifMsg(msg);
    setTimeout(() => setNotifMsg(''), 3000);
  }, []);

  const handleRemindersToggle = useCallback(async (v: boolean) => {
    updateSettings({ hearingReminders: v });
    if (v) {
      await requestPermissions();
      const newSettings = { ...settings, hearingReminders: true };
      const count = await rescheduleAllReminders(cases, hearings, newSettings);
      showNotifMsg(`✓ Reminders scheduled for ${count} upcoming hearing${count !== 1 ? 's' : ''}`);
    } else {
      if (Platform.OS !== 'web') {
        await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
      }
      showNotifMsg('Reminders turned off');
    }
  }, [settings, cases, hearings, updateSettings, showNotifMsg]);

  const handleReminderTimeChange = useCallback(async (value: number) => {
    updateSettings({ reminderDaysBeforeHearing: value });
    setShowReminderPicker(false);
    const newSettings = { ...settings, reminderDaysBeforeHearing: value };
    const count = await rescheduleAllReminders(cases, hearings, newSettings);
    showNotifMsg(`✓ Updated — reminders rescheduled for ${count} hearing${count !== 1 ? 's' : ''}`);
  }, [settings, cases, hearings, updateSettings, showNotifMsg]);

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will remove all cases, clients, hearings, and voice notes. Your profile and settings will be kept. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All', style: 'destructive',
          onPress: async () => {
            await clearAllData();
            Alert.alert('Done', 'All data has been cleared.');
          }
        },
      ]
    );
  };

  const handleExportData = () => {
    Alert.alert(
      'Export Data',
      'Choose an export format:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export as PDF',
          onPress: async () => {
            setExporting(true);
            await exportFullData({ advocateName, cases, clients, hearings });
            setExporting(false);
          },
        },
        {
          text: 'Export as CSV',
          onPress: async () => {
            setExporting(true);
            await exportCasesCSV({ cases, clients });
            setExporting(false);
          },
        },
      ]
    );
  };

  const reminderLabel = REMINDER_OPTIONS.find(o => o.value === settings.reminderDaysBeforeHearing)?.label ?? '1 day before';

  function formatBackupTime(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    const today = new Date();
    const isToday = d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (isToday) return `Today, ${time}`;
    const month = d.toLocaleString('default', { month: 'short' });
    return `${month} ${d.getDate()}, ${time}`;
  }

  const handleBackup = useCallback(async () => {
    setBacking(true);
    await backupToGoogleDrive();
    setBacking(false);
  }, [backupToGoogleDrive]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} testID="settings-back-btn">
          <Feather name="arrow-left" size={22} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Appearance */}
        <Text style={styles.sectionLabel}>APPEARANCE</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowLabel}>Dark Mode</Text>
              <Text style={styles.rowSub}>Switch to dark theme</Text>
            </View>
            <Switch
              testID="dark-mode-toggle"
              value={settings.darkMode}
              onValueChange={v => updateSettings({ darkMode: v })}
              trackColor={{ false: c.surfaceHighlight, true: c.textPrimary }}
              thumbColor={c.background}
            />
          </View>
        </View>

        {/* Notifications */}
        <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowLabel}>Hearing Reminders</Text>
              <Text style={styles.rowSub}>Get notified before hearings</Text>
            </View>
            <Switch
              testID="reminders-toggle"
              value={settings.hearingReminders}
              onValueChange={handleRemindersToggle}
              trackColor={{ false: c.surfaceHighlight, true: c.textPrimary }}
              thumbColor={c.background}
            />
          </View>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.row}
            onPress={() => setShowReminderPicker(p => !p)}
            activeOpacity={0.7}
            testID="reminder-time-row"
          >
            <View style={styles.rowInfo}>
              <Text style={styles.rowLabel}>Reminder Time</Text>
              <Text style={styles.rowSub}>{reminderLabel}</Text>
            </View>
            <Feather name={showReminderPicker ? 'chevron-up' : 'chevron-down'} size={15} color={c.textTertiary} />
          </TouchableOpacity>
          {showReminderPicker && (
            <View style={styles.pickerBox}>
              {REMINDER_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={styles.pickerRow}
                  onPress={() => handleReminderTimeChange(opt.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerLabel, settings.reminderDaysBeforeHearing === opt.value && styles.pickerLabelSelected]}>
                    {opt.label}
                  </Text>
                  {settings.reminderDaysBeforeHearing === opt.value && (
                    <Feather name="check" size={14} color={c.textPrimary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        {/* Inline notification message */}
        {notifMsg !== '' && (
          <Text testID="notif-inline-msg" style={styles.notifMsg}>{notifMsg}</Text>
        )}

        {/* Data */}
        <Text style={styles.sectionLabel}>DATA</Text>
        <View style={styles.section}>
          <TouchableOpacity
            testID="export-data-btn"
            style={styles.row}
            onPress={handleExportData}
            activeOpacity={0.7}
            disabled={exporting}
          >
            <View style={styles.rowInfo}>
              <Text style={styles.rowLabel}>{exporting ? 'Exporting…' : 'Export Data'}</Text>
              <Text style={styles.rowSub}>PDF or CSV — all cases & clients</Text>
            </View>
            <Feather name="chevron-right" size={15} color={c.textTertiary} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            testID="clear-data-btn"
            style={styles.row}
            onPress={handleClearData}
            activeOpacity={0.7}
          >
            <View style={styles.rowInfo}>
              <Text style={[styles.rowLabel, styles.danger]}>Clear All Data</Text>
              <Text style={styles.rowSub}>Remove all cases, clients, hearings</Text>
            </View>
            <Feather name="chevron-right" size={15} color="#FF3B30" />
          </TouchableOpacity>
        </View>

        {/* DATA BACKUP */}
        <Text style={styles.sectionLabel}>DATA BACKUP</Text>
        <View style={styles.section}>
          {/* Row 1 — Backup to Google Drive */}
          <TouchableOpacity
            testID="backup-google-drive-btn"
            style={[styles.row, !process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID && { opacity: 0.5 }]}
            onPress={process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ? handleBackup : undefined}
            activeOpacity={process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ? 0.7 : 1}
            disabled={backing}
          >
            <Feather name="upload-cloud" size={18} color={c.textSecondary} style={{ marginRight: Spacing.s }} />
            <View style={styles.rowInfo}>
              <Text style={[styles.rowLabel, !process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID && { color: c.textSecondary }]}>
                Backup to Google Drive
              </Text>
            </View>
            {!process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID
              ? <Text testID="backup-setup-required" style={{ ...Typography.caption1, color: c.textSecondary }}>Setup required</Text>
              : backing
                ? <ActivityIndicator size="small" color={c.textSecondary} />
                : lastBackupAt
                  ? <Text testID="last-backup-time" style={{ ...Typography.caption1, color: c.textSecondary }}>{formatBackupTime(lastBackupAt)}</Text>
                  : null
            }
          </TouchableOpacity>
          <View style={styles.divider} />
          {/* Row 2 — Restore from Google Drive */}
          <TouchableOpacity
            testID="restore-google-drive-btn"
            style={[styles.row, !process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID && { opacity: 0.5 }]}
            onPress={process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ? restoreFromGoogleDrive : undefined}
            activeOpacity={process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ? 0.7 : 1}
          >
            <Feather name="download-cloud" size={18} color={c.textSecondary} style={{ marginRight: Spacing.s }} />
            <View style={styles.rowInfo}>
              <Text style={[styles.rowLabel, !process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID && { color: c.textSecondary }]}>
                Restore from Google Drive
              </Text>
            </View>
            {!process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID
              ? <Text testID="restore-setup-required" style={{ ...Typography.caption1, color: c.textSecondary }}>Setup required</Text>
              : <Feather name="chevron-right" size={15} color={c.textTertiary} />
            }
          </TouchableOpacity>
        </View>

        {/* About */}
        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowLabel}>App Version</Text>
            </View>
            <Text style={styles.versionText}>LawFlow v1.0.0</Text>
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={() => Alert.alert('Thank you!', 'Rating available on App Store.')} activeOpacity={0.7}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowLabel}>Rate the App</Text>
            </View>
            <Feather name="chevron-right" size={15} color={c.textTertiary} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={() => Alert.alert('Share', 'Sharing coming soon.')} activeOpacity={0.7}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowLabel}>Share App</Text>
            </View>
            <Feather name="chevron-right" size={15} color={c.textTertiary} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={() => Alert.alert('Privacy Policy', 'Available at lawflow.in/privacy')} activeOpacity={0.7}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowLabel}>Privacy Policy</Text>
            </View>
            <Feather name="chevron-right" size={15} color={c.textTertiary} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
