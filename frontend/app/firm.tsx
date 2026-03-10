import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform, Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../src/theme';
import { useApp } from '../src/context/AppContext';
import {
  createFirm, inviteToFirm, acceptFirmInvite, removeFirmMember, getPendingFirmInvite, checkFirmUser,
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
  errorText: { ...Typography.caption1, color: '#FF3B30', marginTop: 4 },
  successText: { ...Typography.caption1, color: '#34C759', marginTop: 4 },
  notRegCard: {
    backgroundColor: '#FFF9EC', borderRadius: Radius.s,
    borderWidth: 1, borderColor: '#FF9500',
    padding: Spacing.m, marginTop: Spacing.m,
  },
  notRegTitle: { ...Typography.headline, color: '#B05000', marginBottom: 4 },
  notRegSub: { ...Typography.footnote, color: '#7A4A00', marginBottom: Spacing.s },
  referralBox: {
    backgroundColor: '#FFF3DC', borderRadius: Radius.s,
    paddingVertical: Spacing.s, paddingHorizontal: Spacing.m,
    alignItems: 'center', marginVertical: Spacing.s,
  },
  referralCode: { ...Typography.title2, color: '#B05000', letterSpacing: 2 },
  waBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#25D366', borderRadius: Radius.s,
    paddingVertical: 10, paddingHorizontal: Spacing.m, marginTop: Spacing.s,
  },
  waBtnText: { ...Typography.headline, color: '#FFFFFF', marginLeft: 6 },
  btnDisabled: { opacity: 0.4 },
});

