import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, TextInput, Alert, Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../../theme';
import { useApp } from '../../context/AppContext';
import type { VoiceNote } from '../../types';

const fmtDur = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
const fmtDate = (ts: number) => {
  const d = new Date(ts);
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate().toString().padStart(2,'0')} ${M[d.getMonth()]}`;
};
const fmtElapsed = (s: number) =>
  `${Math.floor(s / 60).toString().padStart(2,'0')}:${(s % 60).toString().padStart(2,'0')}`;

interface Props { caseId: string; caseName: string; }

export function VoiceNotesSection({ caseId, caseName }: Props) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { getVoiceNotesByCaseId, addVoiceNote, deleteVoiceNote, updateVoiceNote } = useApp();
  const notes = getVoiceNotesByCaseId(caseId);

  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const blinkAnim = useRef(new Animated.Value(1)).current;
  const blinkLoop = useRef<Animated.CompositeAnimation | null>(null);
  const elapsedRef = useRef(0);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    soundRef.current?.unloadAsync();
  }, []);

  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Required', 'Microphone access is needed.');
        return;
      }
      try {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      } catch {}

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      recordingRef.current = rec;
      elapsedRef.current = 0;
      setElapsed(0);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
      }, 1000);

      blinkLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, { toValue: 0.15, duration: 500, useNativeDriver: true }),
          Animated.timing(blinkAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      blinkLoop.current.start();
    } catch {
      Alert.alert('Error', 'Could not start recording. Check microphone permissions.');
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    blinkLoop.current?.stop();
    blinkAnim.setValue(1);
    setIsRecording(false);

    const rec = recordingRef.current;
    recordingRef.current = null;
    const dur = elapsedRef.current;
    setElapsed(0);
    elapsedRef.current = 0;

    if (!rec) return;
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      if (uri && dur > 0) {
        const label = `Note ${notes.length + 1}`;
        addVoiceNote({ caseId, caseName, title: label, uri, duration: dur });
      }
    } catch {
      Alert.alert('Error', 'Recording could not be saved.');
    }
  };

  const handlePlay = async (note: VoiceNote) => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      if (playingId === note.id) { setPlayingId(null); return; }

      const { sound } = await Audio.Sound.createAsync({ uri: note.uri });
      soundRef.current = sound;
      setPlayingId(note.id);
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate(s => {
        if (s.isLoaded && s.didJustFinish) {
          setPlayingId(null);
          soundRef.current = null;
          sound.unloadAsync();
        }
      });
    } catch {
      Alert.alert('Playback Error', 'Could not play this voice note.');
      setPlayingId(null);
    }
  };

  const handleDelete = (id: string, title: string) => {
    if (Platform.OS === 'web') {
      const ok = (globalThis as any).confirm?.(`Delete "${title}"?`);
      if (ok) deleteVoiceNote(id);
    } else {
      Alert.alert('Delete Voice Note', `Delete "${title}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteVoiceNote(id) },
      ]);
    }
  };

  const startEdit = (note: VoiceNote) => {
    setEditingId(note.id);
    setEditLabel(note.title);
  };

  const saveEdit = () => {
    if (editingId && editLabel.trim()) {
      updateVoiceNote(editingId, editLabel.trim());
    }
    setEditingId(null);
    setEditLabel('');
  };

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>VOICE NOTES ({notes.length})</Text>
        <TouchableOpacity
          testID={isRecording ? 'stop-recording-btn' : 'start-recording-btn'}
          style={[styles.recBtn, isRecording && styles.recBtnActive]}
          onPress={isRecording ? stopRecording : startRecording}
          activeOpacity={0.8}
        >
          <Feather name={isRecording ? 'square' : 'circle'} size={13} color={c.background} />
          <Text style={styles.recBtnText}>{isRecording ? 'Stop' : 'Record'}</Text>
        </TouchableOpacity>
      </View>

      {isRecording && (
        <View style={styles.recordingBar}>
          <Animated.View style={[styles.redDot, { opacity: blinkAnim }]} />
          <Text style={styles.elapsed}>{fmtElapsed(elapsed)}</Text>
          <Text style={styles.recordingLabel}>Recording...</Text>
        </View>
      )}

      {notes.length === 0 && !isRecording ? (
        <View style={styles.empty}>
          <Feather name="mic-off" size={24} color={c.textTertiary} />
          <Text style={styles.emptyText}>No voice notes recorded</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {notes.map(note => (
            <View key={note.id} style={styles.noteRow}>
              <Feather name="mic" size={14} color={c.textSecondary} />
              <View style={styles.noteInfo}>
                {editingId === note.id ? (
                  <TextInput
                    style={styles.renameInput}
                    value={editLabel}
                    onChangeText={setEditLabel}
                    onBlur={saveEdit}
                    onSubmitEditing={saveEdit}
                    autoFocus
                    selectTextOnFocus
                  />
                ) : (
                  <TouchableOpacity onPress={() => startEdit(note)} activeOpacity={0.7}>
                    <Text style={styles.noteLabel}>{note.title}</Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.noteMeta}>{fmtDate(note.createdAt)}</Text>
              </View>
              <Text style={styles.noteDur}>{fmtDur(note.duration)}</Text>
              <TouchableOpacity
                testID={`play-note-${note.id}`}
                style={styles.playBtn}
                onPress={() => handlePlay(note)}
                activeOpacity={0.7}
              >
                <Feather
                  name={playingId === note.id ? 'pause' : 'play'}
                  size={12}
                  color={c.background}
                />
              </TouchableOpacity>
              <TouchableOpacity
                testID={`delete-note-${note.id}`}
                style={styles.deleteBtn}
                onPress={() => handleDelete(note.id, note.title)}
                onLongPress={() => handleDelete(note.id, note.title)}
                activeOpacity={0.7}
              >
                <Feather name="trash-2" size={14} color={c.textTertiary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  section: { marginBottom: Spacing.l },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.s,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: c.textSecondary, letterSpacing: 0.8,
  },
  recBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: c.textPrimary, borderRadius: Radius.m,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  recBtnActive: { backgroundColor: '#FF3B30' },
  recBtnText: { ...Typography.footnote, fontWeight: '600', color: c.background },

  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s,
    backgroundColor: '#FFF5F5',
    borderRadius: Radius.m,
    paddingHorizontal: Spacing.m,
    paddingVertical: 10,
    marginBottom: Spacing.s,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  redDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30',
  },
  elapsed: { ...Typography.subhead, fontWeight: '700', color: '#FF3B30' },
  recordingLabel: { ...Typography.caption1, color: c.textSecondary },

  empty: {
    backgroundColor: c.surface, borderRadius: Radius.m,
    paddingVertical: Spacing.xl, alignItems: 'center', gap: Spacing.s,
  },
  emptyText: { ...Typography.subhead, color: c.textTertiary },

  list: { gap: Spacing.xs },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s,
    backgroundColor: c.surface,
    borderRadius: Radius.m,
    padding: Spacing.m,
  },
  noteInfo: { flex: 1 },
  noteLabel: { ...Typography.subhead, fontWeight: '500', color: c.textPrimary },
  noteMeta: { ...Typography.caption2, color: c.textTertiary, marginTop: 2 },
  noteDur: { ...Typography.caption1, color: c.textSecondary, minWidth: 32, textAlign: 'right' },
  renameInput: {
    ...Typography.subhead,
    color: c.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: c.textPrimary,
    paddingBottom: 2,
    paddingHorizontal: 0,
  },
  playBtn: {
    width: 28, height: 28,
    backgroundColor: c.textPrimary,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 28, height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
