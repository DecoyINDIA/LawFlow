import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../src/theme';
import { useApp } from '../src/context/AppContext';
import {
  createFirm, inviteToFirm, acceptFirmInvite, removeFirmMember,
} from '../src/services/api';

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.m, paddingVertical: Spacing.s,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.headline, color: c.textPrimary },
  content: { padding: Spacing.m, paddingBottom: 48 },
  section: {
    backgroundColor: c.surface, borderRadius: Radius.m,
    padding: Spacing.m, marginBottom: Spacing.m,
  },
  sectionTitle: { ...Typography.headline, color: c.textPrimary, marginBottom: Spacing.s },
  label: { ...Typography.footnote, color: c.textSecondary, marginBottom: 4, marginTop: Spacing.s },
  input: {
    backgroundColor: c.background, borderRadius: Radius.s,
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
    paddingHorizontal: Spacing.s, paddingVertical: 10,
    ...Typography.body, color: c.textPrimary,
  },
  btn: {
    backgroundColor: c.textPrimary, borderRadius: Radius.s,
    paddingVertical: 12, alignItems: 'center', marginTop: Spacing.m,
  },
  btnText: { ...Typography.headline, color: c.background },
  btnOutline: {
    borderWidth: 1, borderColor: c.textPrimary, borderRadius: Radius.s,
    paddingVertical: 12, alignItems: 'center', marginTop: Spacing.s,
  },
  btnOutlineText: { ...Typography.headline, color: c.textPrimary },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.s,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  memberInfo: { flex: 1 },
  memberPhone: { ...Typography.body, color: c.textPrimary },
  memberRole: { ...Typography.caption1, color: c.textSecondary, marginTop: 2 },
  inviteRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  invitePhone: { ...Typography.subhead, color: c.textSecondary },
  inviteStatus: { ...Typography.caption1, color: '#FF9500' },
  emptyText: { ...Typography.subhead, color: c.textTertiary, textAlign: 'center', paddingVertical: Spacing.l },
  firmName: { ...Typography.title2, color: c.textPrimary, marginBottom: 4 },
  firmSub: { ...Typography.footnote, color: c.textSecondary },
  dangerBtn: {
    borderWidth: 1, borderColor: '#FF3B30', borderRadius: Radius.s,
    paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center',
  },
  dangerBtnText: { ...Typography.caption1, fontWeight: '600' as const, color: '#FF3B30' },
});

