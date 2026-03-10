/**
 * Phase 23 — Drive Setup Bottom Sheet
 * Shown when user tries to upload a document or record a voice note
 * without Google Drive connected.
 */
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, TouchableWithoutFeedback, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../../theme';

interface Props {
  visible: boolean;
  connecting?: boolean;
  onConnect: () => void;
  onDismiss: () => void;
}

export function DriveSetupSheet({ visible, connecting = false, onConnect, onDismiss }: Props) {
  const c = useColors();
  const styles = makeStyles(c);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Icon */}
        <View style={styles.iconWrap}>
          <Feather name="hard-drive" size={32} color="#4285F4" />
        </View>

        {/* Title */}
        <Text style={styles.title}>Google Drive Required</Text>

        {/* Body */}
        <Text style={styles.body}>
          Documents and voice notes are stored in your Google Drive to keep your data safe and save device space. Please connect your Google Drive to continue.
        </Text>

        {/* Benefits */}
        <View style={styles.benefitsList}>
          <BenefitRow icon="shield" text="Your files stay private in your own Drive" c={c} />
          <BenefitRow icon="smartphone" text="Access from any device, anytime" c={c} />
          <BenefitRow icon="folder" text="Auto-organised by case in LawFlow/" c={c} />
        </View>

        {/* Connect button */}
        <TouchableOpacity
          testID="drive-connect-btn"
          style={styles.connectBtn}
          onPress={onConnect}
          activeOpacity={0.8}
          disabled={connecting}
        >
          {connecting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="link" size={16} color="#fff" />
              <Text style={styles.connectBtnText}>Connect Google Drive</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Later button */}
        <TouchableOpacity
          testID="drive-later-btn"
          style={styles.laterBtn}
          onPress={onDismiss}
          activeOpacity={0.7}
          disabled={connecting}
        >
          <Text style={styles.laterBtnText}>Maybe Later</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function BenefitRow({ icon, text, c }: { icon: string; text: string; c: ColorPalette }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <Feather name={icon as any} size={14} color="#4285F4" />
      <Text style={{ ...Typography.subhead, color: c.textSecondary, flex: 1 }}>{text}</Text>
    </View>
  );
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: c.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.l,
    paddingBottom: 36,
    paddingTop: Spacing.m,
    alignItems: 'center',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: c.border, marginBottom: Spacing.l,
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#EBF1FD',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.m,
  },
  title: {
    ...Typography.title3,
    fontWeight: '700',
    color: c.textPrimary,
    marginBottom: Spacing.s,
    textAlign: 'center',
  },
  body: {
    ...Typography.subhead,
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.m,
  },
  benefitsList: {
    alignSelf: 'stretch',
    backgroundColor: c.surface,
    borderRadius: Radius.m,
    padding: Spacing.m,
    marginBottom: Spacing.l,
  },
  connectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#4285F4',
    borderRadius: Radius.m,
    paddingVertical: 14, paddingHorizontal: Spacing.l,
    alignSelf: 'stretch',
    justifyContent: 'center',
    marginBottom: Spacing.s,
  },
  connectBtnText: {
    ...Typography.subhead,
    fontWeight: '700',
    color: '#fff',
  },
  laterBtn: {
    paddingVertical: 12, alignSelf: 'stretch', alignItems: 'center',
  },
  laterBtnText: {
    ...Typography.subhead,
    color: c.textSecondary,
  },
});
