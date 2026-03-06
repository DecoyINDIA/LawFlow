import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, Platform, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { Colors, Typography, Spacing, Radius } from '../src/theme';
import { useApp, VoiceNote } from '../src/context/AppContext';

function fmtDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
function fmtTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function VoiceNotesScreen() {
  const router = useRouter();
  const { voiceNotes, addVoiceNote, deleteVoiceNote, cases } = useApp();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  };

  const stopPulse = () => {
    pulse.stopAnimation();
    pulse.setValue(1);
  };

  const startRecording = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { granted } = await Audio.requestPermissionsAsync();
        if (!granted) {
          Alert.alert('Permission Required', 'Microphone access is needed to record voice notes.');
          return;
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      }
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
      setIsRecording(true);
      setElapsed(0);
      startPulse();
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } catch (e) {
      Alert.alert('Error', 'Could not start recording. Please check microphone permissions.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      stopPulse();
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI() ?? '';
      const duration = elapsed;
      setRecording(null);
      setIsRecording(false);
      const title = `Voice Note ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
      addVoiceNote({ title, uri, duration, caseId: undefined, caseName: undefined });
      setElapsed(0);
    } catch {
      setIsRecording(false);
      setElapsed(0);
    }
  };

  const playNote = async (note: VoiceNote) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      if (playingId === note.id) { setPlayingId(null); return; }
      if (!note.uri) { Alert.alert('Not available', 'Recording URI not available in web preview.'); return; }
      const { sound } = await Audio.Sound.createAsync({ uri: note.uri });
      soundRef.current = sound;
      setPlayingId(note.id);
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) { setPlayingId(null); }
      });
    } catch {
      Alert.alert('Playback Error', 'Could not play this recording.');
      setPlayingId(null);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Note', 'Delete this voice note?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteVoiceNote(id) },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Voice Notes</Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={voiceNotes}
        keyExtractor={i => i.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.list, voiceNotes.length === 0 && s.emptyList]}
        ListEmptyComponent={
          <View style={s.empty}>
            <Feather name="mic-off" size={48} color={Colors.textTertiary} />
            <Text style={s.emptyTitle}>No voice notes yet</Text>
            <Text style={s.emptySub}>Tap the record button below to start</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.noteCard} testID={`voice-note-${item.id}`}>
            <TouchableOpacity style={s.playBtn} onPress={() => playNote(item)} activeOpacity={0.7}>
              <Feather name={playingId === item.id ? 'square' : 'play'} size={18} color={Colors.white} />
            </TouchableOpacity>
            <View style={s.noteInfo}>
              <Text style={s.noteTitle} numberOfLines={1}>{item.title}</Text>
              <View style={s.noteMetaRow}>
                <Text style={s.noteMeta}>{fmtDuration(item.duration)}</Text>
                {item.caseName && <Text style={s.noteMeta} numberOfLines={1}> · {item.caseName}</Text>}
              </View>
              <Text style={s.noteTime}>{fmtTime(item.createdAt)}</Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={s.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="trash-2" size={15} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Record Button */}
      <View style={s.recBar}>
        {isRecording && (
          <Text style={s.recTimer}>{fmtDuration(elapsed)}</Text>
        )}
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <TouchableOpacity
            testID="record-btn"
            style={[s.recBtn, isRecording && s.recBtnActive]}
            onPress={isRecording ? stopRecording : startRecording}
            activeOpacity={0.8}
          >
            <Feather name={isRecording ? 'square' : 'mic'} size={26} color={Colors.white} />
          </TouchableOpacity>
        </Animated.View>
        <Text style={s.recLabel}>{isRecording ? 'Tap to stop' : 'Tap to record'}</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.m, paddingTop: Spacing.s, paddingBottom: Spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, ...Typography.headline, color: Colors.textPrimary, textAlign: 'center' },
  list: { padding: Spacing.m, paddingBottom: 120 },
  emptyList: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.s, paddingTop: 60 },
  emptyTitle: { ...Typography.title3, color: Colors.textSecondary },
  emptySub: { ...Typography.subhead, color: Colors.textTertiary },
  noteCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.m,
    backgroundColor: Colors.surface, borderRadius: Radius.m,
    padding: Spacing.m, marginBottom: Spacing.s,
  },
  playBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.black, alignItems: 'center', justifyContent: 'center' },
  noteInfo: { flex: 1, gap: 2 },
  noteTitle: { ...Typography.subhead, fontWeight: '500', color: Colors.textPrimary },
  noteMetaRow: { flexDirection: 'row', alignItems: 'center' },
  noteMeta: { ...Typography.caption1, color: Colors.textSecondary, flexShrink: 1 },
  noteTime: { ...Typography.caption2, color: Colors.textTertiary },
  deleteBtn: { padding: 4 },
  recBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
    paddingBottom: Platform.OS === 'ios' ? 36 : 16,
    paddingTop: Spacing.m,
    alignItems: 'center', gap: Spacing.s,
  },
  recTimer: { ...Typography.title2, color: Colors.textPrimary, fontVariant: ['tabular-nums'] },
  recBtn: { width: 70, height: 70, borderRadius: 35, backgroundColor: Colors.black, alignItems: 'center', justifyContent: 'center' },
  recBtnActive: { backgroundColor: '#333' },
  recLabel: { ...Typography.caption1, color: Colors.textSecondary },
});
