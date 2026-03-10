import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { getPortalData } from '../../src/services/api';

// Standalone light colors — no auth required for public portal
const C = {
  bg: '#FFFFFF',
  surface: '#F5F5F5',
  border: '#E5E5E5',
  text: '#000000',
  textSub: '#6E6E73',
  accent: '#007AFF',
  error: '#FF3B30',
  success: '#34C759',
  warning: '#FF9500',
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDate(ts?: number | string | null): string {
  if (!ts) return '—';
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  if (isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function getStatusColor(status?: string): string {
  if (!status) return C.textSub;
  const s = status.toLowerCase();
  if (s === 'active' || s === 'running') return C.success;
  if (s === 'disposed' || s === 'closed') return C.textSub;
  if (s === 'stayed' || s === 'adjourned') return C.warning;
  if (s === 'pending' || s === 'filed') return C.accent;
  return C.textSub;
}

export default function PortalViewScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid portal link.');
      setLoading(false);
      return;
    }

    getPortalData(token as string)
      .then(resp => {
        if (resp.success) setData(resp.data);
        else setError('Unable to load portal data.');
      })
      .catch((err: any) => {
        const msg: string = err?.message || '';
        const status: number = err?.status ?? 0;
        if (msg.toLowerCase().includes('revoked') || status === 410) {
          setError('This portal link has been revoked by your advocate.\nPlease contact them for a new link.');
        } else if (msg.toLowerCase().includes('expired')) {
          setError('This portal link has expired.\nPlease contact your advocate for a new link.');
        } else if (status === 404) {
          setError('Portal link not found.\nThe link may be invalid or has been deleted.');
        } else {
          setError(msg || 'Failed to load portal data. Please try again.');
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered} testID="portal-loading">
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={styles.loadingText}>Loading portal...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered} testID="portal-error-screen">
          <View style={styles.errorIconWrap}>
            <Feather name="alert-circle" size={52} color={C.error} />
          </View>
          <Text style={styles.errorTitle} testID="portal-error-title">Link Unavailable</Text>
          <Text style={styles.errorMessage} testID="portal-error-message">{error}</Text>
          <View style={styles.errorDivider} />
          <Text style={styles.errorFooter}>
            Contact your advocate if you believe this is a mistake.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const { client, cases, notes, advocate, expiresAt } = data || {};

  return (
    <SafeAreaView style={styles.safe} testID="portal-view-screen">
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Feather name="briefcase" size={20} color={C.accent} />
          <Text style={styles.logoText}>LawFlow</Text>
        </View>
        <Text style={styles.headerSub}>
          Shared by {advocate?.name || 'Your Advocate'}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Client Info */}
        {client && (
          <View style={styles.card} testID="portal-client-card">
            <Text style={styles.sectionLabel}>CLIENT</Text>
            <Text style={styles.clientName} testID="portal-client-name">
              {client.name}
            </Text>
            {client.phone && (
              <Text style={styles.clientSub}>{client.phone}</Text>
            )}
          </View>
        )}

        {/* Cases */}
        <View style={styles.card} testID="portal-cases-card">
          <Text style={styles.sectionLabel}>
            CASES {cases?.length ? `(${cases.length})` : ''}
          </Text>
          {!cases || cases.length === 0 ? (
            <Text style={styles.emptyText}>No cases shared.</Text>
          ) : (
            cases.map((c: any, i: number) => (
              <View
                key={c.id || i}
                testID={`portal-case-${i}`}
                style={[styles.caseItem, i < cases.length - 1 && styles.caseDivider]}
              >
                <View style={styles.caseRow}>
                  <View style={styles.caseInfo}>
                    {c.caseNumber && (
                      <Text style={styles.caseNumber}>{c.caseNumber}</Text>
                    )}
                    {c.title && (
                      <Text style={styles.caseTitle}>{c.title}</Text>
                    )}
                    {c.courtName && (
                      <Text style={styles.caseCourt}>{c.courtName}</Text>
                    )}
                    {c.nextHearingDate ? (
                      <Text style={styles.caseHearing} testID={`portal-case-hearing-${i}`}>
                        Next Hearing: {fmtDate(c.nextHearingDate)}
                      </Text>
                    ) : null}
                  </View>
                  {c.status && (
                    <View style={[styles.statusBadge, { borderColor: getStatusColor(c.status) }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(c.status) }]}
                        testID={`portal-case-status-${i}`}>
                        {c.status}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Advocate Notes */}
        {notes ? (
          <View style={styles.card} testID="portal-notes-card">
            <Text style={styles.sectionLabel}>NOTES FROM ADVOCATE</Text>
            <Text style={styles.notesText} testID="portal-notes-text">{notes}</Text>
          </View>
        ) : null}

        {/* Advocate Info */}
        {advocate && (
          <View style={styles.card} testID="portal-advocate-card">
            <Text style={styles.sectionLabel}>YOUR ADVOCATE</Text>
            <Text style={styles.advocateName}>{advocate.name}</Text>
            {advocate.phone && (
              <Text style={styles.advocatePhone}>{advocate.phone}</Text>
            )}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} testID="portal-footer">
          <Feather name="lock" size={12} color={C.textSub} />
          <Text style={styles.footerText} testID="portal-expiry-text">
            Read-only view · Expires {fmtDate(expiresAt)}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 16,
  },
  loadingText: { fontSize: 16, color: C.textSub, marginTop: 8 },
  errorIconWrap: { marginBottom: 8 },
  errorTitle: { fontSize: 22, fontWeight: '700', color: C.text, textAlign: 'center' },
  errorMessage: {
    fontSize: 15, color: C.textSub, textAlign: 'center',
    lineHeight: 22, whiteSpace: Platform.OS === 'web' ? 'pre-line' : undefined,
  } as any,
  errorDivider: { width: 40, height: 1, backgroundColor: C.border, marginVertical: 4 },
  errorFooter: { fontSize: 13, color: C.textSub, textAlign: 'center' },
  header: {
    backgroundColor: C.bg,
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  logoText: { fontSize: 18, fontWeight: '700', color: C.text },
  headerSub: { fontSize: 13, color: C.textSub },
  content: { padding: 16, paddingBottom: 48 },
  card: {
    backgroundColor: C.surface, borderRadius: 12,
    padding: 16, marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: C.textSub,
    letterSpacing: 0.8, marginBottom: 10,
  },
  clientName: { fontSize: 20, fontWeight: '700', color: C.text },
  clientSub: { fontSize: 14, color: C.textSub, marginTop: 4 },
  caseItem: { paddingVertical: 10 },
  caseDivider: { borderBottomWidth: 1, borderBottomColor: C.border },
  caseRow: { flexDirection: 'row', alignItems: 'flex-start' },
  caseInfo: { flex: 1, gap: 2 },
  caseNumber: {
    fontSize: 11, fontWeight: '600', color: C.textSub,
    letterSpacing: 0.5, textTransform: 'uppercase',
  },
  caseTitle: { fontSize: 15, fontWeight: '500', color: C.text, marginTop: 2 },
  caseCourt: { fontSize: 13, color: C.textSub, marginTop: 2 },
  caseHearing: { fontSize: 13, color: C.accent, marginTop: 4, fontWeight: '500' },
  statusBadge: {
    borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
    alignSelf: 'flex-start', marginLeft: 8, marginTop: 2,
  },
  statusText: { fontSize: 11, fontWeight: '600' },
  notesText: { fontSize: 15, color: C.textSub, lineHeight: 22 },
  advocateName: { fontSize: 16, fontWeight: '600', color: C.text },
  advocatePhone: { fontSize: 14, color: C.textSub, marginTop: 4 },
  emptyText: { fontSize: 14, color: C.textSub },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 16,
  },
  footerText: { fontSize: 12, color: C.textSub },
});
