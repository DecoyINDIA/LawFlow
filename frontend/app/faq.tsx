import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../src/theme';

// ── FAQ content ─────────────────────────────────────────────────────────────
const FAQ_SECTIONS = [
  {
    section: 'Getting Started',
    items: [
      {
        q: 'How do I add my first case?',
        a: 'Go to the Cases tab and tap the + button at the bottom right. Fill in the case number, case type, court name, and client name. Tap Save — your case is now added and you can start tracking hearings and documents.',
      },
      {
        q: 'How do I add a client?',
        a: "Go to the Clients tab and tap the + button. Enter the client's name and phone number. Once saved, you can link cases to this client and send them WhatsApp updates directly from the app.",
      },
      {
        q: 'How do I record a hearing date?',
        a: 'Open any case, scroll down to the Hearings section, and tap "Add Hearing". Enter the date, time, and court. LawFlow will automatically remind you before the hearing.',
      },
    ],
  },
  {
    section: 'eCourts Integration',
    items: [
      {
        q: 'What is eCourts integration?',
        a: 'LawFlow can automatically fetch your case status from the official eCourts website. Just enter your CNR number in the case detail and tap "Fetch from eCourts". The app will pull the latest hearing dates and case status directly — no need to check the website manually.',
      },
      {
        q: 'Which courts are supported?',
        a: 'LawFlow supports all District Courts across India and 5 High Courts — Bombay, Delhi, Madras, Calcutta, and Allahabad. More High Courts will be added over time.',
      },
      {
        q: 'Why is eCourts not working for my case?',
        a: 'eCourts lookup requires a valid CNR number. Make sure you have entered the correct CNR. Some courts may have temporary downtime on the eCourts website — try again after some time.',
      },
    ],
  },
  {
    section: 'WhatsApp Updates',
    items: [
      {
        q: 'How do I send a hearing reminder to my client?',
        a: 'Open a case and tap the "Remind Client" button next to any upcoming hearing. LawFlow will open WhatsApp with a pre-filled message — just tap Send.',
      },
      {
        q: 'What is Bulk Remind?',
        a: 'Bulk Remind (available for Pro users) lets you send hearing reminders to all clients with upcoming hearings in one go. Go to More → Bulk Reminders, review the list, and tap Send All.',
      },
      {
        q: 'Can I customise the WhatsApp message?',
        a: 'Yes. Go to More → Message Templates to edit the default reminder and update message templates.',
      },
    ],
  },
  {
    section: 'Documents & Voice Notes',
    items: [
      {
        q: 'How do I attach a document to a case?',
        a: 'Open a case and scroll to the Documents section. Tap "Add Document" to pick a file from your phone. Documents are stored securely on your Google Drive (Pro feature).',
      },
      {
        q: 'What are Voice Notes?',
        a: 'Voice Notes (Pro feature) let you record quick audio memos against a case — useful for recording client instructions, court observations, or reminders to yourself. Open a case and scroll to Voice Notes to record.',
      },
    ],
  },
  {
    section: 'Google Drive',
    items: [
      {
        q: 'Why does LawFlow need Google Drive access?',
        a: 'LawFlow stores your case documents and voice notes on your personal Google Drive so they are backed up securely and accessible from any device. LawFlow never stores files on our servers.',
      },
      {
        q: 'How do I connect Google Drive?',
        a: 'Go to Settings → Google Drive and tap "Connect". Sign in with your Google account and grant permission. Once connected, all new documents and voice notes will sync automatically.',
      },
    ],
  },
  {
    section: 'Client Portal',
    items: [
      {
        q: 'What is the Client Portal?',
        a: 'The Client Portal lets you share a secure link with your client so they can check their case status, next hearing date, and notes — without calling you. No login required for your client.',
      },
      {
        q: 'How do I generate a portal link?',
        a: 'Open a client\'s profile and tap "Generate Portal Link". Share the link via WhatsApp or copy it. You can revoke the link anytime from the same screen.',
      },
      {
        q: 'Is the Client Portal free?',
        a: 'Yes — the Client Portal is completely free for all users, including the Free plan.',
      },
    ],
  },
  {
    section: 'Law Firm Mode',
    items: [
      {
        q: 'What is Law Firm Mode?',
        a: 'Law Firm Mode lets you create a firm profile and invite junior advocates to join. As the firm owner, you can assign cases to team members and view the firm dashboard showing everyone\'s workload.',
      },
      {
        q: 'How do I invite a junior advocate?',
        a: 'Go to More → Law Firm → Invite Junior Advocate. Enter their 10-digit mobile number. If they are already on LawFlow, they will receive an invitation in the app and via WhatsApp. If they are not on LawFlow yet, you can share your referral code with them.',
      },
      {
        q: 'Can a junior advocate see all my cases?',
        a: 'No. Junior advocates can only see cases that have been specifically assigned to them by the firm owner.',
      },
    ],
  },
  {
    section: 'Referral Program',
    items: [
      {
        q: 'What is the Refer a Friend program?',
        a: 'Every LawFlow user gets a unique referral code. Share your code with other advocates. When they sign up using your code and upgrade to Pro, you get 1 month of Pro added to your account for free.',
      },
      {
        q: 'What does the person I refer get?',
        a: 'If they subscribe to the monthly plan using your code, they get 45 days instead of 30. If they subscribe to the yearly plan, they get 15 months instead of 12.',
      },
      {
        q: 'Where do I find my referral code?',
        a: 'Go to More → Refer a Friend. Your unique code is displayed there. You can copy it or share it directly via WhatsApp.',
      },
    ],
  },
  {
    section: 'Subscription & Plans',
    items: [
      {
        q: 'What is the difference between Free and Pro?',
        a: 'The Free plan allows up to 10 cases and 10 clients with basic features. Pro (₹99/month or ₹999/year) gives you unlimited cases and clients plus eCourts integration, PDF reports, Google Drive storage, Bulk WhatsApp reminders, Voice Notes, device calendar sync, analytics, and data export.',
      },
      {
        q: 'What happens if my Pro plan expires?',
        a: 'You get a 3-day grace period after expiry where everything still works. After that, cases and clients over the free limit become read-only — they are never deleted. You can upgrade again anytime to restore full access.',
      },
      {
        q: 'How do I upgrade to Pro?',
        a: 'Go to More → Upgrade to Pro, or tap "Get Pro" anywhere you see it. Choose Monthly or Yearly and tap Continue to Payment.',
      },
    ],
  },
  {
    section: 'Device Calendar Sync',
    items: [
      {
        q: 'What is Device Calendar Sync?',
        a: 'When enabled, LawFlow automatically adds your hearing dates to your phone\'s calendar app. You will get native calendar reminders even without opening LawFlow.',
      },
      {
        q: 'How do I enable Calendar Sync?',
        a: 'Go to Settings → Calendar and toggle it on. Grant calendar permission when asked. You can also tap "Sync All Existing Hearings" to add all your past hearings to the calendar at once.',
      },
    ],
  },
  {
    section: 'Data & Privacy',
    items: [
      {
        q: 'Is my data safe?',
        a: 'Yes. All your data is stored on MongoDB Atlas with encryption. Documents and voice notes are stored on your personal Google Drive — LawFlow never has access to your files.',
      },
      {
        q: 'Can I export my data?',
        a: 'Yes (Pro feature). Go to More → Analytics → Export Data to download your cases, clients, and hearings as a file.',
      },
    ],
  },
  {
    section: 'Support',
    items: [
      {
        q: 'I found a bug or have a suggestion. How do I report it?',
        a: 'Go to More → Share Feedback. We read every message and respond within 2 working days.',
      },
      {
        q: 'How do I contact support?',
        a: 'Email us at support@lawflow.in or use the feedback option in the app.',
      },
    ],
  },
];

