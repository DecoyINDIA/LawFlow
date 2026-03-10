import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, Animated,
  StyleSheet, Dimensions, PanResponder,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors, Typography, Spacing, Radius } from '../theme';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_H = 480;

interface PaywallSheetProps {
  visible: boolean;
  onClose: () => void;
  featureName: string;
  onUpgrade?: () => void;
}

export function PaywallSheet({ visible, onClose, featureName, onUpgrade }: PaywallSheetProps) {
  const c = useColors();
  const router = useRouter();
  const translateY = useRef(new Animated.Value(SHEET_H)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SHEET_H,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 5,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80) {
          onClose();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  const handleUpgrade = () => {
    onClose();
    if (onUpgrade) {
      onUpgrade();
    } else {
      router.push('/upgrade' as any);
    }
  };

  const handleBtnPressIn = () => {
    Animated.timing(scaleAnim, { toValue: 0.97, duration: 150, useNativeDriver: true }).start();
  };
  const handleBtnPressOut = () => {
    Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  };

  const styles = makeStyles(c);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        {/* Drag handle */}
        <View style={styles.handle} />

        {/* Lock icon */}
        <View style={styles.iconWrap}>
          <Feather name="lock" size={32} color={c.textPrimary} />
        </View>

        {/* Title */}
        <Text style={styles.title}>{featureName} is a Pro feature</Text>
        <Text style={styles.subtitle}>Upgrade to Pro to unlock all features</Text>

        {/* Feature bullets */}
        <View style={styles.bullets}>
          {['Unlimited cases & clients', 'eCourts sync', 'PDF reports', 'Google Drive'].map(f => (
            <View key={f} style={styles.bulletRow}>
              <Feather name="check" size={14} color="#34C759" />
              <Text style={styles.bulletText}>{f}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity
            testID="paywall-upgrade-btn"
            style={styles.upgradeBtn}
            onPress={handleUpgrade}
            onPressIn={handleBtnPressIn}
            onPressOut={handleBtnPressOut}
            activeOpacity={1}
          >
            <Text style={styles.upgradeBtnText}>Upgrade to Pro — ₹99/month</Text>
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity testID="paywall-later-btn" onPress={onClose} style={styles.laterBtn}>
          <Text style={styles.laterText}>Maybe Later</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: SHEET_H,
      backgroundColor: c.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: Spacing.m,
      paddingBottom: Spacing.xxxl,
      alignItems: 'center',
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      marginTop: 10,
      marginBottom: 24,
    },
    iconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    title: {
      ...Typography.title3,
      color: c.textPrimary,
      textAlign: 'center',
      marginBottom: 6,
    },
    subtitle: {
      ...Typography.subhead,
      color: c.textSecondary,
      textAlign: 'center',
      marginBottom: 20,
    },
    bullets: {
      width: '100%',
      marginBottom: 24,
      gap: 8,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    bulletText: {
      ...Typography.subhead,
      color: c.textPrimary,
    },
    upgradeBtn: {
      backgroundColor: c.textPrimary,
      borderRadius: Radius.m,
      paddingVertical: 16,
      paddingHorizontal: 32,
      alignItems: 'center',
      minWidth: 280,
    },
    upgradeBtnText: {
      ...Typography.headline,
      color: c.background,
    },
    laterBtn: {
      marginTop: 16,
      paddingVertical: 8,
    },
    laterText: {
      ...Typography.subhead,
      color: c.textSecondary,
    },
  });
}
