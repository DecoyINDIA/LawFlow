import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, TextInput,
  Platform, KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../../theme';
import { Client, Case } from '../../types';

interface NotifyClientPopupProps {
  visible: boolean;
  onClose: () => void;
  client: Client | null;
  caseData: Case;
  advocateName: string;
  message: string;
  title?: string;
  onSendWhatsApp: (phone: string, message: string) => void;
  onSendSMS: (phone: string, message: string) => void;
}

export function NotifyClientPopup({
  visible, onClose, client, caseData, advocateName, message: initialMessage,
  title = 'Notify Client?', onSendWhatsApp, onSendSMS
}: NotifyClientPopupProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [message, setMessage] = useState(initialMessage);

  React.useEffect(() => {
    setMessage(initialMessage);
  }, [initialMessage, visible]);

  if (!client) return null;

  const handleWhatsApp = () => {
    if (!client.whatsappOptIn) {
      // Still allow but could show warning
    }
    onSendWhatsApp(client.phone, message);
    onClose();
  };

  const handleSMS = () => {
    if (!client.smsOptIn) {
      // Still allow but could show warning
    }
    onSendSMS(client.phone, message);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity
          style={styles.backdrop}
          onPress={onClose}
          activeOpacity={1}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>
              Send this update to <Text style={styles.clientName}>{client.name}</Text>?
            </Text>

            {/* Message preview/edit */}
            <View style={styles.messageBox}>
              <Text style={styles.messageLabel}>MESSAGE</Text>
              <TextInput
                style={styles.messageInput}
                value={message}
                onChangeText={setMessage}
                multiline
                textAlignVertical="top"
                placeholder="Enter message..."
                placeholderTextColor={c.textTertiary}
              />
            </View>

            {/* Consent indicators */}
            <View style={styles.consentRow}>
              <View style={styles.consentItem}>
                <Feather
                  name="message-circle"
                  size={14}
                  color={client.whatsappOptIn ? c.textPrimary : c.textTertiary}
                />
                <Text style={[styles.consentText, !client.whatsappOptIn && styles.consentOff]}>
                  WhatsApp {client.whatsappOptIn ? 'enabled' : 'disabled'}
                </Text>
              </View>
              <View style={styles.consentItem}>
                <Feather
                  name="smartphone"
                  size={14}
                  color={client.smsOptIn ? c.textPrimary : c.textTertiary}
                />
                <Text style={[styles.consentText, !client.smsOptIn && styles.consentOff]}>
                  SMS {client.smsOptIn ? 'enabled' : 'disabled'}
                </Text>
              </View>
            </View>

            {/* Action buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.whatsappBtn}
                onPress={handleWhatsApp}
                activeOpacity={0.8}
              >
                <Feather name="message-circle" size={18} color={c.background} />
                <Text style={styles.whatsappText}>Send via WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.smsBtn}
                onPress={handleSMS}
                activeOpacity={0.8}
              >
                <Feather name="smartphone" size={18} color={c.textPrimary} />
                <Text style={styles.smsText}>Send via SMS</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.skipBtn}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Helper to generate update messages
export function generateCaseUpdateMessage(
  caseData: Case,
  clientName: string,
  advocateName: string,
  changeType: 'update' | 'hearing_added' | 'outcome_recorded'
): string {
  const fmtDate = (ts?: number) => {
    if (!ts) return 'TBD';
    const d = new Date(ts);
    return `${d.getDate().toString().padStart(2, '0')} ${d.toLocaleString('en-US', { month: 'short' })} ${d.getFullYear()}`;
  };

  switch (changeType) {
    case 'hearing_added':
      return `Dear ${clientName},\n\nYour next hearing for case ${caseData.caseNumber} is scheduled on ${fmtDate(caseData.nextHearingDate)} at ${caseData.courtName}.\n\n— ${advocateName}`;
    case 'outcome_recorded':
      return `Dear ${clientName},\n\nAn update has been recorded for your case ${caseData.caseNumber}. Status: ${caseData.status}.\n${caseData.nextHearingDate ? `Next hearing: ${fmtDate(caseData.nextHearingDate)}` : 'Next date to be announced.'}\n\n— ${advocateName}`;
    default:
      return `Dear ${clientName},\n\nYour case ${caseData.caseNumber} has been updated.\n${caseData.nextHearingDate ? `Next hearing: ${fmtDate(caseData.nextHearingDate)} at ${caseData.courtName}.` : ''}\n\n— ${advocateName}`;
  }
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.l, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  handle: { width: 36, height: 4, backgroundColor: c.surfaceHighlight, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.l },

  title: { ...Typography.title3, color: c.textPrimary, marginBottom: 4 },
  subtitle: { ...Typography.subhead, color: c.textSecondary, marginBottom: Spacing.l },
  clientName: { fontWeight: '600', color: c.textPrimary },

  messageBox: { marginBottom: Spacing.m },
  messageLabel: { fontSize: 11, fontWeight: '600', color: c.textSecondary, letterSpacing: 0.8, marginBottom: Spacing.s },
  messageInput: {
    backgroundColor: c.surface, borderRadius: Radius.m,
    padding: Spacing.m, minHeight: 120, maxHeight: 180,
    ...Typography.body, color: c.textPrimary,
  },

  consentRow: { flexDirection: 'row', gap: Spacing.l, marginBottom: Spacing.l },
  consentItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  consentText: { ...Typography.caption1, color: c.textPrimary },
  consentOff: { color: c.textTertiary },

  actions: { gap: Spacing.s },
  whatsappBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.s,
    backgroundColor: c.textPrimary, borderRadius: Radius.m, height: 50,
  },
  whatsappText: { ...Typography.headline, color: c.background },
  smsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.s,
    backgroundColor: c.surface, borderRadius: Radius.m, height: 50,
  },
  smsText: { ...Typography.headline, color: c.textPrimary },
  skipBtn: {
    alignItems: 'center', justifyContent: 'center', height: 44,
  },
  skipText: { ...Typography.subhead, color: c.textSecondary },
});