export default function FirmScreen() {
  const router = useRouter();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { authToken, loadFirm, firm, isFirmOwner: isOwnerCtx } = useApp();

  const [loading, setLoading] = useState(true);
  const [firmName, setFirmName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadFirm().finally(() => setLoading(false));
  }, [loadFirm]);

  const handleCreateFirm = useCallback(async () => {
    if (!firmName.trim()) {
      Alert.alert('Error', 'Please enter a firm name');
      return;
    }
    setSubmitting(true);
    try {
      await createFirm(firmName.trim(), authToken ?? undefined);
      await loadFirm();
      setFirmName('');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create firm');
    } finally {
      setSubmitting(false);
    }
  }, [firmName, authToken, loadFirm]);

  const handleInvite = useCallback(async () => {
    const phone = invitePhone.trim();
    if (!phone || phone.length < 10) {
      Alert.alert('Error', 'Enter a valid phone number');
      return;
    }
    setSubmitting(true);
    try {
      await inviteToFirm(phone, authToken ?? undefined);
      await loadFirm();
      setInvitePhone('');
      Alert.alert('Invited', `Invitation sent to ${phone}`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to invite');
    } finally {
      setSubmitting(false);
    }
  }, [invitePhone, authToken, loadFirm]);

  const handleRemoveMember = useCallback(async (memberId: string, phone: string) => {
    Alert.alert('Remove Member', `Remove ${phone} from the firm?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await removeFirmMember(memberId, authToken ?? undefined);
            await loadFirm();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to remove');
          }
        },
      },
    ]);
  }, [authToken, loadFirm]);

  const handleAcceptInvite = useCallback(async (firmId: string) => {
    setSubmitting(true);
    try {
      await acceptFirmInvite(firmId, authToken ?? undefined);
      await loadFirm();
      Alert.alert('Joined', 'You have joined the firm');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to accept');
    } finally {
      setSubmitting(false);
    }
  }, [authToken, loadFirm]);

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Feather name="arrow-left" size={22} color={c.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Law Firm</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={c.textPrimary} />
        </View>
      </SafeAreaView>
    );
  }

  const isOwner = isOwnerCtx;
  const members: any[] = firm ? ((firm as any).members || []) : [];
  const invitations: any[] = firm ? ((firm as any).invitations || []) : [];
  const pendingInvitations = invitations.filter((i: any) => i.status === 'pending');

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="firm-back">
          <Feather name="arrow-left" size={22} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Law Firm</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {!firm ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Create Your Law Firm</Text>
            <Text style={{ ...Typography.subhead, color: c.textSecondary, marginBottom: Spacing.s }}>
              Set up a firm to invite junior advocates and manage cases across your team.
            </Text>
            <Text style={s.label}>Firm Name</Text>
            <TextInput
              testID="firm-name-input"
              style={s.input}
              value={firmName}
              onChangeText={setFirmName}
              placeholder="e.g. Sharma & Associates"
              placeholderTextColor={c.textTertiary}
            />
            <TouchableOpacity
              testID="create-firm-btn"
              style={s.btn}
              onPress={handleCreateFirm}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={c.background} />
              ) : (
                <Text style={s.btnText}>Create Firm</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={s.section}>
              <Text style={s.firmName}>{(firm as any).name}</Text>
              <Text style={s.firmSub}>
                {members.length} member{members.length !== 1 ? 's' : ''}
              </Text>
              {isOwner && (
                <TouchableOpacity
                  testID="firm-dashboard-btn"
                  style={s.btnOutline}
                  onPress={() => router.push('/firm-dashboard' as any)}
                >
                  <Text style={s.btnOutlineText}>Firm Dashboard</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={s.section}>
              <Text style={s.sectionTitle}>Members</Text>
              {members.map((m: any, i: number) => (
                <View key={m.advocateId || i} style={s.memberRow}>
                  <View style={s.memberInfo}>
                    <Text style={s.memberPhone}>{m.phone}</Text>
                    <Text style={s.memberRole}>
                      {m.role === 'owner' ? 'Owner' : 'Junior Advocate'}
                      {m.joinedAt ? ` · Joined ${new Date(m.joinedAt).toLocaleDateString()}` : ''}
                    </Text>
                  </View>
                  {isOwner && m.role !== 'owner' && (
                    <TouchableOpacity
                      style={s.dangerBtn}
                      onPress={() => handleRemoveMember(m.advocateId, m.phone)}
                    >
                      <Text style={s.dangerBtnText}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>

            {isOwner && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Invite Junior Advocate</Text>
                <Text style={s.label}>Phone Number</Text>
                <TextInput
                  testID="invite-phone-input"
                  style={s.input}
                  value={invitePhone}
                  onChangeText={setInvitePhone}
                  placeholder="e.g. 9876543210"
                  placeholderTextColor={c.textTertiary}
                  keyboardType="phone-pad"
                />
                <TouchableOpacity
                  testID="invite-btn"
                  style={s.btn}
                  onPress={handleInvite}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color={c.background} />
                  ) : (
                    <Text style={s.btnText}>Send Invitation</Text>
                  )}
                </TouchableOpacity>

                {pendingInvitations.length > 0 && (
                  <>
                    <Text style={[s.label, { marginTop: Spacing.m }]}>Pending Invitations</Text>
                    {pendingInvitations.map((inv: any, i: number) => (
                      <View key={i} style={s.inviteRow}>
                        <Text style={s.invitePhone}>{inv.phone}</Text>
                        <Text style={s.inviteStatus}>Pending</Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
