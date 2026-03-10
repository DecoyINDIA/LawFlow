/**
 * Phase 23 — Voice Notes Screen (standalone /voice-notes route)
 * Migrated from expo-av → expo-audio (SDK 54 compatible)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Alert, ActivityIndicator, Platform,
  SafeAreaView,
} from 'react-native';
import {
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
  useAudioPlayerStatus,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  RecordingPresets,
} from 'expo-audio';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppContext } from '../src/context/AppContext';
import { useColors, Typography, Spacing, Radius } from '../src/theme';
import { VoiceNote } from '../src/types';
import { DriveSetupSheet } from '../src/components/common/DriveSetupSheet';
import {
  getStoredDriveToken,
  syncVoiceNoteToDrive,
} from '../src/services/googleDriveFiles';

function fmtDuration(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function VoiceNotesScreen() {
  const router = useRouter();
  const c = useColors();
  const {
    voiceNotes, addVoiceNote, deleteVoiceNote,
    isDriveConnected, connectDrive, updateVoiceNoteDriveSync,
  } = useAppContext();

  // ── Recorder ──────────────────────────────────────────────────────
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder, 500);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState('');

  // ── Player ────────────────────────────────────────────────────────
  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const prevPlayingRef = useRef(playerStatus.playing);

  useEffect(() => {
    if (prevPlayingRef.current && !playerStatus.playing && playingId !== null) {
      setPlayingId(null);
    }
    prevPlayingRef.current = playerStatus.playing;
  }, [playerStatus.playing]);

  // ── Drive sheet ───────────────────────────────────────────────────
  const [showDriveSheet, setShowDriveSheet] = useState(false);
  const [connectingDrive, setConnectingDrive] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // ── Record handlers ───────────────────────────────────────────────
  const handleRecord = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      if (!isDriveConnected) { setShowDriveSheet(true); return; }
      await startRecording();
    }
  };

  const startRecording = async () => {
    setRecordingError('');
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) { setRecordingError('Microphone permission denied'); return; }
      await setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
    } catch {
      setRecordingError('Could not start recording');
    }
  };

  const stopRecording = async () => {
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) { setIsRecording(false); return; }
      const now = Date.now();
      const durationSecs = Math.round((recState.durationMillis ?? 0) / 1000);
      const fileName = `VoiceNote_${new Date(now).toISOString().slice(0, 10)}.m4a`;
      const note: VoiceNote = {
        id: `vn_${now}`, caseId: undefined, caseName: undefined,
        title: fileName, uri,
        duration: durationSecs, createdAt: now, isSynced: false,
      };
      addVoiceNote(note);
      setIsRecording(false);
      uploadNote(note, uri, fileName);
    } catch {
      setIsRecording(false);
    }
  };

  const uploadNote = async (note: VoiceNote, uri: string, fileName: string) => {
    setUploadingId(note.id);
    try {
      const token = await getStoredDriveToken();
      if (!token) return;
      const result = await syncVoiceNoteToDrive(uri, fileName, 'General', undefined, token);
      updateVoiceNoteDriveSync(note.id, result.fileId, result.fileUrl);
    } catch {
      // saved locally
    } finally {
      setUploadingId(null);
    }
  };

  // ── Play ──────────────────────────────────────────────────────────
  const handlePlayPause = useCallback(async (note: VoiceNote) => {
    if (playingId === note.id) {
      player.pause(); setPlayingId(null); return;
    }
    if (playingId !== null) player.pause();
    player.replace({ uri: note.uri });
    await setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
    player.play();
    setPlayingId(note.id);
  }, [playingId, player]);

  const handleDelete = (note: VoiceNote) => {
    Alert.alert('Delete', 'Delete this voice note?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        if (playingId === note.id) { player.pause(); setPlayingId(null); }
        deleteVoiceNote(note.id);
      }},
    ]);
  };

  const handleConnectDrive = async () => {
    setConnectingDrive(true);
    const ok = await connectDrive();
    setConnectingDrive(false);
    if (ok) { setShowDriveSheet(false); await startRecording(); }
    else Alert.alert('Connection Failed', 'Could not connect to Google Drive.');
  };

  const styles = makeStyles(c);

  return (
    <SafeAreaView style={styles.safe} testID="voice-notes-screen">
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={22} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voice Notes</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Record button */}
      <View style={styles.recorderCard}>
        <TouchableOpacity
          testID={isRecording ? 'stop-recording-btn' : 'start-recording-btn'}
          style={[styles.bigRecordBtn, isRecording && styles.bigRecordBtnActive]}
          onPress={handleRecord}
          activeOpacity={0.8}
        >
          <Feather name={isRecording ? 'square' : 'mic'} size={28} color="#fff" />
          <Text style={styles.bigRecordBtnText}>
            {isRecording
              ? `Stop  ${fmtDuration((recState.durationMillis ?? 0) / 1000)}`
              : 'Start Recording'}
          </Text>
        </TouchableOpacity>
        {recordingError ? <Text style={styles.errorText}>{recordingError}</Text> : null}
        {!isDriveConnected && (
          <View style={styles.driveBanner}>
            <Feather name="alert-circle" size={14} color={c.textSecondary} />
            <Text style={styles.driveBannerText}>Connect Google Drive to save recordings safely</Text>
          </View>
        )}
      </View>

      {/* List */}
      <FlatList
        data={voiceNotes.filter(n => !n.caseId)}
        keyExtractor={n => n.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={(
          <View style={styles.empty}>
            <Feather name="mic-off" size={32} color={c.textSecondary} />
            <Text style={styles.emptyText}>No recordings yet</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.noteRow} testID={`voice-note-${item.id}`}>
            <TouchableOpacity style={styles.playBtn} onPress={() => handlePlayPause(item)}>
              <Feather name={playingId === item.id ? 'pause-circle' : 'play-circle'} size={36} color={c.textPrimary} />
            </TouchableOpacity>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.noteTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.noteMeta}>{fmtDuration(item.duration)} · {fmtDate(item.createdAt)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {uploadingId === item.id
                ? <ActivityIndicator size="small" color={c.textPrimary} />
                : item.isSynced
                  ? <Feather name="cloud" size={16} color="#4285F4" />
                  : <Feather name="smartphone" size={16} color={c.textSecondary} />}
              <TouchableOpacity onPress={() => handleDelete(item)} testID={`delete-voice-note-${item.id}`}>
                <Feather name="trash-2" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <DriveSetupSheet
        visible={showDriveSheet}
        connecting={connectingDrive}
        onConnect={handleConnectDrive}
        onDismiss={() => setShowDriveSheet(false)}
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.l, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  headerTitle: { ...Typography.headline, fontWeight: '700', color: c.textPrimary },
  recorderCard: {
    margin: Spacing.l, backgroundColor: c.surface,
    borderRadius: Radius.l, padding: Spacing.l,
    alignItems: 'center', gap: 12,
  },
  bigRecordBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: c.textPrimary, borderRadius: Radius.xl,
    paddingVertical: 16, paddingHorizontal: 32,
  },
  bigRecordBtnActive: { backgroundColor: c.textSecondary },
  bigRecordBtnText: { ...Typography.title3, fontWeight: '700', color: c.background },
  errorText: { ...Typography.caption1, color: '#EF4444' },
  driveBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: c.surfaceHighlight, borderRadius: Radius.s,
    paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'stretch',
    justifyContent: 'center',
  },
  driveBannerText: { ...Typography.caption1, color: c.textSecondary, flex: 1 },
  list: { paddingHorizontal: Spacing.l, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { ...Typography.subhead, color: c.textSecondary },
  noteRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: c.surface, borderRadius: Radius.m,
    padding: Spacing.m, marginBottom: Spacing.s,
  },
  playBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  noteTitle: { ...Typography.subhead, fontWeight: '600', color: c.textPrimary },
  noteMeta: { ...Typography.caption1, color: c.textSecondary },
});
