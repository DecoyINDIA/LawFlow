import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Share, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../src/theme';
import { useApp } from '../src/context/AppContext';
import {
  getPortalLinks, revokePortalLink,
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
  card: {
    backgroundColor: c.surface, borderRadius: Radius.m,
    padding: Spacing.m, marginBottom: Spacing.s,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clientName: { ...Typography.headline, color: c.textPrimary },
  casesCount: { ...Typography.caption1, color: c.textSecondary, marginTop: 2 },
  dateRow: { flexDirection: 'row', gap: Spacing.m, marginTop: Spacing.xs },
  dateText: { ...Typography.caption1, color: c.textSecondary },
  actions: { flexDirection: 'row', gap: Spacing.s, marginTop: Spacing.s },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: Radius.s, backgroundColor: c.surfaceHighlight,
  },
  actionText: { ...Typography.caption1, fontWeight: '600' as const, color: c.textPrimary },
  revokeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: Radius.s, backgroundColor: '#FF3B3015',
  },
  revokeText: { ...Typography.caption1, fontWeight: '600' as const, color: '#FF3B30' },
  emptyText: { ...Typography.subhead, color: c.textTertiary, textAlign: 'center', paddingVertical: Spacing.xl },
  emptyIcon: { alignSelf: 'center' as const, marginBottom: Spacing.s },
});

export default function ClientPortalScreen() {
  const router = useRouter();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { authToken, clients } = useApp();

  const [links, setLinks] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLinks = useCallback(async () => {
    try {
      const resp = await getPortalLinks(authToken ?? undefined);
      if (resp.success) setLinks(resp.data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const handleRevoke = useCallback(async (token: string) => {
    const doRevoke = async () => {
      try {
        await revokePortalLink(token, authToken ?? undefined);
        setLinks(prev => prev.filter((l: any) => l.token !== token));
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
  }, [authToken]);

  const handleShare = useCallback(async (token: string) => {
    const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
    const url = `${baseUrl}/portal/${token}`;
    try {
      await Share.share({
        message: `View your case status: ${url}`,
        url: Platform.OS === 'ios' ? url : undefined,
      });
    } catch {
    }
  }, []);

  const getClientName = useCallback((clientId: string) => {
    const client = clients.find(cl => cl.id === clientId);
    return client?.name ?? 'Unknown Client';
  }, [clients]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="portal-back">
          <Feather name="arrow-left" size={22} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Client Portal</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {loading ? (
          <ActivityIndicator size="large" color={c.textPrimary} style={{ marginTop: Spacing.xl }} />
        ) : links.length === 0 ? (
          <View>
            <Feather name="link" size={40} color={c.textTertiary} style={s.emptyIcon} />
            <Text style={s.emptyText}>
              No active sharing links.{'\n'}Generate one from a client's detail page.
            </Text>
          </View>
        ) : (
          links.map((link: any) => {
            const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date();
            return (
              <View key={link.id || link.token} style={s.card}>
                <View style={s.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.clientName}>{getClientName(link.clientId)}</Text>
                    <Text style={s.casesCount}>
                      {(link.caseIds || []).length} case{(link.caseIds || []).length !== 1 ? 's' : ''} shared
                    </Text>
                  </View>
                  {isExpired && (
                    <View style={{ backgroundColor: '#FF3B3015', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ ...Typography.caption2, color: '#FF3B30' }}>Expired</Text>
                    </View>
                  )}
                </View>
                <View style={s.dateRow}>
                  <Text style={s.dateText}>
                    Created: {link.createdAt ? new Date(link.createdAt).toLocaleDateString() : '—'}
                  </Text>
                  <Text style={s.dateText}>
                    Expires: {link.expiresAt ? new Date(link.expiresAt).toLocaleDateString() : '—'}
                  </Text>
                </View>
                {link.notes ? (
                  <Text style={{ ...Typography.footnote, color: c.textSecondary, marginTop: 4 }}>
                    Note: {link.notes}
                  </Text>
                ) : null}
                <View style={s.actions}>
                  <TouchableOpacity style={s.actionBtn} onPress={() => handleShare(link.token)}>
                    <Feather name="share-2" size={14} color={c.textPrimary} />
                    <Text style={s.actionText}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.revokeBtn} onPress={() => handleRevoke(link.token)}>
                    <Feather name="x-circle" size={14} color="#FF3B30" />
                    <Text style={s.revokeText}>Revoke</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
