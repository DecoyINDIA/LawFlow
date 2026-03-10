import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  Linking, Animated, ActivityIndicator, Platform, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../../src/theme';
import { useApp } from '../../src/context/AppContext';
import { PaywallSheet } from '../../src/components/PaywallSheet';
import { StatusBadge } from '../../src/components/common/StatusBadge';
import { generatePortalLink, getPortalLinks, revokePortalLink } from '../../src/services/api';
import { printClientSummary } from '../../src/utils/pdfReports';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(ts?: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// Pressable button with scale animation
function PressableButton({
  onPress, style, children, testID
}: { onPress: () => void; style?: any; children: React.ReactNode; testID?: string }) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scale, { toValue: 0.97, duration: 150, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.timing(scale, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  };

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function ClientDetailScreen() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = params.id as string;
  const { getClientById, getCasesForClient, deleteClient, sendWhatsAppMessage, authToken, advocateProfile, hearings: allHearings, isProUser, cases: allCases } = useApp();

  const client = getClientById(id);
  const cases = getCasesForClient(id);

  // ── All hooks must be declared BEFORE any early returns ──
  const [printingClient, setPrintingClient] = React.useState(false);
  const [activePortalLink, setActivePortalLink] = useState<any>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [showCasesPaywall, setShowCasesPaywall] = useState(false);

  const loadPortalLinks = useCallback(async () => {
    if (!authToken || !id) return;
    try {
      const resp = await getPortalLinks(authToken ?? undefined);
      if (resp.success) {
        const clientLinks = (resp.data as any[]).filter(
          (l: any) => l.clientId === id && !l.revoked
        );
        setActivePortalLink(clientLinks.length > 0 ? clientLinks[0] : null);
      }
    } catch {
      // silent
    }
  }, [authToken, id]);

  useEffect(() => {
    loadPortalLinks();
  }, [loadPortalLinks]);

  if (!client) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Feather name="arrow-left" size={22} color={c.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Client</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={s.centered}>
          <Feather name="user-x" size={48} color={c.textTertiary} />
          <Text style={s.notFoundText}>Client not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={s.goBackBtn}>
            <Text style={s.goBackBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const initials = client.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const typeLabel = client.clientType.charAt(0) + client.clientType.slice(1).toLowerCase();

  const handlePrintClient = async () => {
    setPrintingClient(true);
    // Build upcoming hearings for this client's cases
    const now = Date.now();
    const clientCaseIds = new Set(cases.map(c => c.id));
    const upcoming = allHearings
      .filter(h => clientCaseIds.has(h.caseId) && h.hearingDate > now && !h.outcome)
      .sort((a, b) => a.hearingDate - b.hearingDate)
      .slice(0, 3)
      .map(h => ({
        case: cases.find(c => c.id === h.caseId)!,
        hearing: h,
      }))
      .filter(item => item.case);
    await printClientSummary({
      advocate: {
        advocateName: advocateProfile.name,
        barCouncil: advocateProfile.barCouncil,
        enrollmentNumber: advocateProfile.enrollmentNumber,
        phone: advocateProfile.phone,
        email: advocateProfile.email,
      },
      client,
      cases,
      upcomingHearings: upcoming,
    });
    setPrintingClient(false);
  };

  const handleSharePortal = async () => {
    const caseIds = cases.map(c => c.id);
    if (caseIds.length === 0) {
      Alert.alert('No Cases', 'Add at least one case for this client before generating a portal link.');
      return;
    }
    setPortalLoading(true);
    try {
      const resp = await generatePortalLink({ clientId: id, caseIds }, authToken ?? undefined);
      if (resp.success) {
        setActivePortalLink(resp.data);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to generate portal link');
    } finally {
      setPortalLoading(false);
    }
  };

  const handleRevokePortalFromDetail = async () => {
    if (!activePortalLink) return;
    const doRevoke = async () => {
      try {
        await revokePortalLink(activePortalLink.token, authToken ?? undefined);
        setActivePortalLink(null);
      } catch (err: any) {
        if (Platform.OS !== 'web') Alert.alert('Error', err.message || 'Failed to revoke');
      }
    };
    if (Platform.OS === 'web') {
      doRevoke();
    } else {
      Alert.alert('Revoke Link', 'This will permanently disable this sharing link.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Revoke', style: 'destructive', onPress: doRevoke },
      ]);
    }
  };

  const handleSharePortalUrl = async () => {
    if (!activePortalLink) return;
    const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
    const portalUrl = `${baseUrl}/portal/${activePortalLink.token}`;
    try {
      await Share.share({
        message: `View your case status: ${portalUrl}`,
        url: Platform.OS === 'ios' ? portalUrl : undefined,
      });
    } catch { /* silent */ }
  };

  const handleDelete = () => {
    if (Platform.OS === 'web') {
      // Alert.alert is blocked in browser iframes — delete directly on web
      deleteClient(id);
      router.back();
      return;
    }
    Alert.alert(
      'Delete Client',
      `Are you sure you want to delete "${client.name}"? This will not remove associated cases.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => { deleteClient(id); router.back(); }
        },
      ]
    );
  };

  const handleCall = () => {
    if (client.phone) {
      Linking.openURL(`tel:${client.phone}`);
    }
  };

  const handleWhatsApp = () => {
    if (client.phone) {
      const cleanPhone = client.phone.replace(/\D/g, '');
      const message = `Hello ${client.name}, this is regarding your legal matter.`;
      sendWhatsAppMessage(client.phone, message);
    }
  };

  const handleEmail = () => {
    if (client.email) {
      Linking.openURL(`mailto:${client.email}`);
    }
  };

  const handleNewCase = () => {
    if (!isProUser && allCases.length >= 10) {
      setShowCasesPaywall(true);
      return;
    }
    router.push({ pathname: '/cases/new', params: { prefillClientId: id } } as any);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={22} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Client</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            testID="print-client-btn"
            onPress={handlePrintClient}
            disabled={printingClient}
            style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
          >
            {printingClient
              ? <ActivityIndicator size="small" color={c.textPrimary} />
              : <Feather name="printer" size={18} color={c.textPrimary} />
            }
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/clients/new', params: { clientId: id } } as any)}
            style={s.editBtn}
            testID="edit-client-btn"
          >
            <Text style={s.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={s.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Profile Header */}
        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <Text style={s.name}>{client.name}</Text>
          <View style={s.typeBadge}>
            <Text style={s.typeBadgeText}>{typeLabel}</Text>
          </View>
        </View>

        {/* Contact Info Section */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>CONTACT INFO</Text>
          <View style={s.contactCard}>
            <TouchableOpacity style={s.contactRow} onPress={handleCall} activeOpacity={0.7}>
              <View style={s.contactIconWrap}>
                <Feather name="phone" size={16} color={c.textPrimary} />
              </View>
              <View style={s.contactInfo}>
                <Text style={s.contactLabel}>Phone</Text>
                <Text style={s.contactValue}>{client.phone}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={c.textTertiary} />
            </TouchableOpacity>

            {client.email && (
              <>
                <View style={s.contactDivider} />
                <TouchableOpacity style={s.contactRow} onPress={handleEmail} activeOpacity={0.7}>
                  <View style={s.contactIconWrap}>
                    <Feather name="mail" size={16} color={c.textPrimary} />
                  </View>
                  <View style={s.contactInfo}>
                    <Text style={s.contactLabel}>Email</Text>
                    <Text style={s.contactValue}>{client.email}</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={c.textTertiary} />
                </TouchableOpacity>
              </>
            )}

            {client.city && (
              <>
                <View style={s.contactDivider} />
                <View style={s.contactRow}>
                  <View style={s.contactIconWrap}>
                    <Feather name="map-pin" size={16} color={c.textPrimary} />
                  </View>
                  <View style={s.contactInfo}>
                    <Text style={s.contactLabel}>Location</Text>
                    <Text style={s.contactValue}>{client.city}{client.address ? `, ${client.address}` : ''}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Linked Cases Section */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>CASES</Text>
            <View style={s.countBadge}>
              <Text style={s.countBadgeText}>{cases.length}</Text>
            </View>
          </View>

          {cases.length === 0 ? (
            <View style={s.emptyCard}>
              <Feather name="briefcase" size={24} color={c.textTertiary} />
              <Text style={s.emptyText}>No cases linked yet</Text>
            </View>
          ) : (
            <View style={s.casesCard}>
              {cases.map((c, idx) => (
                <React.Fragment key={c.id}>
                  {idx > 0 && <View style={s.caseDivider} />}
                  <TouchableOpacity
                    testID={`linked-case-${c.id}`}
                    style={s.caseRow}
                    onPress={() => router.push(`/cases/${c.id}` as any)}
                    activeOpacity={0.7}
                  >
                    <View style={s.caseInfo}>
                      <Text style={s.caseNumber}>{c.caseNumber}</Text>
                      <Text style={s.caseTitle} numberOfLines={1}>{c.title}</Text>
                      <View style={s.caseMeta}>
                        <Text style={s.caseCourt} numberOfLines={1}>{c.courtName}</Text>
                        {c.nextHearingDate && (
                          <Text style={s.caseNextDate}>· Next: {fmtDate(c.nextHearingDate)}</Text>
                        )}
                      </View>
                    </View>
                    <View style={s.caseRight}>
                      <StatusBadge status={c.status} small />
                      <Feather name="chevron-right" size={14} color={c.textTertiary} />
                    </View>
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>QUICK ACTIONS</Text>
          <View style={s.actionsRow}>

            <PressableButton testID="call-btn" onPress={handleCall} style={s.actionBtn}>
              <Ionicons name="call-outline" size={20} color="#FFFFFF" />
              <Text style={s.actionText}>Call</Text>
            </PressableButton>

            <PressableButton testID="whatsapp-btn" onPress={handleWhatsApp} style={s.actionBtn}>
              <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
              <Text style={s.actionText}>WhatsApp</Text>
            </PressableButton>

            <PressableButton testID="new-case-btn" onPress={handleNewCase} style={s.actionBtn}>
              <Ionicons name="briefcase-outline" size={20} color="#FFFFFF" />
              <Text style={s.actionText}>New Case</Text>
            </PressableButton>

            <PressableButton testID="share-portal-btn" onPress={handleSharePortal} style={s.actionBtn}>
              {portalLoading
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Ionicons name="link-outline" size={20} color="#FFFFFF" />
              }
              <Text style={s.actionText}>Share Portal</Text>
            </PressableButton>

          </View>
        </View>

        {/* Active Portal Link */}
        {activePortalLink ? (() => {
          const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
          const portalUrl = `${baseUrl}/portal/${activePortalLink.token}`;
          const expiresAt = activePortalLink.expiresAt
            ? new Date(activePortalLink.expiresAt).toLocaleDateString()
            : '—';
          return (
            <View style={s.section} testID="portal-link-section">
              <Text style={s.sectionTitle}>ACTIVE PORTAL LINK</Text>
              <View style={s.portalCard}>
                <Text style={s.portalUrl} selectable numberOfLines={3} testID="portal-url-text">
                  {portalUrl}
                </Text>
                <Text style={s.portalExpiry} testID="portal-expiry-text">
                  Expires: {expiresAt}
                </Text>
                <View style={s.portalActions}>
                  <TouchableOpacity
                    testID="portal-share-btn"
                    style={s.portalShareBtn}
                    onPress={handleSharePortalUrl}
                  >
                    <Feather name="share-2" size={14} color={c.textPrimary} />
                    <Text style={s.portalShareBtnText}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="portal-revoke-btn"
                    style={s.portalRevokeBtn}
                    onPress={handleRevokePortalFromDetail}
                  >
                    <Feather name="x-circle" size={14} color="#FF3B30" />
                    <Text style={s.portalRevokeBtnText}>Revoke</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })() : null}

        {/* Notes */}
        {client.notes && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>NOTES</Text>
            <View style={s.notesCard}>
              <Text style={s.notesText}>{client.notes}</Text>
            </View>
          </View>
        )}

        {/* Notification Preferences */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>NOTIFICATION PREFERENCES</Text>
          <View style={s.prefsCard}>
            <View style={s.prefRow}>
              <Feather
                name={client.whatsappOptIn ? 'check-circle' : 'x-circle'}
                size={18}
                color={client.whatsappOptIn ? c.textPrimary : c.textTertiary}
              />
              <Text style={[s.prefText, !client.whatsappOptIn && s.prefTextOff]}>
                WhatsApp Reminders
              </Text>
            </View>
            <View style={s.prefDivider} />
            <View style={s.prefRow}>
              <Feather
                name={client.smsOptIn ? 'check-circle' : 'x-circle'}
                size={18}
                color={client.smsOptIn ? c.textPrimary : c.textTertiary}
              />
              <Text style={[s.prefText, !client.smsOptIn && s.prefTextOff]}>
                SMS Reminders
              </Text>
            </View>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={s.dangerSection}>
          <Text style={s.dangerTitle}>DANGER ZONE</Text>
          <TouchableOpacity
            testID="delete-client-btn"
            style={s.deleteBtn}
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <Feather name="trash-2" size={16} color="#FF3B30" />
            <Text style={s.deleteBtnText}>Delete Client</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <PaywallSheet
        visible={showCasesPaywall}
        onClose={() => setShowCasesPaywall(false)}
        featureName="Unlimited Cases"
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.m },
  notFoundText: { ...Typography.headline, color: c.textSecondary },
  goBackBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: c.textPrimary, borderRadius: Radius.m },
  goBackBtnText: { ...Typography.subhead, fontWeight: '600', color: c.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.headline, color: c.textPrimary },
  editBtn: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: c.textPrimary, borderRadius: 12 },
  editBtnText: { fontSize: 14, fontWeight: '600', color: c.background },

  content: { flex: 1 },

  // Profile Card
  profileCard: {
    alignItems: 'center', paddingVertical: 32,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: c.textPrimary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 24, fontWeight: '700', color: c.background },
  name: { fontSize: 22, fontWeight: '700', color: c.textPrimary, marginBottom: 8 },
  typeBadge: { paddingHorizontal: 12, paddingVertical: 4, backgroundColor: c.surface, borderRadius: 20 },
  typeBadgeText: { fontSize: 12, fontWeight: '600', color: c.textSecondary, letterSpacing: 0.3 },

  // Section
  section: { paddingHorizontal: 16, paddingTop: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: c.textSecondary, letterSpacing: 0.8, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  countBadge: {
    minWidth: 22, height: 22, borderRadius: 11, backgroundColor: c.textPrimary,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  countBadgeText: { fontSize: 12, fontWeight: '700', color: c.background },

  // Contact Card
  contactCard: { backgroundColor: c.surface, borderRadius: 12, overflow: 'hidden' },
  contactRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  contactIconWrap: {
    width: 36, height: 36, borderRadius: 8, backgroundColor: c.background,
    alignItems: 'center', justifyContent: 'center',
  },
  contactInfo: { flex: 1 },
  contactLabel: { fontSize: 11, color: c.textSecondary, marginBottom: 2 },
  contactValue: { fontSize: 15, color: c.textPrimary },
  contactDivider: { height: 1, backgroundColor: c.border, marginLeft: 64 },

  // Cases Card
  casesCard: { backgroundColor: c.surface, borderRadius: 12, overflow: 'hidden' },
  caseRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  caseDivider: { height: 1, backgroundColor: c.border, marginLeft: 16 },
  caseInfo: { flex: 1, gap: 2 },
  caseNumber: { fontSize: 11, fontWeight: '600', color: c.textSecondary, letterSpacing: 0.5 },
  caseTitle: { fontSize: 15, fontWeight: '500', color: c.textPrimary },
  caseMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  caseCourt: { fontSize: 13, color: c.textSecondary, flex: 1 },
  caseNextDate: { fontSize: 12, color: c.textSecondary },
  caseRight: { alignItems: 'flex-end', gap: 6 },

  // Empty Card
  emptyCard: {
    backgroundColor: c.surface, borderRadius: 12, padding: 32,
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  emptyText: { fontSize: 15, color: c.textSecondary },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    marginHorizontal: 4,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#888888',
    marginTop: 4,
  },

  // Notes Card
  notesCard: { backgroundColor: c.surface, borderRadius: 12, padding: 16 },
  notesText: { fontSize: 15, color: c.textSecondary, lineHeight: 22 },

  // Preferences Card
  prefsCard: { backgroundColor: c.surface, borderRadius: 12, overflow: 'hidden' },
  prefRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  prefText: { fontSize: 15, color: c.textPrimary },
  prefTextOff: { color: c.textSecondary },
  prefDivider: { height: 1, backgroundColor: c.border, marginLeft: 46 },

  // Portal Link Card
  portalCard: { backgroundColor: c.surface, borderRadius: 12, padding: 16 },
  portalUrl: {
    fontSize: 13, color: c.textSecondary, fontFamily: 'monospace',
    marginBottom: 8, lineHeight: 18,
  },
  portalExpiry: { fontSize: 13, color: c.textSecondary, marginBottom: 12 },
  portalActions: { flexDirection: 'row', gap: 8 },
  portalShareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: Radius.s, backgroundColor: c.surfaceHighlight,
  },
  portalShareBtnText: { ...Typography.caption1, fontWeight: '600' as const, color: c.textPrimary },
  portalRevokeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: Radius.s, backgroundColor: '#FF3B3015',
  },
  portalRevokeBtnText: { ...Typography.caption1, fontWeight: '600' as const, color: '#FF3B30' },

  // Danger Zone
  dangerSection: { paddingHorizontal: 16, paddingTop: 32, paddingBottom: 16 },
  dangerTitle: { fontSize: 12, fontWeight: '600', color: '#FF3B30', letterSpacing: 0.8, marginBottom: 12 },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#FF3B30',
  },
  deleteBtnText: { fontSize: 15, fontWeight: '600', color: '#FF3B30' },
});
