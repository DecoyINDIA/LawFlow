import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Modal, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../src/theme';
import { useApp } from '../src/context/AppContext';
import { CFPicker } from '../src/components/common/CFPicker';

const TEMPLATES = [
  {
    id: 'HEARING_REMINDER_1DAY',
    title: '1 Day Before Hearing',
    channel: 'WhatsApp & SMS',
    message: 'Dear {client_name}, your case {case_number} is scheduled for hearing tomorrow, {date} at {time} in {court_name}. Please be present. – {advocate_name}',
  },
  {
    id: 'HEARING_REMINDER_SAMEDAY',
    title: 'Same Day Reminder',
    channel: 'WhatsApp',
    message: 'Dear {client_name}, your hearing for {case_number} is today at {time} in {court_name}. – {advocate_name}',
  },
  {
    id: 'POST_HEARING_UPDATE',
    title: 'Post Hearing Update',
    channel: 'WhatsApp & SMS',
    message: 'Dear {client_name}, today\'s hearing for {case_number} has been {outcome}. Next date: {next_date}. – {advocate_name}',
  },
  {
    id: 'ADJOURNMENT_NOTICE',
    title: 'Adjournment Notice',
    channel: 'SMS',
    message: 'Case {case_number} adjourned to {next_date}. Please contact our office for details. – {advocate_name}',
  },
  {
    id: 'CASE_DISPOSED',
    title: 'Case Disposed',
    channel: 'WhatsApp',
    message: 'Dear {client_name}, we are pleased to inform that your case {case_number} has been disposed in your favour. – {advocate_name}',
  },
];

export default function CommunicationScreen() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const { clients, cases } = useApp();
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<typeof TEMPLATES[0] | null>(null);
  const [selectedClient, setSelectedClient] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!selectedClient) return Alert.alert('Select Client', 'Please select a client to send the message.');
    setSending(true);
    await new Promise(r => setTimeout(r, 1000));
    setSending(false);
    setShowSendModal(false);
    setSelectedClient('');
    Alert.alert('✓ Message Sent', `Mock message sent to ${clients.find(c => c.id === selectedClient)?.name}`);
  };

  const clientOpts = clients.map(c => ({ value: c.id, label: `${c.name} · ${c.phone}` }));

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Feather name="arrow-left" size={22} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Communication</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <Text style={s.sectionLabel}>MESSAGE TEMPLATES</Text>
        <Text style={s.sectionSub}>Tap a template to send a mock message to a client</Text>

        {TEMPLATES.map(t => (
          <View key={t.id} style={s.templateCard} testID={`template-${t.id}`}>
            <View style={s.templateHeader}>
              <Text style={s.templateTitle}>{t.title}</Text>
              <View style={s.channelBadge}>
                <Feather name={t.channel.includes('WhatsApp') ? 'message-circle' : 'message-square'} size={11} color={c.textSecondary} />
                <Text style={s.channelText}>{t.channel}</Text>
              </View>
            </View>
            <Text style={s.templateMsg} numberOfLines={3}>{t.message}</Text>
            <TouchableOpacity
              testID={`send-${t.id}`}
              style={s.sendBtn}
              onPress={() => { setSelectedTemplate(t); setShowSendModal(true); }}
              activeOpacity={0.8}
            >
              <Feather name="send" size={13} color={c.background} />
              <Text style={s.sendBtnText}>Send</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* Send Modal */}
      <Modal visible={showSendModal} transparent animationType="slide" statusBarTranslucent>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setShowSendModal(false)}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>{selectedTemplate?.title}</Text>
            <Text style={s.sheetMsg} numberOfLines={4}>{selectedTemplate?.message}</Text>
            <CFPicker
              label="Send To"
              value={selectedClient}
              options={clientOpts}
              onSelect={setSelectedClient}
              placeholder="Select a client…"
            />
            <TouchableOpacity
              testID="confirm-send-btn"
              style={[s.confirmBtn, sending && { opacity: 0.6 }]}
              onPress={handleSend}
              disabled={sending}
              activeOpacity={0.8}
            >
              <Text style={s.confirmBtnText}>{sending ? 'Sending…' : 'Send Message (Mock)'}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.m, paddingTop: Spacing.s, paddingBottom: Spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, ...Typography.headline, color: c.textPrimary, textAlign: 'center' },
  content: { padding: Spacing.m, paddingBottom: 32 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: c.textSecondary, letterSpacing: 0.8, marginBottom: 4 },
  sectionSub: { ...Typography.footnote, color: c.textTertiary, marginBottom: Spacing.l },
  templateCard: {
    backgroundColor: c.surface, borderRadius: Radius.m,
    padding: Spacing.m, marginBottom: Spacing.m,
  },
  templateHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.s },
  templateTitle: { ...Typography.subhead, fontWeight: '600', color: c.textPrimary },
  channelBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.surfaceHighlight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  channelText: { ...Typography.caption2, color: c.textSecondary, fontWeight: '600' },
  templateMsg: { ...Typography.footnote, color: c.textSecondary, lineHeight: 18, marginBottom: Spacing.m },
  sendBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.textPrimary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, alignSelf: 'flex-start' },
  sendBtnText: { ...Typography.caption1, color: c.background, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: c.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.l, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  handle: { width: 36, height: 4, backgroundColor: c.surfaceHighlight, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.l },
  sheetTitle: { ...Typography.title3, color: c.textPrimary, marginBottom: Spacing.s },
  sheetMsg: { ...Typography.footnote, color: c.textSecondary, lineHeight: 18, marginBottom: Spacing.l, backgroundColor: c.surface, padding: Spacing.m, borderRadius: Radius.m },
  confirmBtn: { backgroundColor: c.textPrimary, borderRadius: Radius.m, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.s },
  confirmBtnText: { ...Typography.headline, color: c.background },
});
