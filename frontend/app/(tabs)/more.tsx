import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../../src/theme';
import { useApp } from '../../src/context/AppContext';

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

interface RowProps {
  label: string;
  sub?: string;
  onPress: () => void;
  danger?: boolean;
  testID?: string;
  isLast?: boolean;
}

function MenuRow({ label, sub, onPress, danger, testID, isLast }: RowProps) {
  const c = useColors();
  const scale = React.useRef(new Animated.Value(1)).current;
  const animate = (toValue: number) =>
    Animated.timing(scale, { toValue, duration: 150, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        testID={testID}
        style={[
          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.m, paddingVertical: 14, minHeight: 48, gap: Spacing.m },
          !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
        ]}
        onPress={onPress}
        onPressIn={() => animate(0.98)}
        onPressOut={() => animate(1)}
        activeOpacity={1}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ ...Typography.subhead, fontWeight: '500', fontSize: 14, color: danger ? '#FF3B30' : c.textPrimary }}>{label}</Text>
          {sub ? <Text style={{ ...Typography.caption1, color: c.textSecondary, marginTop: 2 }}>{sub}</Text> : null}
        </View>
        <Feather
          name="chevron-right"
          size={15}
          color={danger ? '#FF3B30' : c.textTertiary}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: {
    paddingHorizontal: Spacing.m,
    paddingTop: Spacing.s,
    paddingBottom: Spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  title: { ...Typography.largeTitle, color: c.textPrimary },
  content: { paddingHorizontal: Spacing.m, paddingBottom: 32 },

  profileStrip: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.l, gap: Spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    marginBottom: Spacing.s,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: c.textPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: c.background, letterSpacing: 0.5 },
  profileInfo: { flex: 1 },
  profileName: { ...Typography.headline, color: c.textPrimary },
  profileSub: { ...Typography.footnote, color: c.textSecondary, marginTop: 2 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: c.textSecondary,
    letterSpacing: 0.8, marginBottom: Spacing.s, marginTop: Spacing.l,
    paddingTop: Spacing.xs,
  },
  section: {
    backgroundColor: c.surface,
    borderRadius: Radius.m,
    overflow: 'hidden',
  },
});

export default function MoreScreen() {
  const router = useRouter();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { advocateProfile, signOut } = useApp();
  const initials = getInitials(advocateProfile.name);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>More</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Profile mini-header */}
        <TouchableOpacity
          style={styles.profileStrip}
          onPress={() => router.push('/profile' as any)}
          activeOpacity={0.8}
          testID="profile-strip"
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{advocateProfile.name}</Text>
            <Text style={styles.profileSub}>
              {[advocateProfile.enrollmentNumber, advocateProfile.designation].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Feather name="chevron-right" size={16} color={c.textTertiary} />
        </TouchableOpacity>

        {/* ACCOUNT */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.section}>
          <MenuRow testID="menu-profile" label="My Profile" sub="Edit your advocate details" onPress={() => router.push('/profile' as any)} />
          <MenuRow testID="menu-settings" label="Settings" sub="Appearance, notifications & data" onPress={() => router.push('/settings' as any)} isLast />
        </View>

        {/* FIRM & PORTAL */}
        <Text style={styles.sectionLabel}>FIRM & SHARING</Text>
        <View style={styles.section}>
          <MenuRow testID="menu-firm" label="Law Firm" sub="Manage your firm & team" onPress={() => router.push('/firm' as any)} />
          <MenuRow testID="menu-portal" label="Client Portal" sub="Manage shared links for clients" onPress={() => router.push('/client-portal' as any)} isLast />
        </View>

        {/* TOOLS */}
        <Text style={styles.sectionLabel}>TOOLS</Text>
        <View style={styles.section}>
          <MenuRow testID="menu-bulk-reminders" label="📤 Bulk Reminders" sub="Send WhatsApp to all clients with hearings tomorrow" onPress={() => router.push('/bulk-reminders' as any)} />
          <MenuRow testID="menu-analytics" label="Analytics" sub="Practice stats and trends" onPress={() => router.push('/analytics' as any)} />
          <MenuRow testID="menu-templates" label="Message Templates" sub="Used in WhatsApp & SMS" onPress={() => router.push('/communication' as any)} />
          <MenuRow testID="menu-search" label="Global Search" sub="Find cases, clients & hearings" onPress={() => router.push('/search' as any)} />
          <MenuRow testID="menu-notifications" label="Notifications" sub="Reminders & alerts" onPress={() => router.push('/notifications' as any)} isLast />
        </View>

        {/* SUPPORT */}
        <Text style={styles.sectionLabel}>SUPPORT</Text>
        <View style={styles.section}>
          <MenuRow testID="menu-help" label="Help & FAQ" sub="Guides and common questions" onPress={() => Alert.alert('Help & FAQ', 'Full help centre coming soon.\n\nFor support: support@lawflow.in')} />
          <MenuRow testID="menu-feedback" label="Share Feedback" sub="Tell us how to improve" onPress={() => Alert.alert('Feedback', 'Thank you! Feedback form coming soon.')} isLast />
        </View>

        {/* SIGN OUT */}
        <Text style={styles.sectionLabel}>SIGN OUT</Text>
        <View style={styles.section}>
          <MenuRow testID="logout-btn" label="Sign Out" onPress={handleLogout} danger isLast />
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
