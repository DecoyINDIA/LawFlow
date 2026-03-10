/**
 * Phase 23 — VoiceNotesSection
 * Migrated from expo-av → expo-audio (SDK 54 compatible)
 * + Google Drive upload after recording
 * Module 8 fixes: paywall, rename, Platform.OS web guard on delete
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Alert, ActivityIndicator, Platform, TextInput, Modal,
  KeyboardAvoidingView,
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
import { useAppContext } from '../../context/AppContext';
import { useColors, Typography, Spacing, Radius } from '../../theme';
import { VoiceNote } from '../../types';
import { DriveSetupSheet } from './DriveSetupSheet';
import { PaywallSheet } from '../PaywallSheet';
import {
  getStoredDriveToken,
  syncVoiceNoteToDrive,
} from '../../services/googleDriveFiles';

interface Props {
  caseId: string;
  caseName: string;
  caseNumber?: string;
  clientName?: string;
}

function fmtDuration(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function VoiceNotesSection({ caseId, caseName, caseNumber = '', clientName }: Props) {
  const c = useColors();
  const {
    voiceNotes, addVoiceNote, updateVoiceNote, deleteVoiceNote,
    isDriveConnected, connectDrive, updateVoiceNoteDriveSync,
    isProUser,
  } = useAppContext();

  const caseNotes = voiceNotes.filter(n => n.caseId === caseId);

  // ── Recorder ──────────────────────────────────────────────────────
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder, 500);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState('');

  // ── Player (single shared player, replace source per note) ────────
  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const prevPlayingRef = useRef(playerStatus.playing);

  // Detect playback end
  useEffect(() => {
    if (prevPlayingRef.current && !playerStatus.playing && playingId !== null) {
      setPlayingId(null);
    }
    prevPlayingRef.current = playerStatus.playing;
  }, [playerStatus.playing]);

  // ── Drive sheet ───────────────────────────────────────────────────
  const [showDriveSheet, setShowDriveSheet] = useState(false);
  const [connectingDrive, setConnectingDrive] = useState(false);
  // pendingRecord: start recording after Drive sheet dismisses (Maybe Later)
  const [pendingRecord, setPendingRecord] = useState(false);

  // Start recording after Drive sheet is dismissed (state flag approach)
  useEffect(() => {
    if (!showDriveSheet && pendingRecord) {
      setPendingRecord(false);
      startRecordingInternal();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDriveSheet, pendingRecord]);

  // ── Upload state ──────────────────────────────────────────────────
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // ── Paywall ───────────────────────────────────────────────────────
  const [showPaywall, setShowPaywall] = useState(false);

  // ── Rename state ──────────────────────────────────────────────────
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  const handleRename = (note: VoiceNote) => {
    setRenamingId(note.id);
    setRenameText(note.title);
  };

  const handleRenameConfirm = () => {
    if (renamingId && renameText.trim()) {
      updateVoiceNote(renamingId, renameText.trim());
    }
    setRenamingId(null);
    setRenameText('');
  };

  const handleRenameCancel = () => {
    setRenamingId(null);
    setRenameText('');
  };

  // ── Start recording ───────────────────────────────────────────────
  const handleStartRecording = async () => {
    if (!isProUser) {
      setShowPaywall(true);
      return;
    }
    if (!isDriveConnected) {
      setPendingRecord(true);
      setShowDriveSheet(true);
      return;
    }
    await startRecordingInternal();
  };

  const startRecordingInternal = async () => {
    setRecordingError('');
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setRecordingError('Microphone permission denied');
        return;
      }
      await setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
    } catch (e: any) {
      setRecordingError('Could not start recording');
    }
  };

  // ── Stop recording + upload ───────────────────────────────────────
  const handleStopRecording = async () => {
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) { setIsRecording(false); return; }

      const now = Date.now();
      const durationSecs = Math.round((recState.durationMillis ?? 0) / 1000);
      const fileName = `VoiceNote_${new Date(now).toISOString().slice(0,10)}_${caseId.slice(-4)}.m4a`;

      const note: VoiceNote = {
        id: `vn_${now}`,
        caseId,
        caseName,
        title: fileName,
        uri,
        duration: durationSecs,
        createdAt: now,
        isSynced: false,
      };

      addVoiceNote(note);
      setIsRecording(false);

      // Upload to Drive in background
      uploadNoteToDrive(note, uri, fileName);
    } catch {
      setIsRecording(false);
    }
  };

  const uploadNoteToDrive = async (note: VoiceNote, uri: string, fileName: string) => {
    setUploadingId(note.id);
    try {
      const token = await getStoredDriveToken();
      if (!token) return;
      const result = await syncVoiceNoteToDrive(uri, fileName, caseNumber || caseId, clientName, token);
      updateVoiceNoteDriveSync(note.id, result.fileId, result.fileUrl);
    } catch {
      // Saved locally; user can retry manually
    } finally {
      setUploadingId(null);
    }
  };

  // ── Play / Pause ──────────────────────────────────────────────────
  const handlePlayPause = useCallback(async (note: VoiceNote) => {
    if (playingId === note.id) {
      player.pause();
      setPlayingId(null);
      return;
    }
    // Stop previous
    if (playingId !== null) player.pause();
    player.replace({ uri: note.uri });
    await setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
    player.play();
    setPlayingId(note.id);
  }, [playingId, player]);

  // ── Delete ────────────────────────────────────────────────────────
  const handleDelete = (note: VoiceNote) => {
    if (Platform.OS === 'web') {
      // Alert.alert multi-button is blocked in browser iframes — delete directly on web
      if (playingId === note.id) { player.pause(); setPlayingId(null); }
      deleteVoiceNote(note.id);
      return;
    }
    Alert.alert('Delete Voice Note', 'Delete this recording?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        if (playingId === note.id) { player.pause(); setPlayingId(null); }
        deleteVoiceNote(note.id);
      }},
    ]);
  };

  // ── Manual Drive sync ─────────────────────────────────────────────
  const handleManualSync = async (note: VoiceNote) => {
    if (!isDriveConnected) { setShowDriveSheet(true); return; }
    await uploadNoteToDrive(note, note.uri, note.title);
  };

  // ── Drive connect ─────────────────────────────────────────────────
  const handleConnectDrive = async () => {
    setConnectingDrive(true);
    const ok = await connectDrive();
    setConnectingDrive(false);
    if (ok) {
      setShowDriveSheet(false);
      setPendingRecord(false);
      // Start recording after connecting
      if (!isRecording) startRecordingInternal();
    } else {
      Alert.alert('Connection Failed', 'Could not connect to Google Drive. Please try again.');
    }
  };

  const styles = makeStyles(c);

  return (
    <View style={styles.container} testID="voice-notes-section">
      {/* Header + Record button */}
      <View style={styles.header}>
        <Text style={styles.title}>Voice Notes</Text>
        <TouchableOpacity
          testID={isRecording ? 'stop-recording-btn' : 'start-recording-btn'}
          style={[styles.recordBtn, isRecording && styles.recordBtnActive]}
          onPress={isRecording ? handleStopRecording : handleStartRecording}
          activeOpacity={0.8}
        >
          {!isProUser && !isRecording && (
            <Feather name="lock" size={13} color="#fff" />
          )}
          <Feather name={isRecording ? 'square' : 'mic'} size={16} color="#fff" />
          <Text style={styles.recordBtnText}>
            {isRecording
              ? `Stop  ${fmtDuration((recState.durationMillis ?? 0) / 1000)}`
              : 'Record'}
          </Text>
        </TouchableOpacity>
      </View>

      {recordingError ? (
        <Text style={styles.errorText}>{recordingError}</Text>
      ) : null}

      {/* Notes list */}
      {caseNotes.length === 0 ? (
        <View style={styles.empty} testID="voice-notes-empty">
          <Feather name="mic-off" size={24} color={c.textSecondary} />
          <Text style={styles.emptyText}>No voice notes yet</Text>
        </View>
      ) : (
        <FlatList
          data={caseNotes}
          keyExtractor={n => n.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <NoteRow
              note={item}
              isPlaying={playingId === item.id}
              isUploading={uploadingId === item.id}
              onPlayPause={() => handlePlayPause(item)}
              onDelete={() => handleDelete(item)}
              onSync={() => handleManualSync(item)}
              onRename={() => handleRename(item)}
              c={c}
              styles={styles}
            />
          )}
        />
      )}

      <DriveSetupSheet
        visible={showDriveSheet}
        connecting={connectingDrive}
        onConnect={handleConnectDrive}
        onDismiss={() => { setShowDriveSheet(false); }}
      />

      {/* Paywall */}
      <PaywallSheet
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        featureName="Voice Notes"
      />

      {/* Rename Modal */}
      <Modal
        visible={renamingId !== null}
        transparent
        animationType="fade"
        onRequestClose={handleRenameCancel}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.renameOverlay}
            activeOpacity={1}
            onPress={handleRenameCancel}
          >
            <View style={styles.renameSheet}>
              <Text style={styles.renameTitle}>Rename Voice Note</Text>
              <TextInput
                testID="rename-voice-note-input"
                style={styles.renameInput}
                value={renameText}
                onChangeText={setRenameText}
                autoFocus
                selectTextOnFocus
                returnKeyType="done"
                onSubmitEditing={handleRenameConfirm}
                placeholderTextColor={c.textTertiary}
              />
              <View style={styles.renameActions}>
                <TouchableOpacity
                  testID="rename-cancel-btn"
                  style={styles.renameCancelBtn}
                  onPress={handleRenameCancel}
                >
                  <Text style={styles.renameCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="rename-confirm-btn"
                  style={styles.renameConfirmBtn}
                  onPress={handleRenameConfirm}
                >
                  <Text style={styles.renameConfirmText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Note row ───────────────────────────────────────────────────────────────
interface NoteRowProps {
  note: VoiceNote;
  isPlaying: boolean;
  isUploading: boolean;
  onPlayPause: () => void;
  onDelete: () => void;
  onSync: () => void;
  onRename: () => void;
  c: any;
  styles: any;
}
function NoteRow({ note, isPlaying, isUploading, onPlayPause, onDelete, onSync, onRename, c, styles }: NoteRowProps) {
  return (
    <View style={styles.noteRow} testID={`voice-note-${note.id}`}>
      {/* Play button */}
      <TouchableOpacity style={styles.playBtn} onPress={onPlayPause} activeOpacity={0.7} testID={`play-voice-note-${note.id}`}>
        <Feather name={isPlaying ? 'pause-circle' : 'play-circle'} size={32} color={c.textPrimary} />
      </TouchableOpacity>

      {/* Info */}
      <View style={styles.noteInfo}>
        <Text style={styles.noteTitle} numberOfLines={1}>{note.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.noteMeta}>{fmtDuration(note.duration)}</Text>
          <Text style={styles.noteDot}>·</Text>
          <Text style={styles.noteMeta}>{fmtDate(note.createdAt)}</Text>
        </View>
      </View>

      {/* Sync status */}
      <View style={styles.noteActions}>
        {isUploading ? (
          <ActivityIndicator size="small" color={c.textPrimary} />
        ) : note.isSynced ? (
          <Feather name="cloud" size={14} color="#4285F4" />
        ) : (
          <TouchableOpacity onPress={onSync} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="smartphone" size={14} color={c.textSecondary} />
          </TouchableOpacity>
        )}
        {/* Rename button */}
        <TouchableOpacity
          testID={`rename-voice-note-btn-${note.id}`}
          onPress={onRename}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="edit-2" size={14} color={c.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          testID={`delete-voice-note-${note.id}`}
          onPress={onDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="trash-2" size={16} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const makeStyles = (c: any) => StyleSheet.create({
  container: { marginTop: Spacing.l },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: Spacing.m,
  },
  title: { ...Typography.headline, fontWeight: '700', color: c.textPrimary },
  recordBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: c.textPrimary, borderRadius: Radius.m,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  recordBtnActive: { backgroundColor: c.textSecondary },
  recordBtnText: { ...Typography.subhead, fontWeight: '600', color: c.background },
  errorText: { ...Typography.caption1, color: '#EF4444', marginBottom: 8 },
  empty: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { ...Typography.subhead, color: c.textSecondary },
  noteRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: c.surface, borderRadius: Radius.m,
    padding: Spacing.m, marginBottom: Spacing.s, gap: 10,
  },
  playBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  noteInfo: { flex: 1, gap: 2 },
  noteTitle: { ...Typography.subhead, fontWeight: '600', color: c.textPrimary },
  noteMeta: { ...Typography.caption1, color: c.textSecondary },
  noteDot: { ...Typography.caption1, color: c.textSecondary },
  noteActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // Rename modal
  renameOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: Spacing.l,
  },
  renameSheet: {
    backgroundColor: c.background, borderRadius: Radius.l,
    padding: Spacing.l, width: '100%',
  },
  renameTitle: { ...Typography.headline, fontWeight: '700', color: c.textPrimary, marginBottom: Spacing.m },
  renameInput: {
    ...Typography.body, color: c.textPrimary,
    backgroundColor: c.surface, borderRadius: Radius.m,
    borderWidth: 1, borderColor: c.border,
    paddingHorizontal: Spacing.m, paddingVertical: 10,
    marginBottom: Spacing.m,
  },
  renameActions: { flexDirection: 'row', gap: Spacing.s },
  renameCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: Radius.m,
    backgroundColor: c.surface, alignItems: 'center',
  },
  renameCancelText: { ...Typography.subhead, color: c.textSecondary },
  renameConfirmBtn: {
    flex: 1, paddingVertical: 12, borderRadius: Radius.m,
    backgroundColor: c.textPrimary, alignItems: 'center',
  },
  renameConfirmText: { ...Typography.subhead, fontWeight: '600', color: c.background },
});
