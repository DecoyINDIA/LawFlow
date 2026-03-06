import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../src/theme';
import { useApp, AppNotification } from '../src/context/AppContext';

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

const ICON_NAMES: Record<string, string> = {
  HEARING_REMINDER: 'calendar',
  MISSED_HEARING: 'alert-circle',
  CASE_UPDATE: 'briefcase',
  SYSTEM: 'bell',
};

type ListItem =
  | { type: 'header'; label: string; key: string }
  | { type: 'item'; data: AppNotification; key: string };

export default function NotificationsScreen() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const { notifications, markNotificationRead } = useApp();
  const [readIds, setReadIds] = useState<Set<string>>(
    () => new Set(notifications.filter(n => !!n.readAt).map(n => n.id))
  );

  const isRead = (id: string) => readIds.has(id);

  const handleTap = (n: AppNotification) => {
    setReadIds(prev => new Set([...prev, n.id]));
    markNotificationRead(n.id);
    if (n.caseId) router.push(`/cases/${n.caseId}` as any);
  };

  const handleMarkAllRead = () => {
    const all = new Set(notifications.map(n => n.id));
    setReadIds(all);
    notifications.forEach(n => markNotificationRead(n.id));
  };

  const unread = useMemo(() => notifications.filter(n => !isRead(n.id)).length, [notifications, readIds]);

  // Build grouped list: Today | Earlier
  const listData = useMemo((): ListItem[] => {
    const todayCutoff = Date.now() - 86400000;
    const today = notifications.filter(n => n.createdAt >= todayCutoff);
    const earlier = notifications.filter(n => n.createdAt < todayCutoff);
    const items: ListItem[] = [];
    if (today.length > 0) {
      items.push({ type: 'header', label: 'TODAY', key: 'h-today' });
      today.forEach(n => items.push({ type: 'item', data: n, key: n.id }));
    }
    if (earlier.length > 0) {
      items.push({ type: 'header', label: 'EARLIER', key: 'h-earlier' });
      earlier.forEach(n => items.push({ type: 'item', data: n, key: n.id }));
    }
    return items;
  }, [notifications]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} testID="notif-back-btn">
          <Feather name="arrow-left" size={22} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Notifications</Text>
        {unread > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead} testID="mark-all-read-btn">
            <Text style={s.markRead}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      <FlatList
        data={listData}
        keyExtractor={i => i.key}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={listData.length === 0 ? s.emptyContainer : s.list}
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return (
              <View style={s.groupHeader} key={item.key}>
                <Text style={s.groupTitle}>{item.label}</Text>
              </View>
            );
          }
          const n = item.data;
          const read = isRead(n.id);
          return (
            <TouchableOpacity
              testID={`notif-${n.id}`}
              style={[s.item, !read && s.itemUnread]}
              onPress={() => handleTap(n)}
              activeOpacity={0.7}
            >
              <View style={[s.iconBox, n.type === 'MISSED_HEARING' && s.iconBoxAlert]}>
                <Feather name={ICON_NAMES[n.type] as any} size={16} color={n.type === 'MISSED_HEARING' ? c.background : c.textPrimary} />
              </View>
              <View style={s.info}>
                <View style={s.titleRow}>
                  <Text style={[s.itemTitle, !read && s.itemTitleUnread]}>{n.title}</Text>
                  {!read && <View style={s.unreadDot} />}
                </View>
                <Text style={s.itemBody} numberOfLines={2}>{n.body}</Text>
                <Text style={s.time}>{timeAgo(n.createdAt)}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Feather name="check-circle" size={48} color={c.textTertiary} />
            <Text style={s.emptyTitle}>You're all caught up</Text>
            <Text style={s.emptySub}>No new notifications</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.m, paddingTop: Spacing.s, paddingBottom: Spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, ...Typography.headline, color: c.textPrimary, textAlign: 'center' },
  markRead: { ...Typography.footnote, color: c.textPrimary, fontWeight: '600', textDecorationLine: 'underline', width: 80, textAlign: 'right' },
  list: { paddingBottom: 32 },
  emptyContainer: { flex: 1 },
  groupHeader: {
    paddingHorizontal: Spacing.m, paddingTop: Spacing.l, paddingBottom: Spacing.s,
  },
  groupTitle: {
    fontSize: 11, fontWeight: '700', color: c.textSecondary,
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  item: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.m,
    paddingHorizontal: Spacing.m, paddingVertical: Spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    backgroundColor: c.background,
  },
  itemUnread: { backgroundColor: c.surface },
  iconBox: {
    width: 40, height: 40, borderRadius: Radius.s,
    backgroundColor: c.surfaceHighlight, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  iconBoxAlert: { backgroundColor: c.textPrimary },
  info: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.s },
  itemTitle: { ...Typography.subhead, color: c.textPrimary, flex: 1 },
  itemTitleUnread: { fontWeight: '600' },
  unreadDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: c.textPrimary, flexShrink: 0 },
  itemBody: { ...Typography.footnote, color: c.textSecondary, lineHeight: 18 },
  time: { ...Typography.caption2, color: c.textTertiary },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.s, paddingTop: 100 },
  emptyTitle: { ...Typography.headline, color: c.textPrimary },
  emptySub: { ...Typography.subhead, color: c.textSecondary },
});