// ── Accordion item ────────────────────────────────────────────────────────────
interface AccordionItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
  s: ReturnType<typeof makeStyles>;
  c: ColorPalette;
}

function AccordionItem({ question, answer, isOpen, onToggle, s, c }: AccordionItemProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.timing(scale, { toValue: 0.97, duration: 150, useNativeDriver: true }).start();

  const onPressOut = () =>
    Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }).start();

  return (
    <Animated.View style={[s.item, { transform: [{ scale }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onToggle}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={s.questionRow}
      >
        <Text style={s.question}>{question}</Text>
        <Feather
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={c.textSecondary}
        />
      </TouchableOpacity>
      {isOpen && (
        <View style={s.answerBox}>
          <Text style={s.answer}>{answer}</Text>
        </View>
      )}
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function FAQScreen() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  const toggle = useCallback((key: string) => {
    setOpenKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQ_SECTIONS;
    return FAQ_SECTIONS.map(sec => ({
      ...sec,
      items: sec.items.filter(
        item => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
      ),
    })).filter(sec => sec.items.length > 0);
  }, [query]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          testID="faq-back-btn"
          onPress={() => router.back()}
          style={s.back}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={22} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Help & FAQ</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Search */}
      <View style={s.searchRow}>
        <Feather name="search" size={16} color={c.textTertiary} style={s.searchIcon} />
        <TextInput
          testID="faq-search-input"
          style={s.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search questions…"
          placeholderTextColor={c.textTertiary}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={16} color={c.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View style={s.empty}>
            <Feather name="help-circle" size={40} color={c.textTertiary} />
            <Text style={s.emptyText}>No results for "{query}"</Text>
          </View>
        ) : (
          filtered.map(sec => (
            <View key={sec.section} testID={`faq-section-${sec.section.replace(/\s+/g, '-')}`}>
              <Text style={s.sectionHeader}>{sec.section.toUpperCase()}</Text>
              <View style={s.card}>
                {sec.items.map((item, idx) => {
                  const key = `${sec.section}::${idx}`;
                  return (
                    <React.Fragment key={key}>
                      <AccordionItem
                        question={item.q}
                        answer={item.a}
                        isOpen={openKeys.has(key)}
                        onToggle={() => toggle(key)}
                        s={s}
                        c={c}
                      />
                      {idx < sec.items.length - 1 && <View style={s.divider} />}
                    </React.Fragment>
                  );
                })}
              </View>
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const makeStyles = (c: ColorPalette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.m, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: c.divider,
    },
    back: { width: 36, alignItems: 'flex-start' },
    title: { ...Typography.headline, color: c.textPrimary, fontWeight: '700' as const },

    searchRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.surface, borderRadius: Radius.s,
      marginHorizontal: Spacing.m, marginTop: Spacing.m, marginBottom: Spacing.s,
      paddingHorizontal: Spacing.s, paddingVertical: 8,
    },
    searchIcon: { marginRight: 6 },
    searchInput: {
      flex: 1, ...Typography.body, color: c.textPrimary,
      paddingVertical: 0,
    },

    scroll: { flex: 1 },
    content: { paddingHorizontal: Spacing.m, paddingTop: Spacing.s },

    sectionHeader: {
      ...Typography.caption1, color: c.textTertiary,
      fontWeight: '600' as const, letterSpacing: 0.6,
      marginTop: Spacing.m, marginBottom: 6, marginLeft: 4,
    },
    card: {
      backgroundColor: c.surface, borderRadius: Radius.m,
      overflow: 'hidden',
    },
    item: { backgroundColor: c.surface },
    questionRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.m, paddingVertical: 14,
    },
    question: {
      ...Typography.callout, color: c.textPrimary,
      flex: 1, marginRight: Spacing.s, fontWeight: '500' as const,
    },
    answerBox: {
      paddingHorizontal: Spacing.m,
      paddingTop: 2, paddingBottom: 14,
    },
    answer: { ...Typography.footnote, color: c.textSecondary, lineHeight: 20 },
    divider: { height: 1, backgroundColor: c.divider, marginHorizontal: Spacing.m },

    empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
    emptyText: { ...Typography.callout, color: c.textTertiary },
  });