export default function FirmScreen() {
  const router = useRouter();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { authToken, loadFirm, firm, isFirmOwner: isOwnerCtx, referralCode, advocateName, sendWhatsAppMessage } = useApp();

  const [loading, setLoading] = useState(true);
  const [firmName, setFirmName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<any>(null);
  const [invitePhoneError, setInvitePhoneError] = useState<string | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [notRegisteredPhone, setNotRegisteredPhone] = useState<string | null>(null);
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState<string | null>(null);
  const [createFirmError, setCreateFirmError] = useState<string | null>(null);

  // Normalize: strip +91 prefix, keep only digits
  const normalizePhone = (raw: string): string => {
    let p = raw.replace(/\D/g, '');
    if (p.startsWith('91') && p.length === 12) p = p.slice(2);
    return p;
  };
  const isValidPhone = (p: string) => p.length === 10;

  const handlePhoneChange = (raw: string) => {
    const p = normalizePhone(raw);
    setInvitePhone(p);
    setNotRegisteredPhone(null);
    setInviteSuccessMsg(null);
    if (invitePhoneError) setInvitePhoneError(null);
  };

  useEffect(() => {
    loadFirm().finally(() => setLoading(false));
  }, [loadFirm]);

  // When user has no firm, check if they have a pending invitation
  useEffect(() => {
    if (!loading && !firm && authToken) {
      getPendingFirmInvite(authToken).then(resp => {
        if (resp.success && resp.data) setPendingInvite(resp.data);
      }).catch(() => {/* silent */});
    }
  }, [loading, firm, authToken]);

  const handleCreateFirm = useCallback(async () => {
    setCreateFirmError(null);
    if (!firmName.trim()) {
      setCreateFirmError('Please enter a firm name');
      return;
    }
    // Explicitly check token before calling the API
    const token = authToken || await AsyncStorage.getItem('lawflow_auth_token');
    if (!token) {
      setCreateFirmError('Session expired. Please re-login.');
      return;
    }
    setSubmitting(true);
    try {
      await createFirm(firmName.trim(), token);
      await loadFirm();
      setFirmName('');
    } catch (err: any) {
      setCreateFirmError(err.message || 'Failed to create firm');
    } finally {
      setSubmitting(false);
    }
  }, [firmName, authToken, loadFirm]);

  const handleInvite = useCallback(async () => {
    const phone = invitePhone.trim();
    setNotRegisteredPhone(null);
    setInviteSuccessMsg(null);
    setInvitePhoneError(null);

    if (!isValidPhone(phone)) {
      setInvitePhoneError('Please enter a valid 10-digit mobile number');
      return;
    }

    setCheckLoading(true);
    try {
      const checkResp = await checkFirmUser(phone, authToken ?? undefined);
      if (!checkResp.success) {
        setInvitePhoneError('Failed to verify. Please try again.');
        return;
      }
      const { exists, alreadyInFirm, advocateName: inviteeName } = checkResp.data;

      if (!exists) {
        // Case A — not a LawFlow user: show referral share
        setNotRegisteredPhone(phone);
        return;
      }

      if (alreadyInFirm) {
        // Case B — already in another firm
        setInvitePhoneError('This advocate is already part of another firm.');
        return;
      }

      // Case C — registered and available: send invitation
      setSubmitting(true);
      await inviteToFirm(phone, authToken ?? undefined);
      await loadFirm();

      const firmNameStr = (firm as any)?.name ?? 'the firm';
      const senderName = advocateName || 'A senior advocate';
      const waMsg = `Hi ${inviteeName || 'there'}! ${senderName} has invited you to join ${firmNameStr} on LawFlow. Open LawFlow to accept the invitation.`;

      if (Platform.OS !== 'web') {
        sendWhatsAppMessage(phone, waMsg);
      } else {
        setInviteSuccessMsg('Invitation sent! They will be notified in-app.');
      }
      setInvitePhone('');
    } catch (err: any) {
      setInvitePhoneError(err.message || 'Failed to invite');
    } finally {
      setCheckLoading(false);
      setSubmitting(false);
    }
  }, [invitePhone, authToken, loadFirm, advocateName, sendWhatsAppMessage, firm]);

  const handleRemoveMember = useCallback(async (memberId: string, phone: string) => {
    if (Platform.OS === 'web') {
      // Alert.alert multi-button blocked in browser — remove directly on web
      try {
        await removeFirmMember(memberId, authToken ?? undefined);
        await loadFirm();
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to remove');
      }
      return;
    }
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
          <>
            {/* Pending invitation from another firm */}
            {pendingInvite && (
              <View style={s.section} testID="pending-invite-section">
                <Feather name="mail" size={24} color={c.textPrimary} />
                <Text style={[s.sectionTitle, { marginTop: Spacing.s }]}>
                  Invitation from {(pendingInvite as any).name}
                </Text>
                <Text style={{ ...Typography.subhead, color: c.textSecondary, marginBottom: Spacing.m }}>
                  You've been invited to join this law firm.
                </Text>
                <TouchableOpacity
                  testID="accept-invite-btn"
                  style={s.btn}
                  onPress={() => handleAcceptInvite((pendingInvite as any).id)}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color={c.background} />
                  ) : (
                    <Text style={s.btnText}>Accept Invitation</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
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
                onChangeText={t => { setFirmName(t); if (createFirmError) setCreateFirmError(null); }}
                placeholder="e.g. Sharma & Associates"
                placeholderTextColor={c.textTertiary}
              />
              {createFirmError ? (
                <Text style={s.errorText}>{createFirmError}</Text>
              ) : null}
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
          </>
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
                    <Text style={s.memberPhone}>{m.name || m.phone}</Text>
                    <Text style={s.memberRole}>
                      {m.role === 'owner' ? 'Owner' : 'Junior Advocate'}
                      {m.joinedAt ? ` · Joined ${new Date(m.joinedAt).toLocaleDateString()}` : ''}
                    </Text>
                  </View>
                  {isOwner && m.role !== 'owner' && (
                    <TouchableOpacity
                      style={s.dangerBtn}
                      onPress={() => handleRemoveMember(m.advocateId, m.name || m.phone)}
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
                  onChangeText={handlePhoneChange}
                  placeholder="e.g. 9876543210"
                  placeholderTextColor={c.textTertiary}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
                {invitePhoneError ? (
                  <Text style={s.errorText}>{invitePhoneError}</Text>
                ) : null}
                {inviteSuccessMsg ? (
                  <Text style={s.successText}>{inviteSuccessMsg}</Text>
                ) : null}

                {/* Case A — not on LawFlow yet */}
                {notRegisteredPhone ? (
                  <View style={s.notRegCard}>
                    <Text style={s.notRegTitle}>This advocate isn't on LawFlow yet.</Text>
                    <Text style={s.notRegSub}>Share your referral code to invite them:</Text>
                    <View style={s.referralBox}>
                      <Text style={s.referralCode}>{referralCode ?? '—'}</Text>
                    </View>
                    <TouchableOpacity
                      style={s.waBtn}
                      onPress={() => {
                        const msg = `Hi! I use LawFlow to manage my legal practice. Join me — use my referral code ${referralCode ?? ''} when signing up and get bonus days on Pro! Download: https://lawflow.in`;
                        if (Platform.OS !== 'web') {
                          sendWhatsAppMessage(notRegisteredPhone, msg);
                        }
                      }}
                    >
                      <Feather name="message-circle" size={16} color="#FFFFFF" />
                      <Text style={s.waBtnText}>Share via WhatsApp</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                <TouchableOpacity
                  testID="invite-btn"
                  style={[s.btn, (!isValidPhone(invitePhone) || checkLoading || submitting) && s.btnDisabled]}
                  onPress={handleInvite}
                  disabled={!isValidPhone(invitePhone) || checkLoading || submitting}
                >
                  {checkLoading || submitting ? (
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
