import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Platform, Modal, TextInput, KeyboardAvoidingView, ActivityIndicator,
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../../src/theme';
import { useApp } from '../../src/context/AppContext';
import { StatusBadge } from '../../src/components/common/StatusBadge';
import { NotifyClientPopup, generateCaseUpdateMessage } from '../../src/components/common/NotifyClientPopup';
import { AddHearingModal } from '../../src/components/common/AddHearingModal';
import { RecordOutcomeModal } from '../../src/components/common/RecordOutcomeModal';
import { Hearing, Case } from '../../src/types';
import { printCaseReport } from '../../src/utils/pdfReports';
import {
  MESSAGE_TEMPLATES, TemplateKey, applyTemplate,
} from '../../src/utils/messageTemplates';
import {
  buildHearingReminderMessage, buildOutcomeMessage,
  UPDATE_TEMPLATES, UpdateTemplateKey,
} from '../../src/utils/whatsappTemplates';
import { VoiceNotesSection } from '../../src/components/common/VoiceNotesSection';
import { CaseTimeline } from '../../src/components/common/CaseTimeline';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Linking } from 'react-native';
import { ecourtsLookup } from '../../src/services/api';

const ECOURTS_PENDING_KEY = 'lawflow_ecourts_pending';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(ts?: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.getDate().toString().padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtDateTime(ts?: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes();
  return `${fmtDate(ts)} at ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export default function CaseDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const {
    getCaseById, deleteCase, getClientById,
    getHearingsByCaseId, getVoiceNotesByCaseId, getDocumentsByCaseId,
    addHearing, updateHearing, updateCase,
    addDocument, deleteDocument,
    sendWhatsAppMessage, sendSMSMessage, advocateName
  } = useApp();

  const caseData = getCaseById(id as string);
  const client = caseData?.clientId ? getClientById(caseData.clientId) : null;
  const hearings = caseData ? getHearingsByCaseId(caseData.id) : [];
  const documents = caseData ? getDocumentsByCaseId(caseData.id) : [];
  const voiceNotes = caseData ? getVoiceNotesByCaseId(caseData.id) : [];

  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  // Sort hearings chronologically (most recent first)
  const sortedHearings = useMemo(() =>
    [...hearings].sort((a, b) => b.hearingDate - a.hearingDate), [hearings]);

  // Feature 1: Detect hearing today or tomorrow for reminder banner
  const { reminderHearing, isReminderTomorrow } = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(); tomorrowStart.setDate(tomorrowStart.getDate() + 1); tomorrowStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrowStart); tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    const t0 = todayStart.getTime(); const t1 = tomorrowStart.getTime(); const t2 = tomorrowEnd.getTime();
    const hToday = hearings.find(h => !h.outcome && h.hearingDate >= t0 && h.hearingDate < t1);
    const hTomorrow = hearings.find(h => !h.outcome && h.hearingDate >= t1 && h.hearingDate < t2);
    return { reminderHearing: hTomorrow || hToday, isReminderTomorrow: Boolean(hTomorrow) };
  }, [hearings]);

  // Notification popup state (after updates)
  const [showNotify, setShowNotify] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifyTitle, setNotifyTitle] = useState('Notify Client?');

  // Print state
  const [printing, setPrinting] = useState(false);
  // Document picker sheet state (cross-platform: Alert is no-op on web)
  const [showDocSheet, setShowDocSheet] = useState(false);

  // Hearing modals state
  const [showAddHearingModal, setShowAddHearingModal] = useState(false);
  const [editHearing, setEditHearing] = useState<Hearing | null>(null);
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [outcomeHearing, setOutcomeHearing] = useState<Hearing | null>(null);

  // Message composer state (always available)
  const [showComposer, setShowComposer] = useState(false);
  const [composerMessage, setComposerMessage] = useState('');
  const [composerTemplate, setComposerTemplate] = useState<TemplateKey>('hearing_reminder');

  // ── eCourts state ──────────────────────────────────────────────────────
  const [showEcourtsModal, setShowEcourtsModal] = useState(false);
  const [ecourtsInput, setEcourtsInput] = useState('');
  const [ecourtsLoading, setEcourtsLoading] = useState(false);
  const [ecourtsCourtType, setEcourtsCourtType] = useState<'district' | 'high_court'>('district');
  const [ecourtsHcCode, setEcourtsHcCode] = useState('bombay');

  // ── WhatsApp update sheet state (Feature 3) ────────────────────────────
  const [showUpdateSheet, setShowUpdateSheet] = useState(false);
  const [updateTemplateKey, setUpdateTemplateKey] = useState<UpdateTemplateKey>('general_update');
  const [updateSheetMessage, setUpdateSheetMessage] = useState('');

  if (!caseData) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Feather name="alert-circle" size={48} color={c.textTertiary} />
          <Text style={styles.notFoundText}>Case not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleDelete = () => {
    Alert.alert('Delete Case', `Are you sure you want to delete case ${caseData.caseNumber}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteCase(caseData.id); router.back(); } },
    ]);
  };

  const handleEditCase = () => {
    router.push({ pathname: '/cases/new', params: { caseId: caseData.id } });
  };

  const handlePrint = async () => {
    setPrinting(true);
    await printCaseReport({
      case: caseData,
      client,
      hearings,
    });
    setPrinting(false);
  };

  const handleAddHearing = () => {
    setEditHearing(null);
    setShowAddHearingModal(true);
  };

  // ── eCourts handlers ───────────────────────────────────────────────────
  const handleOpenEcourts = () => {
    setEcourtsInput(caseData?.caseNumber || '');
    setShowEcourtsModal(true);
  };

  const handleFetchEcourts = async () => {
    const input = ecourtsInput.trim();
    if (!input) {
      Alert.alert('Input Required', 'Please enter a CNR number or case number.');
      return;
    }
    setEcourtsLoading(true);
    try {
      // Determine if input looks like a CNR (16 chars, alphanumeric)
      const isCnr = /^[A-Z0-9]{14,18}$/.test(input.toUpperCase().replace(/[\s-]/g, ''));
      const payload: Record<string, unknown> = isCnr
        ? { cnr_number: input.toUpperCase().replace(/[\s-]/g, '') }
        : { case_number: input };

      if (ecourtsCourtType === 'high_court') {
        payload.court_type = 'high_court';
        payload.high_court_code = ecourtsHcCode;
      }

      const response = await ecourtsLookup(payload as any);
      const ecourtsData = response?.data;

      // Store result in AsyncStorage for the review screen
      await AsyncStorage.setItem('lawflow_ecourts_pending', JSON.stringify(ecourtsData || {
        found: false,
        source: 'unavailable',
        error: 'Could not connect to eCourts. Please enter details manually.',
        fetchedFields: [],
      }));

      setShowEcourtsModal(false);
      setEcourtsInput('');

      // Navigate to review screen
      router.push({ pathname: '/ecourts-review', params: { caseId: caseData.id } });
    } catch (err: any) {
      // Even on total failure, store empty data and go to review screen
      await AsyncStorage.setItem('lawflow_ecourts_pending', JSON.stringify({
        found: false,
        source: 'unavailable',
        error: 'eCourts portal is currently unreachable. Please enter hearing details manually.',
        fetchedFields: [],
      }));
      setShowEcourtsModal(false);
      router.push({ pathname: '/ecourts-review', params: { caseId: caseData.id } });
    } finally {
      setEcourtsLoading(false);
    }
  };

  const handleSaveHearing = (data: {
    hearingDate: number;
    hearingTime?: string;
    courtName: string;
    purpose?: string;
    notes?: string;
  }) => {
    if (editHearing) {
      updateHearing(editHearing.id, {
        hearingDate: data.hearingDate,
        hearingTime: data.hearingTime,
        courtRoom: data.courtName,
        purpose: data.purpose,
        notes: data.notes,
      });
    } else {
      const newHearing = addHearing({
        caseId: caseData.id,
        hearingDate: data.hearingDate,
        hearingTime: data.hearingTime,
        courtRoom: data.courtName,
        purpose: data.purpose,
        notes: data.notes,
        clientNotified: false,
      });
      const shouldUpdateDate = !caseData.nextHearingDate || data.hearingDate < caseData.nextHearingDate;
      if (shouldUpdateDate) updateCase(caseData.id, { nextHearingDate: newHearing.hearingDate });
      if (client) {
        const updatedCase = { ...caseData, nextHearingDate: newHearing.hearingDate };
        setNotifyTitle('Notify Client about New Hearing?');
        setNotifyMessage(generateCaseUpdateMessage(updatedCase, client.name, advocateName, 'hearing_added'));
        setShowNotify(true);
      }
    }
  };

  const handleRecordOutcome = (hearing: Hearing) => {
    setOutcomeHearing(hearing);
    setShowOutcomeModal(true);
  };

  const handleSaveOutcome = (data: {
    outcome: string;
    nextDate?: number;
    notes?: string;
    shouldUpdateCaseStatus?: boolean;
  }) => {
    if (!outcomeHearing) return;
    updateHearing(outcomeHearing.id, {
      outcome: data.outcome as any,
      notes: data.notes,
      ...(data.nextDate ? { nextDateSet: data.nextDate } : {}),
    });
    const caseUpdates: Partial<Case> = {};
    if (data.shouldUpdateCaseStatus) caseUpdates.status = 'DISPOSED';
    if (data.nextDate) caseUpdates.nextHearingDate = data.nextDate;
    if (Object.keys(caseUpdates).length > 0) updateCase(caseData.id, caseUpdates);
    if (client) {
      const outcomeMsg = buildOutcomeMessage({
        clientName: client.name,
        caseNumber: caseData.caseNumber,
        courtName: caseData.courtName,
        outcome: data.outcome,
        nextDate: data.nextDate,
        advocateName,
      });
      setNotifyTitle('Notify Client about Outcome?');
      setNotifyMessage(outcomeMsg);
      setShowNotify(true);
    }
  };

  const handleCallClient = () => {
    if (client?.phone) {
      const url = `tel:${client.phone}`;
      Alert.alert('Call Client', `Call ${client.name}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call', onPress: () => require('react-native').Linking.openURL(url) },
      ]);
    }
  };

  // Open message composer
  const handleOpenComposer = () => {
    if (!client) {
      Alert.alert('No Client', 'Please add a client to this case first.');
      return;
    }
    const ctx = {
      clientName: client.name,
      caseNumber: caseData.caseNumber,
      courtName: caseData.courtName,
      nextHearingDate: caseData.nextHearingDate,
      advocateName,
    };
    const defaultKey: TemplateKey = 'hearing_reminder';
    setComposerTemplate(defaultKey);
    setComposerMessage(applyTemplate(defaultKey, ctx));
    setShowComposer(true);
  };

  const handleSelectTemplate = (key: TemplateKey) => {
    setComposerTemplate(key);
    if (!client) return;
    if (key === 'custom') {
      setComposerMessage('');
    } else {
      setComposerMessage(applyTemplate(key, {
        clientName: client.name,
        caseNumber: caseData.caseNumber,
        courtName: caseData.courtName,
        nextHearingDate: caseData.nextHearingDate,
        advocateName,
      }));
    }
  };

  const handleSendFromComposer = (method: 'whatsapp' | 'sms') => {
    if (!client) return;
    if (method === 'whatsapp') {
      sendWhatsAppMessage(client.phone, composerMessage);
    } else {
      sendSMSMessage(client.phone, composerMessage);
    }
    setShowComposer(false);
  };

  // ── Feature 1: Send WhatsApp Hearing Reminder ──────────────────────────
  const handleSendHearingReminder = () => {
    if (!client) {
      Alert.alert('No Client', 'Please link a client to this case first.');
      return;
    }
    if (!client.phone) {
      Alert.alert(
        'Phone Number Missing',
        `${client.name} has no phone number. Add it to send WhatsApp reminders.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Edit Client', onPress: () => router.push(`/clients/${client.id}` as any) },
        ]
      );
      return;
    }
    const msg = buildHearingReminderMessage({
      clientName: client.name,
      caseNumber: caseData.caseNumber,
      courtName: caseData.courtName,
      isTomorrow: isReminderTomorrow,
      advocateName,
    });
    sendWhatsAppMessage(client.phone, msg);
  };

  // ── Feature 3: Open Send Update bottom sheet ───────────────────────────
  const handleOpenUpdateSheet = () => {
    if (!client) {
      Alert.alert('No Client', 'Please link a client to this case first.');
      return;
    }
    const firstTemplate = UPDATE_TEMPLATES[0];
    setUpdateTemplateKey(firstTemplate.key);
    setUpdateSheetMessage(firstTemplate.build({
      clientName: client.name,
      caseNumber: caseData.caseNumber,
      courtName: caseData.courtName,
      nextHearingDate: caseData.nextHearingDate,
      advocateName,
    }));
    setShowUpdateSheet(true);
  };

  // ── Document handlers ──────────────────────────────────────────────
  const handleAddDocument = () => {
    setShowDocSheet(true);
  };

  const pickDocument = async (idx: number) => {
    if (idx === 0) {
      // Camera
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera access is needed to take photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const name = asset.fileName ?? `Photo_${Date.now()}.jpg`;
        addDocument({ caseId: caseData.id, caseName: caseData.title, fileName: name.length > 30 ? name.slice(0, 27) + '...' : name, fileType: 'IMAGE', fileSize: '—', uploadStatus: 'LOCAL_ONLY', uri: asset.uri });
      }
    } else if (idx === 1) {
      // Photo Library
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Photo library access is needed.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const name = asset.fileName ?? `Image_${Date.now()}.jpg`;
        addDocument({ caseId: caseData.id, caseName: caseData.title, fileName: name.length > 30 ? name.slice(0, 27) + '...' : name, fileType: 'IMAGE', fileSize: '—', uploadStatus: 'LOCAL_ONLY', uri: asset.uri });
      }
    } else if (idx === 2) {
      // Document/PDF picker
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '*/*'],
          copyToCacheDirectory: true,
        });
        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          const name = asset.name ?? `Document_${Date.now()}.pdf`;
          const ext = name.split('.').pop()?.toUpperCase() ?? 'PDF';
          const fileType = ext === 'PDF' ? 'PDF' : ext === 'DOCX' || ext === 'DOC' ? 'WORD' : ext === 'XLSX' || ext === 'XLS' ? 'EXCEL' : 'OTHER';
          const sizeKb = asset.size ? Math.round(asset.size / 1024) : null;
          const sizeStr = sizeKb ? (sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`) : '—';
          addDocument({ caseId: caseData.id, caseName: caseData.title, fileName: name.length > 30 ? name.slice(0, 27) + '...' : name, fileType: fileType as any, fileSize: sizeStr, uploadStatus: 'LOCAL_ONLY', uri: asset.uri });
        }
      } catch {
        Alert.alert('Error', 'Could not open document picker.');
      }
    }
  };

  const handleOpenDocument = async (doc: { fileName: string; uri?: string }) => {
    if (!doc.uri) {
      Alert.alert('Not Available', 'This document is not available for preview.');
      return;
    }
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(doc.uri);
      } else {
        await Linking.openURL(doc.uri);
      }
    } catch {
      Alert.alert('Error', 'Could not open the document.');
    }
  };

  const handleDeleteDocument = (docId: string, fileName: string) => {
    if (Platform.OS === 'web') {
      // Alert.alert is a no-op on web, use window.confirm
      const confirmed = (globalThis as any).confirm?.(`Remove "${fileName}" from this case?`);
      if (confirmed) deleteDocument(docId);
    } else {
      Alert.alert(
        'Delete Document',
        `Remove "${fileName}" from this case?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => deleteDocument(docId) },
        ],
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={22} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Case Details</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            testID="print-case-btn"
            onPress={handlePrint}
            disabled={printing}
            style={styles.headerIconBtn}
          >
            {printing
              ? <ActivityIndicator size="small" color={c.textPrimary} />
              : <Feather name="printer" size={18} color={c.textPrimary} />
            }
          </TouchableOpacity>
          <TouchableOpacity onPress={handleEditCase} style={styles.editBtn} testID="edit-case-btn">
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Case Header Card */}
        <View style={styles.caseHeader}>
          <View style={styles.caseHeaderTop}>
            <Text style={styles.caseNumber}>{caseData.caseNumber}</Text>
            <StatusBadge status={caseData.status} />
          </View>
          <Text style={styles.caseTitle}>{caseData.title}</Text>
          <View style={styles.courtRow}>
            <Feather name="map-pin" size={13} color={c.textSecondary} />
            <Text style={styles.courtText}>{caseData.courtName}, {caseData.courtCity}</Text>
          </View>
          <View style={styles.datesRow}>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>REGISTERED</Text>
              <Text style={styles.dateValue}>{fmtDate(caseData.registrationDate || caseData.filingDate)}</Text>
            </View>
            <View style={styles.dateDivider} />
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>NEXT DATE</Text>
              <Text style={[styles.dateValue, !caseData.nextHearingDate && styles.awaitingDate]}>
                {caseData.nextHearingDate ? fmtDate(caseData.nextHearingDate) : 'Awaiting'}
              </Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Type</Text>
              <Text style={styles.metaValue}>{caseData.caseType}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Priority</Text>
              <Text style={styles.metaValue}>{caseData.priority}</Text>
            </View>
          </View>
        </View>

        {/* Plaintiff/Petitioner Card */}
        {client && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PLAINTIFF / PETITIONER</Text>
            <View style={styles.clientCard}>
              <View style={styles.clientLeft}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {client.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                  </Text>
                </View>
                <View style={styles.clientInfo}>
                  <Text style={styles.clientName}>{client.name}</Text>
                  <Text style={styles.clientSub}>{caseData.plaintiffType ?? client.clientType} · {client.phone}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleCallClient} style={styles.callBtn}>
                <Feather name="phone" size={18} color={c.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Permanent Contact Buttons */}
            <View style={styles.contactButtons}>
              <TouchableOpacity
                style={styles.smsButton}
                onPress={handleOpenComposer}
                activeOpacity={0.8}
                testID="client-text-btn"
              >
                <Text style={styles.smsButtonIcon}>📱</Text>
                <Text style={styles.smsButtonText}>Text</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.whatsappButton}
                onPress={handleOpenComposer}
                activeOpacity={0.8}
                testID="client-whatsapp-btn"
              >
                <Text style={styles.whatsappButtonIcon}>💬</Text>
                <Text style={styles.whatsappButtonText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>

            {/* Feature 3: Send Update button */}
            <TouchableOpacity
              testID="send-update-btn"
              style={styles.sendUpdateBtn}
              onPress={handleOpenUpdateSheet}
              activeOpacity={0.8}
            >
              <Text style={styles.sendUpdateIcon}>📤</Text>
              <Text style={styles.sendUpdateText}>Send Update</Text>
            </TouchableOpacity>

            {/* Feature 1: Hearing Reminder Banner — today / tomorrow */}
            {reminderHearing && (
              <TouchableOpacity
                testID="hearing-reminder-banner"
                style={styles.reminderBanner}
                onPress={handleSendHearingReminder}
                activeOpacity={0.85}
              >
                <View style={styles.reminderBannerLeft}>
                  <Text style={styles.reminderBannerEmoji}>📅</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reminderBannerTitle}>
                      Hearing {isReminderTomorrow ? 'Tomorrow' : 'Today'} — {caseData.courtName}
                    </Text>
                    <Text style={styles.reminderBannerSub} numberOfLines={1}>
                      Tap to send WhatsApp reminder to {client?.name ?? 'client'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.reminderBannerArrow}>›</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Additional Plaintiff/Petitioner info from form */}
        {caseData.plaintiffPetitioner && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PETITIONER DETAILS</Text>
            <View style={styles.partiesCard}>
              <View style={styles.partyItem}>
                <Text style={styles.partyLabel}>Name</Text>
                <Text style={styles.partyValue}>{caseData.plaintiffPetitioner}</Text>
              </View>
              {caseData.plaintiffType && (
                <View style={[styles.partyItem, styles.partyItemBorder]}>
                  <Text style={styles.partyLabel}>Type</Text>
                  <Text style={styles.partyValue}>{caseData.plaintiffType}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Defendant Section */}
        {caseData.defendant && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DEFENDANT</Text>
            <View style={styles.partiesCard}>
              <View style={styles.partyItem}>
                <Text style={styles.partyLabel}>Name</Text>
                <Text style={styles.partyValue}>{caseData.defendant}</Text>
              </View>
              {caseData.defendantType && (
                <View style={[styles.partyItem, styles.partyItemBorder]}>
                  <Text style={styles.partyLabel}>Type</Text>
                  <Text style={styles.partyValue}>{caseData.defendantType}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Hearing History */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>HEARING HISTORY ({sortedHearings.length})</Text>
            <View style={styles.hearingActions}>
              <TouchableOpacity
                testID="fetch-ecourts-btn"
                onPress={handleOpenEcourts}
                style={styles.ecourtsBtn}
                activeOpacity={0.8}
              >
                <Feather name="globe" size={13} color="#1A73E8" />
                <Text style={styles.ecourtsBoxText}>eCourts</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddHearing} style={styles.addBtn} testID="add-hearing-btn">
                <Feather name="plus" size={16} color={c.background} />
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
          {sortedHearings.length === 0 ? (
            <View style={styles.emptyCard}>
              <Feather name="calendar" size={24} color={c.textTertiary} />
              <Text style={styles.emptyText}>No hearings recorded</Text>
            </View>
          ) : (
            <View style={styles.hearingsList}>
              {sortedHearings.map((h, idx) => (
                <View key={h.id} style={styles.hearingItem}>
                  <View style={styles.hearingTimeline}>
                    <View style={[styles.hearingDot, h.outcome && styles.hearingDotComplete]} />
                    {idx < sortedHearings.length - 1 && <View style={styles.hearingLine} />}
                  </View>
                  <View style={styles.hearingContent}>
                    <View style={styles.hearingTop}>
                      <Text style={styles.hearingDate}>{fmtDateTime(h.hearingDate)}</Text>
                      {h.hearingTime && <Text style={styles.hearingType}>{h.hearingTime}</Text>}
                    </View>
                    {h.purpose && <Text style={styles.hearingPurpose}>{h.purpose}</Text>}
                    {h.outcome ? (
                      <View style={styles.outcomeBox}>
                        <Feather name="check-circle" size={12} color={c.textSecondary} />
                        <Text style={styles.outcomeText}>{h.outcome}</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.recordOutcomeBtn}
                        onPress={() => handleRecordOutcome(h)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.recordOutcomeText}>Record Outcome</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Timeline */}
        <CaseTimeline
          caseData={caseData}
          hearings={hearings}
          documents={documents}
          voiceNotes={voiceNotes}
        />

        {/* Documents */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>DOCUMENTS ({documents.length})</Text>
            <TouchableOpacity
              style={styles.addBtn}
              testID="add-doc-btn"
              onPress={handleAddDocument}
            >
              <Feather name="plus" size={16} color={c.background} />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          {documents.length === 0 ? (
            <View style={styles.emptyCard}>
              <Feather name="file-text" size={24} color={c.textTertiary} />
              <Text style={styles.emptyText}>No documents attached</Text>
            </View>
          ) : (
            <View style={styles.docsList}>
              {documents.map(doc => (
                <TouchableOpacity
                  key={doc.id}
                  style={styles.docItem}
                  activeOpacity={0.7}
                  onPress={() => handleOpenDocument(doc)}
                  onLongPress={() => handleDeleteDocument(doc.id, doc.fileName)}
                  testID={`doc-item-${doc.id}`}
                >
                  <View style={styles.docIconWrap}>
                    <Feather
                      name={doc.fileType === 'IMAGE' ? 'image' : 'file-text'}
                      size={18}
                      color={c.textPrimary}
                    />
                  </View>
                  <View style={styles.docInfo}>
                    <Text style={styles.docName} numberOfLines={1}>{doc.fileName}</Text>
                    <Text style={styles.docMeta}>
                      {doc.fileType} · {doc.fileSize} · {fmtDate(doc.createdAt)}
                    </Text>
                  </View>
                  <Feather name="more-vertical" size={16} color={c.textTertiary} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Voice Notes */}
        <VoiceNotesSection caseId={caseData.id} caseName={caseData.title} />

        {/* Notes */}
        {caseData.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>NOTES & REMARKS</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{caseData.notes}</Text>
            </View>
          </View>
        )}

        {/* Delete Button */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Feather name="trash-2" size={16} color={c.textSecondary} />
          <Text style={styles.deleteBtnText}>Delete Case</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Feature 3: Send Update Bottom Sheet */}
      <Modal visible={showUpdateSheet} transparent animationType="slide" statusBarTranslucent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity
            style={styles.composerBackdrop}
            onPress={() => setShowUpdateSheet(false)}
            activeOpacity={1}
          >
            <View style={styles.composerSheet}>
              <View style={styles.composerHandle} />
              <Text style={styles.composerTitle}>Send Update to {client?.name ?? 'Client'}</Text>

              {/* Template selector chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.m }}>
                <View style={{ flexDirection: 'row', gap: Spacing.s, paddingRight: Spacing.m }}>
                  {UPDATE_TEMPLATES.map(t => (
                    <TouchableOpacity
                      key={t.key}
                      testID={`update-template-${t.key}`}
                      style={[styles.templateChip, updateTemplateKey === t.key && styles.templateChipActive]}
                      onPress={() => {
                        setUpdateTemplateKey(t.key);
                        if (client) {
                          setUpdateSheetMessage(t.build({
                            clientName: client.name,
                            caseNumber: caseData.caseNumber,
                            courtName: caseData.courtName,
                            nextHearingDate: caseData.nextHearingDate,
                            advocateName,
                          }));
                        }
                      }}
                    >
                      <Text style={[styles.templateChipText, updateTemplateKey === t.key && styles.templateChipTextActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Editable message */}
              <View style={{ marginBottom: Spacing.m }}>
                <Text style={styles.composerLabel}>MESSAGE</Text>
                <TextInput
                  testID="update-sheet-message-input"
                  style={styles.composerTextInput}
                  value={updateSheetMessage}
                  onChangeText={setUpdateSheetMessage}
                  multiline
                  textAlignVertical="top"
                  placeholder="Your message..."
                  placeholderTextColor={c.textTertiary}
                />
              </View>

              {/* Actions */}
              <View style={{ gap: Spacing.s }}>
                {!client?.phone ? (
                  <View style={styles.noPhoneRow}>
                    <Text style={styles.noPhoneText}>Add client phone number first</Text>
                    <TouchableOpacity onPress={() => { setShowUpdateSheet(false); if (client) router.push(`/clients/${client.id}` as any); }}>
                      <Text style={styles.noPhoneLink}>Edit Client →</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    testID="update-sheet-whatsapp-btn"
                    style={styles.whatsappSendBtn}
                    onPress={() => {
                      if (client?.phone) {
                        sendWhatsAppMessage(client.phone, updateSheetMessage);
                        setShowUpdateSheet(false);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.whatsappSendIcon}>💬</Text>
                    <Text style={styles.whatsappSendText}>Send via WhatsApp</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.composerCancelBtn}
                  onPress={() => setShowUpdateSheet(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.composerCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Update Notification Popup */}
      <NotifyClientPopup
        visible={showNotify}
        onClose={() => setShowNotify(false)}
        client={client}
        caseData={caseData}
        advocateName={advocateName}
        message={notifyMessage}
        title={notifyTitle}
        onSendWhatsApp={sendWhatsAppMessage}
        onSendSMS={sendSMSMessage}
      />

      {/* Message Composer Bottom Sheet */}
      <Modal visible={showComposer} transparent animationType="slide" statusBarTranslucent>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.composerBackdrop}
            onPress={() => setShowComposer(false)}
            activeOpacity={1}
          >
            <View style={styles.composerSheet}>
              <View style={styles.composerHandle} />
              <Text style={styles.composerTitle}>Message {client?.name}</Text>

              {/* Template chips */}
              <Text style={styles.templateLabel}>TEMPLATES</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.templateScroll}
                contentContainerStyle={styles.templateChips}
              >
                {MESSAGE_TEMPLATES.map(tpl => (
                  <TouchableOpacity
                    key={tpl.key}
                    testID={`template-chip-${tpl.key}`}
                    style={[
                      styles.templateChip,
                      composerTemplate === tpl.key && styles.templateChipSelected,
                    ]}
                    onPress={() => handleSelectTemplate(tpl.key)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.templateChipText,
                        composerTemplate === tpl.key && styles.templateChipTextSelected,
                      ]}
                    >
                      {tpl.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.composerBox}>
                <Text style={styles.composerLabel}>MESSAGE</Text>
                <TextInput
                  style={styles.composerInput}
                  value={composerMessage}
                  onChangeText={setComposerMessage}
                  multiline
                  textAlignVertical="top"
                  placeholder="Type your message..."
                  placeholderTextColor={c.textTertiary}
                />
              </View>

              <View style={styles.composerActions}>
                <TouchableOpacity
                  style={styles.composerWhatsapp}
                  onPress={() => handleSendFromComposer('whatsapp')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.composerBtnIcon}>💬</Text>
                  <Text style={styles.composerWhatsappText}>Send via WhatsApp</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.composerSms}
                  onPress={() => handleSendFromComposer('sms')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.composerBtnIcon}>📱</Text>
                  <Text style={styles.composerSmsText}>Send via SMS</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.composerCancel}
                  onPress={() => setShowComposer(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.composerCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
      {/* Add / Edit Hearing Modal */}
      <AddHearingModal
        visible={showAddHearingModal}
        onClose={() => { setShowAddHearingModal(false); setEditHearing(null); }}
        onSave={handleSaveHearing}
        courtName={caseData.courtName}
        existingHearing={editHearing ?? undefined}
      />

      {/* eCourts CNR Input Modal */}
      <Modal
        visible={showEcourtsModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => !ecourtsLoading && setShowEcourtsModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.composerBackdrop}
            onPress={() => !ecourtsLoading && setShowEcourtsModal(false)}
            activeOpacity={1}
          >
            <View style={[styles.composerSheet, { paddingBottom: Platform.OS === 'ios' ? 40 : 24 }]}>
              <View style={styles.composerHandle} />

              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.s, marginBottom: Spacing.s }}>
                <Feather name="globe" size={20} color="#1A73E8" />
                <Text style={[styles.composerTitle, { marginBottom: 0 }]}>Fetch from eCourts</Text>
              </View>
              <Text style={{ ...Typography.footnote, color: c.textSecondary, marginBottom: Spacing.l }}>
                Enter the CNR number (preferred) or case number to look up hearing details on India's official eCourts portal.
              </Text>

              {/* Input */}
              <Text style={{ fontSize: 11, fontWeight: '600', color: c.textSecondary, letterSpacing: 0.8, marginBottom: Spacing.s }}>
                CNR NUMBER / CASE NUMBER
              </Text>
              <TextInput
                testID="ecourts-cnr-input"
                style={{
                  backgroundColor: c.surface, borderRadius: Radius.m, borderWidth: 1, borderColor: c.border,
                  paddingHorizontal: Spacing.m, paddingVertical: 12, ...Typography.body, color: c.textPrimary,
                  marginBottom: Spacing.s, letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                }}
                value={ecourtsInput}
                onChangeText={setEcourtsInput}
                placeholder="e.g. MHMT010123222024"
                placeholderTextColor={c.textTertiary}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={handleFetchEcourts}
                editable={!ecourtsLoading}
              />
              <Text style={{ ...Typography.caption1, color: c.textTertiary, marginBottom: Spacing.m }}>
                The 16-character CNR is printed on your court notice. You can also use the case number e.g. "CRL/001/2024".
              </Text>

              {/* Court Type Selector */}
              <Text style={{ fontSize: 11, fontWeight: '600', color: c.textSecondary, letterSpacing: 0.8, marginBottom: Spacing.xs }}>
                COURT TYPE
              </Text>
              <View style={{ flexDirection: 'row', gap: Spacing.s, marginBottom: Spacing.s }}>
                <TouchableOpacity
                  testID="ecourts-district-btn"
                  style={{
                    flex: 1, paddingVertical: 8, borderRadius: Radius.s, alignItems: 'center',
                    backgroundColor: ecourtsCourtType === 'district' ? c.textPrimary : c.surface,
                    borderWidth: 1, borderColor: ecourtsCourtType === 'district' ? c.textPrimary : c.border,
                  }}
                  onPress={() => setEcourtsCourtType('district')}
                >
                  <Text style={{ ...Typography.footnote, fontWeight: '600', color: ecourtsCourtType === 'district' ? c.background : c.textPrimary }}>
                    District Court
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="ecourts-hc-btn"
                  style={{
                    flex: 1, paddingVertical: 8, borderRadius: Radius.s, alignItems: 'center',
                    backgroundColor: ecourtsCourtType === 'high_court' ? c.textPrimary : c.surface,
                    borderWidth: 1, borderColor: ecourtsCourtType === 'high_court' ? c.textPrimary : c.border,
                  }}
                  onPress={() => setEcourtsCourtType('high_court')}
                >
                  <Text style={{ ...Typography.footnote, fontWeight: '600', color: ecourtsCourtType === 'high_court' ? c.background : c.textPrimary }}>
                    High Court
                  </Text>
                </TouchableOpacity>
              </View>

              {ecourtsCourtType === 'high_court' && (
                <View style={{ marginBottom: Spacing.m }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: c.textSecondary, letterSpacing: 0.8, marginBottom: Spacing.xs }}>
                    SELECT HIGH COURT
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.xs }}>
                    {([
                      { code: 'bombay', label: 'Bombay' },
                      { code: 'delhi', label: 'Delhi' },
                      { code: 'madras', label: 'Madras' },
                      { code: 'calcutta', label: 'Calcutta' },
                      { code: 'karnataka', label: 'Karnataka' },
                    ] as const).map(hc => (
                      <TouchableOpacity
                        key={hc.code}
                        style={{
                          paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full,
                          backgroundColor: ecourtsHcCode === hc.code ? c.textPrimary : c.surface,
                          borderWidth: 1,
                          borderColor: ecourtsHcCode === hc.code ? c.textPrimary : c.border,
                          marginRight: Spacing.xs,
                        }}
                        onPress={() => setEcourtsHcCode(hc.code)}
                      >
                        <Text style={{
                          ...Typography.caption1, fontWeight: '600',
                          color: ecourtsHcCode === hc.code ? c.background : c.textPrimary,
                        }}>
                          {hc.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Actions */}
              <View style={styles.composerActions}>
                <TouchableOpacity
                  testID="ecourts-fetch-btn"
                  style={[styles.composerWhatsapp, ecourtsLoading && { opacity: 0.7 }]}
                  onPress={handleFetchEcourts}
                  disabled={ecourtsLoading}
                  activeOpacity={0.85}
                >
                  {ecourtsLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <>
                        <Feather name="search" size={17} color="#fff" />
                        <Text style={styles.composerWhatsappText}>Fetch from eCourts</Text>
                      </>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.composerCancel}
                  onPress={() => { setShowEcourtsModal(false); setEcourtsInput(''); }}
                  disabled={ecourtsLoading}
                  activeOpacity={0.7}
                >
                  <Text style={styles.composerCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Record Outcome Modal */}
      <RecordOutcomeModal
        visible={showOutcomeModal}
        onClose={() => { setShowOutcomeModal(false); setOutcomeHearing(null); }}
        onSave={handleSaveOutcome}
        hearing={outcomeHearing}
      />

      {/* Doc Picker Sheet — cross-platform replacement for Alert/ActionSheet */}
      <Modal transparent animationType="slide" visible={showDocSheet} onRequestClose={() => setShowDocSheet(false)}>
        <TouchableOpacity style={styles.composerBackdrop} activeOpacity={1} onPress={() => setShowDocSheet(false)}>
          <View style={[styles.composerSheet, { padding: 0, overflow: 'hidden' }]}>
            <View style={{ paddingTop: Spacing.m, paddingBottom: Spacing.s, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border, paddingHorizontal: Spacing.l }}>
              <Text style={{ ...Typography.headline, color: c.textPrimary, textAlign: 'center' }}>Add Document</Text>
            </View>
            {[
              { label: 'Camera', icon: 'camera', idx: 0 },
              { label: 'Photo Library', icon: 'image', idx: 1 },
              { label: 'PDF / File', icon: 'file-text', idx: 2 },
            ].map(opt => (
              <TouchableOpacity
                key={opt.idx}
                testID={`doc-picker-${opt.label.toLowerCase().replace(/ /g, '-')}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.m, paddingHorizontal: Spacing.l, paddingVertical: Spacing.m, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }}
                onPress={() => { setShowDocSheet(false); setTimeout(() => pickDocument(opt.idx), 200); }}
                activeOpacity={0.7}
              >
                <Feather name={opt.icon as any} size={20} color={c.textPrimary} />
                <Text style={{ ...Typography.body, color: c.textPrimary }}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              testID="doc-picker-cancel"
              style={{ alignItems: 'center', justifyContent: 'center', height: 52 }}
              onPress={() => setShowDocSheet(false)}
            >
              <Text style={{ ...Typography.subhead, color: c.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.l },
  notFoundText: { ...Typography.headline, color: c.textSecondary, marginTop: Spacing.m },
  backBtn: { marginTop: Spacing.m, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: c.textPrimary, borderRadius: Radius.m },
  backBtnText: { ...Typography.subhead, color: c.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.m, paddingVertical: Spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.headline, color: c.textPrimary, flex: 1, textAlign: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  editBtn: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: c.textPrimary, borderRadius: Radius.m },
  editBtnText: { ...Typography.subhead, fontWeight: '600', color: c.background },

  content: { flex: 1, padding: Spacing.m },

  // Case Header Card
  caseHeader: {
    backgroundColor: c.surface, borderRadius: Radius.l, padding: Spacing.l, marginBottom: Spacing.m,
  },
  caseHeaderTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  caseNumber: { ...Typography.caption1, fontWeight: '700', color: c.textSecondary, letterSpacing: 0.5 },
  caseTitle: { ...Typography.title3, color: c.textPrimary, marginBottom: 8 },
  courtRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.m },
  courtText: { ...Typography.subhead, color: c.textSecondary },
  datesRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.m },
  dateItem: { flex: 1 },
  dateLabel: { fontSize: 10, fontWeight: '600', color: c.textTertiary, letterSpacing: 0.5, marginBottom: 2 },
  dateValue: { ...Typography.subhead, fontWeight: '600', color: c.textPrimary },
  awaitingDate: { color: c.textTertiary, fontStyle: 'italic' },
  dateDivider: { width: 1, height: 30, backgroundColor: c.border, marginHorizontal: Spacing.m },
  metaRow: { flexDirection: 'row', gap: Spacing.l },
  metaItem: {},
  metaLabel: { fontSize: 10, fontWeight: '600', color: c.textTertiary, letterSpacing: 0.5 },
  metaValue: { ...Typography.footnote, color: c.textPrimary },

  // Section
  section: { marginBottom: Spacing.l },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: c.textSecondary, letterSpacing: 0.8, marginBottom: Spacing.s },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.s },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: c.textPrimary, borderRadius: Radius.m, paddingHorizontal: 12, paddingVertical: 6,
  },
  addBtnText: { ...Typography.footnote, fontWeight: '600', color: c.background },

  // Hearing actions (eCourts + Add buttons)
  hearingActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.s },
  ecourtsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: Radius.m, paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: 'rgba(26,115,232,0.08)', borderWidth: 1, borderColor: 'rgba(26,115,232,0.25)',
  },
  ecourtsBoxText: { fontSize: 12, fontWeight: '700', color: '#1A73E8', letterSpacing: 0.2 },

  // Client Card
  clientCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: c.surface, borderRadius: Radius.m, padding: Spacing.m, marginBottom: Spacing.s,
  },
  clientLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.m, flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.textPrimary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700', color: c.background },
  clientInfo: { flex: 1 },
  clientName: { ...Typography.subhead, fontWeight: '600', color: c.textPrimary },
  clientSub: { ...Typography.caption1, color: c.textSecondary },
  callBtn: { width: 40, height: 40, backgroundColor: c.surfaceHighlight, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  // Contact Buttons
  contactButtons: { flexDirection: 'row', gap: Spacing.s },
  smsButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.s,
    backgroundColor: c.surface, borderRadius: Radius.m, paddingVertical: Spacing.m,
    borderWidth: 1, borderColor: c.border,
  },
  smsButtonIcon: { fontSize: 18 },
  smsButtonText: { ...Typography.subhead, fontWeight: '600', color: c.textPrimary },
  whatsappButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.s,
    backgroundColor: c.textPrimary, borderRadius: Radius.m, paddingVertical: Spacing.m,
  },
  whatsappButtonIcon: { fontSize: 18 },
  whatsappButtonText: { ...Typography.subhead, fontWeight: '600', color: c.background },

  // Parties Card
  partiesCard: { backgroundColor: c.surface, borderRadius: Radius.m, padding: Spacing.m },
  partyItem: { paddingVertical: 4 },
  partyItemBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, marginTop: Spacing.s, paddingTop: Spacing.s },
  partyLabel: { fontSize: 10, fontWeight: '600', color: c.textTertiary, letterSpacing: 0.5, marginBottom: 2 },
  partyValue: { ...Typography.subhead, color: c.textPrimary },

  // Empty Card
  emptyCard: {
    backgroundColor: c.surface, borderRadius: Radius.m, padding: Spacing.xl,
    alignItems: 'center', justifyContent: 'center', gap: Spacing.s,
  },
  emptyText: { ...Typography.subhead, color: c.textTertiary },

  // Hearings
  hearingsList: {},
  hearingItem: { flexDirection: 'row', marginBottom: 0 },
  hearingTimeline: { width: 24, alignItems: 'center' },
  hearingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.surfaceHighlight, borderWidth: 2, borderColor: c.border },
  hearingDotComplete: { backgroundColor: c.textPrimary, borderColor: c.textPrimary },
  hearingLine: { flex: 1, width: 2, backgroundColor: c.border, marginTop: 4 },
  hearingContent: {
    flex: 1, backgroundColor: c.surface, borderRadius: Radius.m, padding: Spacing.m, marginBottom: Spacing.s,
  },
  hearingTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  hearingDate: { ...Typography.footnote, fontWeight: '600', color: c.textPrimary },
  hearingType: { ...Typography.caption2, color: c.textTertiary, textTransform: 'uppercase' },
  hearingPurpose: { ...Typography.subhead, color: c.textSecondary, marginBottom: 8 },
  outcomeBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: c.surfaceHighlight, borderRadius: Radius.s, padding: Spacing.s },
  outcomeText: { ...Typography.caption1, color: c.textSecondary, flex: 1 },
  recordOutcomeBtn: { alignSelf: 'flex-start' },
  recordOutcomeText: { ...Typography.footnote, fontWeight: '600', color: c.textPrimary, textDecorationLine: 'underline' },

  // Documents
  docsList: { gap: Spacing.xs },
  docItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.m,
    backgroundColor: c.surface, borderRadius: Radius.m, padding: Spacing.m,
  },
  docIconWrap: { width: 36, height: 36, backgroundColor: c.surfaceHighlight, borderRadius: Radius.s, alignItems: 'center', justifyContent: 'center' },
  docInfo: { flex: 1 },
  docName: { ...Typography.subhead, color: c.textPrimary },
  docMeta: { ...Typography.caption1, color: c.textTertiary },

  // Voice Notes
  voiceList: { gap: Spacing.xs },
  voiceItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.m,
    backgroundColor: c.surface, borderRadius: Radius.m, padding: Spacing.m,
  },
  voicePlayBtn: { width: 32, height: 32, backgroundColor: c.textPrimary, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  voiceInfo: { flex: 1 },
  voiceTitle: { ...Typography.subhead, color: c.textPrimary },
  voiceMeta: { ...Typography.caption1, color: c.textTertiary },

  // Notes
  notesCard: { backgroundColor: c.surface, borderRadius: Radius.m, padding: Spacing.m },
  notesText: { ...Typography.body, color: c.textSecondary },

  // Delete
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.s,
    paddingVertical: Spacing.m, marginTop: Spacing.l,
  },
  deleteBtnText: { ...Typography.subhead, color: c.textSecondary },

  // Message Composer
  composerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  composerSheet: {
    backgroundColor: c.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.l, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  composerHandle: { width: 36, height: 4, backgroundColor: c.surfaceHighlight, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.l },
  composerTitle: { ...Typography.title3, color: c.textPrimary, marginBottom: Spacing.m },
  templateLabel: { fontSize: 11, fontWeight: '700', color: c.textSecondary, letterSpacing: 0.8, marginBottom: Spacing.s },
  templateScroll: { marginHorizontal: -Spacing.l, marginBottom: Spacing.m },
  templateChips: { paddingHorizontal: Spacing.l, gap: 8, flexDirection: 'row' },
  templateChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: 1, borderColor: c.textPrimary,
    backgroundColor: c.background,
  },
  templateChipSelected: { backgroundColor: c.textPrimary },
  templateChipText: { fontSize: 12, fontWeight: '500', color: c.textPrimary },
  templateChipTextSelected: { color: c.background },
  composerBox: { marginBottom: Spacing.l },
  composerLabel: { fontSize: 11, fontWeight: '600', color: c.textSecondary, letterSpacing: 0.8, marginBottom: Spacing.s },
  composerInput: {
    backgroundColor: c.surface, borderRadius: Radius.m,
    padding: Spacing.m, minHeight: 120, maxHeight: 180,
    ...Typography.body, color: c.textPrimary,
  },
  composerActions: { gap: Spacing.s },
  composerWhatsapp: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.s,
    backgroundColor: c.textPrimary, borderRadius: Radius.m, height: 50,
  },
  composerBtnIcon: { fontSize: 18 },
  composerWhatsappText: { ...Typography.headline, color: c.background },
  composerSms: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.s,
    backgroundColor: c.surface, borderRadius: Radius.m, height: 50,
  },
  composerSmsText: { ...Typography.headline, color: c.textPrimary },
  composerCancel: { alignItems: 'center', justifyContent: 'center', height: 44 },
  composerCancelText: { ...Typography.subhead, color: c.textSecondary },

  // ── Feature 1: Hearing Reminder Banner ────────────────────────────────
  reminderBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#E8F5E9', borderRadius: Radius.m, padding: Spacing.m,
    marginTop: Spacing.s, borderLeftWidth: 3, borderLeftColor: '#25D366',
  },
  reminderBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.s, flex: 1 },
  reminderBannerEmoji: { fontSize: 22 },
  reminderBannerTitle: { ...Typography.headline, color: '#1B5E20' },
  reminderBannerSub: { ...Typography.caption1, color: '#2E7D32', marginTop: 2 },
  reminderBannerArrow: { fontSize: 22, color: '#25D366', marginLeft: Spacing.s },

  // ── Feature 3: Send Update button ─────────────────────────────────────
  sendUpdateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.s,
    backgroundColor: '#F0F4FF', borderRadius: Radius.m, height: 44, marginTop: Spacing.s,
    borderWidth: 1, borderColor: '#C7D4F7',
  },
  sendUpdateIcon: { fontSize: 16 },
  sendUpdateText: { ...Typography.subhead, color: '#3B5BDB', fontWeight: '600' },

  // ── Feature 3: Update Sheet extras ────────────────────────────────────
  templateChipActive: { backgroundColor: c.textPrimary },
  templateChipTextActive: { color: c.background },
  whatsappSendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.s,
    backgroundColor: '#25D366', borderRadius: Radius.m, height: 50,
  },
  whatsappSendIcon: { fontSize: 20 },
  whatsappSendText: { ...Typography.headline, color: '#fff' },
  composerTextInput: {
    backgroundColor: c.surface, borderRadius: Radius.m,
    padding: Spacing.m, minHeight: 120, maxHeight: 200,
    ...Typography.body, color: c.textPrimary,
  },
  composerCancelBtn: { alignItems: 'center', justifyContent: 'center', height: 44 },
  noPhoneRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: c.surface, borderRadius: Radius.m, padding: Spacing.m,
  },
  noPhoneText: { ...Typography.subhead, color: c.textSecondary },
  noPhoneLink: { ...Typography.subhead, color: '#3B5BDB', fontWeight: '600' },
});
