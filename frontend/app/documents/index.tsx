import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import { useApp } from '../../src/context/AppContext';
import { CaseDocument } from '../../src/context/AppContext';
import { CFSearchBar } from '../../src/components/common/CFSearchBar';

const FILE_ICONS: Record<string, string> = {
  PDF: 'file-text',
  IMAGE: 'image',
  WORD: 'file',
  EXCEL: 'grid',
  OTHER: 'paperclip',
};

function DocCard({ doc, onDelete }: { doc: CaseDocument; onDelete: () => void }) {
  return (
    <View style={s.card} testID={`doc-${doc.id}`}>
      <View style={[s.fileIcon, doc.uploadStatus === 'UPLOADED' ? s.iconUploaded : s.iconLocal]}>
        <Feather name={FILE_ICONS[doc.fileType] as any} size={20} color={Colors.textPrimary} />
      </View>
      <View style={s.info}>
        <Text style={s.fileName} numberOfLines={1}>{doc.fileName}</Text>
        <Text style={s.caseName} numberOfLines={1}>{doc.caseName}</Text>
        <View style={s.metaRow}>
          <Text style={s.meta}>{doc.fileType} · {doc.fileSize}</Text>
          <View style={[s.statusBadge, doc.uploadStatus === 'UPLOADED' ? s.uploaded : s.local]}>
            <Text style={s.statusText}>{doc.uploadStatus === 'UPLOADED' ? 'Uploaded' : 'Local'}</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Feather name="trash-2" size={15} color={Colors.textTertiary} />
      </TouchableOpacity>
    </View>
  );
}

export default function DocumentsScreen() {
  const router = useRouter();
  const { documents, deleteDocument, cases, addDocument } = useApp();
  const [search, setSearch] = useState('');

  const filtered = documents.filter(d =>
    !search || d.fileName.toLowerCase().includes(search.toLowerCase()) || d.caseName.toLowerCase().includes(search.toLowerCase())
  );

  const handleMockUpload = () => {
    if (cases.length === 0) return Alert.alert('No Cases', 'Add cases first to attach documents.');
    const randomCase = cases[Math.floor(Math.random() * cases.length)];
    const fileTypes = ['PDF', 'IMAGE', 'WORD'] as const;
    const names = ['Affidavit.pdf', 'Evidence_Photo.jpg', 'Written_Statement.docx', 'Exhibit_A.pdf', 'Notice.pdf'];
    addDocument({
      caseId: randomCase.id,
      caseName: randomCase.title,
      fileName: names[Math.floor(Math.random() * names.length)],
      fileType: fileTypes[Math.floor(Math.random() * fileTypes.length)],
      fileSize: `${Math.floor(Math.random() * 900 + 100)} KB`,
      uploadStatus: 'UPLOADED',
    });
    Alert.alert('✓ Uploaded', 'Mock document added successfully');
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Documents</Text>
        <TouchableOpacity testID="upload-doc-btn" onPress={handleMockUpload} style={s.addBtn} activeOpacity={0.8}>
          <Feather name="upload" size={16} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <View style={s.searchPad}>
        <CFSearchBar value={search} onChangeText={setSearch} placeholder="Search documents…" />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.list, filtered.length === 0 && { flex: 1 }]}
        renderItem={({ item }) => (
          <DocCard
            doc={item}
            onDelete={() => Alert.alert('Delete', 'Delete this document?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deleteDocument(item.id) },
            ])}
          />
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <Feather name="folder" size={48} color={Colors.textTertiary} />
            <Text style={s.emptyTitle}>No documents</Text>
            <Text style={s.emptySub}>Tap ↑ to upload a mock document</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.m, paddingTop: Spacing.s, paddingBottom: Spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, ...Typography.headline, color: Colors.textPrimary, marginLeft: Spacing.s },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.black, alignItems: 'center', justifyContent: 'center' },
  searchPad: { paddingHorizontal: Spacing.m, paddingBottom: Spacing.m },
  list: { paddingHorizontal: Spacing.m, paddingBottom: 16 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.m,
    backgroundColor: Colors.surface, borderRadius: Radius.m,
    padding: Spacing.m, marginBottom: Spacing.s,
  },
  fileIcon: { width: 44, height: 44, borderRadius: Radius.s, alignItems: 'center', justifyContent: 'center' },
  iconUploaded: { backgroundColor: Colors.surfaceHighlight },
  iconLocal: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  info: { flex: 1, gap: 3 },
  fileName: { ...Typography.subhead, fontWeight: '500', color: Colors.textPrimary },
  caseName: { ...Typography.caption1, color: Colors.textSecondary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.s, marginTop: 2 },
  meta: { ...Typography.caption1, color: Colors.textTertiary },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full },
  uploaded: { backgroundColor: Colors.black },
  local: { backgroundColor: Colors.surfaceHighlight },
  statusText: { fontSize: 9, fontWeight: '700', color: Colors.white, letterSpacing: 0.3 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.s, paddingTop: 80 },
  emptyTitle: { ...Typography.title3, color: Colors.textSecondary },
  emptySub: { ...Typography.subhead, color: Colors.textTertiary },
});
