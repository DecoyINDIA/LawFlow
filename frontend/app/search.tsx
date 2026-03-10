import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../src/theme';
import { useApp } from '../src/context/AppContext';
import { StatusBadge } from '../src/components/common/StatusBadge';

type ResultType = 'case' | 'client' | 'hearing';
interface SearchResult {
  type: ResultType;
  id: string;
  title: string;
  sub: string;
  status?: any;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(ts: number) {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export default function SearchScreen() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const { cases, clients, hearings } = useApp();
  const [query, setQuery] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, []);

  const results = useMemo((): SearchResult[] => {
    if (query.trim().length < 2) return [];
    const q = query.toLowerCase();
    const res: SearchResult[] = [];

    cases.forEach(c => {
      if (
        (c.caseNumber ?? '').toLowerCase().includes(q) ||
        (c.title ?? '').toLowerCase().includes(q) ||
        (c.courtName ?? '').toLowerCase().includes(q) ||
        (c.plaintiffPetitioner ?? '').toLowerCase().includes(q) ||
        (c.defendant ?? '').toLowerCase().includes(q) ||
        (c.clientName ?? '').toLowerCase().includes(q) ||
        (c.status ?? '').toLowerCase().includes(q)
      ) {
        res.push({ type: 'case', id: c.id, title: c.title, sub: `${c.caseNumber} · ${c.courtName}`, status: c.status });
      }
    });

    clients.forEach(c => {
      if (
        (c.name ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.city ?? '').toLowerCase().includes(q)
      ) {
        res.push({ type: 'client', id: c.id, title: c.name, sub: `${c.clientType} · ${c.phone}` });
      }
    });

    hearings.forEach(h => {
      const c = cases.find(x => x.id === h.caseId);
      if (!c) return;
      if (
        (c.caseNumber ?? '').toLowerCase().includes(q) ||
        (h.purpose ?? '').toLowerCase().includes(q) ||
        (h.outcome ?? '').toLowerCase().includes(q) ||
        (c.courtName ?? '').toLowerCase().includes(q)
      ) {
        res.push({
          type: 'hearing',
          id: `${h.id}::${c.id}`,
          title: h.purpose ?? 'Hearing',
          sub: `${c.caseNumber} · ${fmtDate(h.hearingDate)}`,
        });
      }
    });

    return res.slice(0, 40);
  }, [query, cases, clients, hearings]);

  // Recent cases (last 5 by updatedAt)
  const recentCases = useMemo(() =>
    [...cases].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5),
    [cases]
  );

  const handleTap = (r: SearchResult) => {
    if (r.type === 'case') router.push(`/cases/${r.id}` as any);
    else if (r.type === 'client') router.push(`/clients/${r.id}` as any);
    else {
      const caseId = r.id.split('::')[1];
      router.push(`/cases/${caseId}` as any);
    }
  };

  const TYPE_ICONS: Record<ResultType, string> = { case: 'briefcase', client: 'user', hearing: 'calendar' };
  const TYPE_LABELS: Record<ResultType, string> = { case: 'CASE', client: 'CLIENT', hearing: 'HEARING' };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.back} testID="search-back-btn">
            <Feather name="arrow-left" size={22} color={c.textPrimary} />
          </TouchableOpacity>
          <View style={s.searchBox}>
            <Feather name="search" size={16} color={c.textTertiary} style={{ marginRight: 8 }} />
            <TextInput
              ref={inputRef}
              testID="global-search-input"
              style={s.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search cases, clients, hearings…"
              placeholderTextColor={c.textTertiary}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={16} color={c.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Results */}
        {query.length === 0 ? (
          <FlatList
            data={recentCases}
            keyExtractor={c => c.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.list}
            ListHeaderComponent={
              <Text style={s.sectionLabel}>RECENT CASES</Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                testID={`recent-case-${item.id}`}
                style={s.resultRow}
                onPress={() => router.push(`/cases/${item.id}` as any)}
                activeOpacity={0.7}
              >
                <View style={s.resultIcon}>
                  <Feather name="briefcase" size={15} color={c.textPrimary} />
                </View>
                <View style={s.resultInfo}>
                  <Text style={s.resultTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={s.resultSub} numberOfLines={1}>{item.caseNumber} · {item.courtName}</Text>
                </View>
                <StatusBadge status={item.status} small />
                <Feather name="chevron-right" size={14} color={c.textTertiary} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={s.hints}>
                <Feather name="search" size={40} color={c.textTertiary} />
                <Text style={s.hintsTitle}>Search LawFlow</Text>
                <Text style={s.hintsSub}>Find cases, clients and hearings by name, number, or court</Text>
              </View>
            }
          />
        ) : query.length < 2 ? (
          <View style={s.hints}>
            <Text style={s.hintsSub}>Type at least 2 characters to search</Text>
          </View>
        ) : results.length === 0 ? (
          <View style={s.hints}>
            <Feather name="search" size={32} color={c.textTertiary} />
            <Text style={s.hintsTitle}>No results for "{query}"</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={i => i.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.list}
            ListHeaderComponent={
              <Text style={s.sectionLabel}>{results.length} RESULT{results.length !== 1 ? 'S' : ''}</Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                testID={`result-${item.id}`}
                style={s.resultRow}
                onPress={() => handleTap(item)}
                activeOpacity={0.7}
              >
                <View style={s.resultIcon}>
                  <Feather name={TYPE_ICONS[item.type] as any} size={15} color={c.textPrimary} />
                </View>
                <View style={s.resultInfo}>
                  <View style={s.resultTitleRow}>
                    <Text style={s.resultTitle} numberOfLines={1}>{item.title}</Text>
                    <View style={s.typePill}>
                      <Text style={s.typeText}>{TYPE_LABELS[item.type]}</Text>
                    </View>
                  </View>
                  <Text style={s.resultSub} numberOfLines={1}>{item.sub}</Text>
                </View>
                {item.status && <StatusBadge status={item.status} small />}
                <Feather name="chevron-right" size={14} color={c.textTertiary} />
              </TouchableOpacity>
            )}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.s,
    paddingHorizontal: Spacing.m, paddingTop: Spacing.s, paddingBottom: Spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: c.surface, borderRadius: Radius.m,
    paddingHorizontal: Spacing.m, height: 40,
  },
  searchInput: {
    flex: 1, ...Typography.subhead, color: c.textPrimary,
    outlineStyle: 'none',
  } as any,
  list: { paddingBottom: 32 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: c.textSecondary, letterSpacing: 0.8,
    paddingHorizontal: Spacing.m, paddingTop: Spacing.l, paddingBottom: Spacing.s,
  },
  hints: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.s, padding: Spacing.xl },
  hintsTitle: { ...Typography.title3, color: c.textSecondary },
  hintsSub: { ...Typography.subhead, color: c.textTertiary, textAlign: 'center' },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.m,
    paddingHorizontal: Spacing.m, paddingVertical: Spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  resultIcon: { width: 36, height: 36, borderRadius: Radius.s, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  resultInfo: { flex: 1, gap: 3 },
  resultTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.s },
  resultTitle: { ...Typography.subhead, fontWeight: '500', color: c.textPrimary, flex: 1 },
  typePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full, backgroundColor: c.surface },
  typeText: { fontSize: 9, fontWeight: '700', color: c.textTertiary, letterSpacing: 0.3 },
  resultSub: { ...Typography.caption1, color: c.textSecondary },
});
