/**
 * Phase 18 — Bulk WhatsApp Reminder Screen
 * Send WhatsApp reminders to all clients with hearings tomorrow, one by one.
 * "Sent today" status stored in AsyncStorage, keyed by case+hearing+date.
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../src/theme';
import { useApp } from '../src/context/AppContext';
import { buildHearingReminderMessage } from '../src/utils/whatsappTemplates';

const SENT_KEY_PREFIX = 'lawflow_bulk_sent';

function getTomorrowDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

interface BulkItem {
  id: string;         // `${caseId}_${hearingId}`
  hearing: any;
  caseData: any;
  client: any | null;
  checked: boolean;
  sentToday: boolean;
}

export default function BulkRemindersScreen() {
  const router = useRouter();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { hearings, cases, clients, advocateProfile, sendWhatsAppMessage } = useApp();
  const advocateName = advocateProfile?.name ?? 'Advocate';
  const dateStr = useMemo(getTomorrowDateStr, []);

  const [items, setItems] = useState<BulkItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Send-all queue flow
  const [sendQueue, setSendQueue] = useState<BulkItem[]>([]);
  const [pendingItem, setPendingItem] = useState<BulkItem | null>(null);

  // Preview sheet
  const [previewItem, setPreviewItem] = useState<BulkItem | null>(null);
  const [previewMessage, setPreviewMessage] = useState('');

  // ── Load tomorrow's hearings + check AsyncStorage sent status ────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tmStart = today.getTime() + 86_400_000;
      const tmEnd = tmStart + 86_400_000;

      const tmHearings = hearings
        .filter(h => h.hearingDate >= tmStart && h.hearingDate < tmEnd)
        .sort((a, b) => a.hearingDate - b.hearingDate);

      const newItems: BulkItem[] = [];
      for (const h of tmHearings) {
        const caseData = cases.find(x => x.id === h.caseId);
        if (!caseData) continue;
        const client = clients.find(cl => cl.id === caseData.clientId) ?? null;
        const key = `${SENT_KEY_PREFIX}_${dateStr}_${caseData.id}_${h.id}`;
        const stored = await AsyncStorage.getItem(key);
        newItems.push({
          id: `${caseData.id}_${h.id}`,
          hearing: h,
          caseData,
          client,
          checked: !!client?.phone,  // auto-check only if phone available
          sentToday: stored === '1',
        });
      }
      setItems(newItems);
      setLoading(false);
    };
    load();
  }, [hearings, cases, clients, dateStr]);

  // ── Mark item as sent in state + AsyncStorage ────────────────────────
  const markSent = useCallback(async (item: BulkItem) => {
    const key = `${SENT_KEY_PREFIX}_${dateStr}_${item.caseData.id}_${item.hearing.id}`;
    await AsyncStorage.setItem(key, '1');
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, sentToday: true } : i));
  }, [dateStr]);

  // ── Build WhatsApp message for an item ───────────────────────────────
  const buildMsg = useCallback((item: BulkItem) => {
    if (!item.client) return '';
    return buildHearingReminderMessage({
      clientName: item.client.name,
      caseNumber: item.caseData.caseNumber,
      courtName: item.caseData.courtName,
      isTomorrow: true,
      advocateName,
    });
  }, [advocateName]);

  // ── Preview row tap ──────────────────────────────────────────────────
  const handlePreview = (item: BulkItem) => {
    setPreviewItem(item);
    setPreviewMessage(buildMsg(item));
  };

  // ── Send from preview sheet ──────────────────────────────────────────
  const handleSendPreview = () => {
    if (!previewItem?.client?.phone) return;
    sendWhatsAppMessage(previewItem.client.phone, previewMessage);
    const sent = previewItem;
    setPreviewItem(null);
    setPendingItem(sent);
    setSendQueue([]);
  };

  // ── Send All flow ────────────────────────────────────────────────────
  const processNext = useCallback((queue: BulkItem[]) => {
    if (!queue.length) { setPendingItem(null); setSendQueue([]); return; }
    const [first, ...rest] = queue;
    sendWhatsAppMessage(first.client!.phone, buildMsg(first));
    setPendingItem(first);
    setSendQueue(rest);
  }, [buildMsg, sendWhatsAppMessage]);

  const handleSendAll = () => {
    const queue = items.filter(i => i.checked && !!i.client?.phone && !i.sentToday);
    if (!queue.length) return;
    processNext(queue);
  };

  const handleConfirm = async (wasSent: boolean) => {
    if (wasSent && pendingItem) await markSent(pendingItem);
    const remaining = sendQueue;
    setPendingItem(null);
    setSendQueue([]);
    if (remaining.length > 0) {
      setTimeout(() => processNext(remaining), 400);
    }
  };

  // ── Derived counts ───────────────────────────────────────────────────
  const totalSent = useMemo(() => items.filter(i => i.sentToday).length, [items]);
  const totalCheckedWithPhone = useMemo(() => items.filter(i => i.checked && !!i.client?.phone).length, [items]);
  const queueSize = useMemo(() => items.filter(i => i.checked && !!i.client?.phone && !i.sentToday).length, [items]);

  // ── Loading state ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} testID="back-btn" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="arrow-left" size={22} color={c.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>📤 Bulk Reminders</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={c.textPrimary} />
          <Text style={[styles.subText, { marginTop: Spacing.m }]}>Loading tomorrow's hearings…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="back-btn" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={22} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📤 Bulk Reminders</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* ── Sub-header: count + date ── */}
      <View style={styles.subHeader} testID="sub-header">
        <Text style={styles.subText}>
          {items.length > 0
            ? `${items.length} hearing${items.length !== 1 ? 's' : ''} tomorrow · ${totalSent} sent`
            : 'No hearings tomorrow'}
        </Text>
        <Text style={styles.dateText}>{dateStr}</Text>
      </View>

      {/* ── Empty state ── */}
      {items.length === 0 ? (
        <View style={styles.center} testID="empty-state">
          <Text style={styles.emptyEmoji}>🎉</Text>
          <Text style={styles.emptyTitle}>No hearings tomorrow!</Text>
          <Text style={styles.emptySub}>All caught up. Enjoy your free day.</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {items.map(item => (
            <TouchableOpacity
              key={item.id}
              testID={`bulk-row-${item.id}`}
              style={[styles.row, item.sentToday && styles.rowSent]}
              onPress={() => item.client?.phone ? handlePreview(item) : undefined}
              activeOpacity={item.client?.phone ? 0.7 : 1}
            >
              {/* Checkbox / no-phone icon */}
              {item.client?.phone ? (
                <TouchableOpacity
                  testID={`checkbox-${item.id}`}
                  style={[styles.checkbox, item.checked && styles.checkboxChecked]}
                  onPress={() => setItems(prev =>
                    prev.map(i => i.id === item.id ? { ...i, checked: !i.checked } : i)
                  )}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {item.checked && <Feather name="check" size={12} color="#fff" />}
                </TouchableOpacity>
              ) : (
                <View style={styles.warnIcon}>
                  <Feather name="alert-circle" size={16} color={c.textTertiary} />
                </View>
              )}

              {/* Info */}
              <View style={styles.rowInfo}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.client?.name ?? '(No client linked)'}
                </Text>
                <Text style={styles.rowCase}>{item.caseData.caseNumber}</Text>
                <Text style={styles.rowCourt} numberOfLines={1}>
                  {item.caseData.courtName} · {fmtTime(item.hearing.hearingDate)}
                </Text>
                {!item.client?.phone && (
                  <Text style={styles.noPhoneNote}>⚠️ No phone — will be skipped</Text>
                )}
              </View>

              {/* Status */}
              {item.sentToday ? (
                <View style={styles.sentBadge} testID={`sent-badge-${item.id}`}>
                  <Text style={styles.sentBadgeText}>✅ Sent</Text>
                </View>
              ) : item.client?.phone ? (
                <Feather name="chevron-right" size={16} color={c.textTertiary} />
              ) : null}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Footer ── */}
      {items.length > 0 && (
        <SafeAreaView edges={['bottom']} style={styles.footer}>
          {totalSent > 0 && (
            <Text style={styles.progressText} testID="progress-text">
              {totalSent} of {totalCheckedWithPhone} sent
            </Text>
          )}
          <TouchableOpacity
            testID="send-all-btn"
            style={[styles.sendAllBtn, queueSize === 0 && styles.sendAllBtnDone]}
            onPress={handleSendAll}
            disabled={queueSize === 0}
            activeOpacity={0.85}
          >
            <Text style={[styles.sendAllBtnText, queueSize === 0 && styles.sendAllBtnTextDone]}>
              {queueSize > 0 ? `📤  Send All (${queueSize})` : '✅  All Sent'}
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      )}

      {/* ── Preview / Edit Message Modal ── */}
      <Modal visible={!!previewItem} transparent animationType="slide" statusBarTranslucent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity
            style={styles.backdrop}
            onPress={() => setPreviewItem(null)}
            activeOpacity={1}
          >
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>
                Message for {previewItem?.client?.name}
              </Text>
              <Text style={styles.sheetLabel}>PREVIEW & EDIT</Text>
              <TextInput
                testID="preview-message-input"
                style={styles.sheetInput}
                value={previewMessage}
                onChangeText={setPreviewMessage}
                multiline
                textAlignVertical="top"
                placeholder="WhatsApp message…"
                placeholderTextColor={c.textTertiary}
              />
              <View style={styles.sheetActions}>
                <TouchableOpacity
                  testID="preview-send-btn"
                  style={styles.waSendBtn}
                  onPress={handleSendPreview}
                  activeOpacity={0.85}
                >
                  <Text style={styles.waSendIcon}>💬</Text>
                  <Text style={styles.waSendText}>Send via WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setPreviewItem(null)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── "Mark as Sent?" overlay — appears after WhatsApp is opened ── */}
      {pendingItem && (
        <View style={styles.confirmOverlay} testID="confirm-overlay">
          <View style={styles.confirmCard}>
            <Text style={styles.confirmEmoji}>📱</Text>
            <Text style={styles.confirmTitle}>
              Sent reminder to {pendingItem.client?.name}?
            </Text>
            <Text style={styles.confirmSub}>
              {sendQueue.length > 0
                ? `${sendQueue.length} more in queue`
                : 'Last reminder!'}
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                testID="confirm-sent-btn"
                style={styles.confirmYes}
                onPress={() => handleConfirm(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.confirmYesText}>✅  Mark as Sent</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="confirm-skip-btn"
                style={styles.confirmSkip}
                onPress={() => handleConfirm(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmSkipText}>Skip</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.l, paddingVertical: Spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.separator,
  },
  headerTitle: { ...Typography.headline, color: c.textPrimary },
  subHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.l, paddingVertical: Spacing.s,
    backgroundColor: c.surface,
  },
  subText: { ...Typography.subhead, color: c.textSecondary },
  dateText: { ...Typography.caption1, color: c.textTertiary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  emptyEmoji: { fontSize: 52, marginBottom: Spacing.m },
  emptyTitle: { ...Typography.title2, color: c.textPrimary, marginBottom: Spacing.xs, textAlign: 'center' },
  emptySub: { ...Typography.subhead, color: c.textSecondary, textAlign: 'center' },

  // List
  list: { paddingHorizontal: Spacing.l, paddingTop: Spacing.m, paddingBottom: 120 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.m,
    paddingVertical: Spacing.m, paddingHorizontal: Spacing.m,
    backgroundColor: c.card, borderRadius: Radius.m, marginBottom: Spacing.s,
  },
  rowSent: { opacity: 0.65 },
  checkbox: {
    width: 22, height: 22, borderRadius: 5,
    borderWidth: 2, borderColor: c.separator,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: '#25D366', borderColor: '#25D366' },
  warnIcon: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowInfo: { flex: 1 },
  rowName: { ...Typography.headline, color: c.textPrimary },
  rowCase: { ...Typography.caption1, color: c.textSecondary, marginTop: 2 },
  rowCourt: { ...Typography.caption1, color: c.textTertiary, marginTop: 1 },
  noPhoneNote: { ...Typography.caption2, color: c.textTertiary, fontStyle: 'italic', marginTop: 3 },
  sentBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: '#E8F5E9', borderRadius: Radius.s, flexShrink: 0,
  },
  sentBadgeText: { fontSize: 11, fontWeight: '600', color: '#2E7D32' },

  // Footer
  footer: {
    paddingHorizontal: Spacing.l, paddingTop: Spacing.m, paddingBottom: Spacing.m,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator, gap: Spacing.s,
    backgroundColor: c.background,
  },
  progressText: { ...Typography.subhead, color: c.textSecondary, textAlign: 'center' },
  sendAllBtn: {
    backgroundColor: '#25D366', borderRadius: Radius.m,
    height: 52, alignItems: 'center', justifyContent: 'center',
  },
  sendAllBtnDone: { backgroundColor: c.surface },
  sendAllBtnText: { ...Typography.headline, color: '#fff', fontSize: 16 },
  sendAllBtnTextDone: { color: c.textSecondary },

  // Preview modal
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.card,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.l, paddingBottom: Spacing.xxxl,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: c.separator,
    alignSelf: 'center', marginBottom: Spacing.m,
  },
  sheetTitle: { ...Typography.title3, color: c.textPrimary, marginBottom: Spacing.m },
  sheetLabel: { fontSize: 11, fontWeight: '600', color: c.textSecondary, letterSpacing: 0.8, marginBottom: Spacing.s },
  sheetInput: {
    backgroundColor: c.surface, borderRadius: Radius.m,
    padding: Spacing.m, minHeight: 130, maxHeight: 210,
    ...Typography.body, color: c.textPrimary,
  },
  sheetActions: { marginTop: Spacing.m, gap: Spacing.s },
  waSendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.s,
    backgroundColor: '#25D366', borderRadius: Radius.m, height: 52,
  },
  waSendIcon: { fontSize: 20 },
  waSendText: { ...Typography.headline, color: '#fff' },
  cancelBtn: { alignItems: 'center', height: 44, justifyContent: 'center' },
  cancelText: { ...Typography.subhead, color: c.textSecondary },

  // Confirmation overlay
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'flex-end',
  },
  confirmCard: {
    width: '100%', backgroundColor: c.card,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.xl, alignItems: 'center', paddingBottom: Spacing.xxxl,
  },
  confirmEmoji: { fontSize: 44, marginBottom: Spacing.m },
  confirmTitle: { ...Typography.title3, color: c.textPrimary, textAlign: 'center', marginBottom: Spacing.xs },
  confirmSub: { ...Typography.subhead, color: c.textSecondary, marginBottom: Spacing.l, textAlign: 'center' },
  confirmActions: { width: '100%', gap: Spacing.s },
  confirmYes: {
    backgroundColor: '#25D366', borderRadius: Radius.m,
    height: 52, alignItems: 'center', justifyContent: 'center',
  },
  confirmYesText: { ...Typography.headline, color: '#fff' },
  confirmSkip: {
    backgroundColor: c.surface, borderRadius: Radius.m,
    height: 44, alignItems: 'center', justifyContent: 'center',
  },
  confirmSkipText: { ...Typography.subhead, color: c.textSecondary },
});
