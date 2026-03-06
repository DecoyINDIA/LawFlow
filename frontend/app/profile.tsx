import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Image, Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../src/theme';
import { useApp } from '../src/context/AppContext';
import type { AdvocateProfile } from '../src/types';

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

function Field({ label, value, isEditing, field, editData, onChange }: {
  label: string;
  value: string;
  isEditing: boolean;
  field: keyof AdvocateProfile;
  editData: Partial<AdvocateProfile>;
  onChange: (f: keyof AdvocateProfile, v: string) => void;
}) {
  const c = useColors();
  if (!isEditing) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.m, paddingVertical: 14, gap: Spacing.m }}>
        <Text style={{ width: 110, ...Typography.footnote, color: c.textSecondary }}>{label}</Text>
        <Text style={{ flex: 1, ...Typography.subhead, color: c.textPrimary }}>{value || '—'}</Text>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.m, paddingVertical: 14, gap: Spacing.m }}>
      <Text style={{ width: 110, ...Typography.footnote, color: c.textSecondary }}>{label}</Text>
      <TextInput
        style={{ flex: 1, ...Typography.subhead, color: c.textPrimary, borderBottomWidth: 1, borderBottomColor: c.border, paddingBottom: 2 }}
        value={String(editData[field] ?? '')}
        onChangeText={v => onChange(field, v)}
        placeholder={label}
        placeholderTextColor={c.textTertiary}
      />
    </View>
  );
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.m, paddingTop: Spacing.s, paddingBottom: Spacing.m,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, ...Typography.headline, color: c.textPrimary, textAlign: 'center' },
  editBtnText: { ...Typography.subhead, fontWeight: '600', color: c.textPrimary },
  cancelBtnText: { ...Typography.subhead, color: c.textSecondary },

  avatarSection: { alignItems: 'center', paddingVertical: Spacing.xl },
  avatarWrap: { position: 'relative', marginBottom: Spacing.m },
  avatarCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: c.textPrimary, alignItems: 'center', justifyContent: 'center',
  },
  avatarImage: { width: 72, height: 72, borderRadius: 36 },
  avatarInitials: { fontSize: 24, fontWeight: '700', color: c.background },
  avatarCamBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: c.textPrimary, borderWidth: 2, borderColor: c.background,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarName: { ...Typography.title3, color: c.textPrimary, marginBottom: 4 },
  avatarDesignation: { ...Typography.subhead, color: c.textSecondary },
  avatarNameInput: {
    fontSize: 20, fontWeight: '700', color: c.textPrimary,
    borderBottomWidth: 1, borderBottomColor: c.border,
    paddingBottom: 4, textAlign: 'center', minWidth: 200,
  },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: c.textSecondary,
    letterSpacing: 0.8, marginBottom: Spacing.s,
    marginTop: Spacing.m, paddingHorizontal: Spacing.m,
  },
  card: {
    marginHorizontal: Spacing.m, backgroundColor: c.surface,
    borderRadius: Radius.m, overflow: 'hidden',
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginHorizontal: Spacing.m },

  saveBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: c.background,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border,
    padding: Spacing.m, paddingBottom: Spacing.l,
  },
  saveBtn: {
    backgroundColor: c.textPrimary, borderRadius: Radius.m,
    paddingVertical: 16, alignItems: 'center',
  },
  saveBtnText: { ...Typography.headline, color: c.background },
});

export default function ProfileScreen() {
  const router = useRouter();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { advocateProfile, updateAdvocateProfile } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<AdvocateProfile>(advocateProfile);

  const handleEdit = () => { setEditData({ ...advocateProfile }); setIsEditing(true); };
  const handleCancel = () => { setIsEditing(false); setEditData(advocateProfile); };

  const handleSave = () => {
    updateAdvocateProfile({ ...editData, yearsOfExperience: editData.yearsOfExperience ? Number(editData.yearsOfExperience) : undefined });
    setIsEditing(false);
  };

  const handlePickPhoto = async () => {
    try {
      const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!granted) { Alert.alert('Permission Required', 'Camera roll access needed to change photo.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        const uri = result.assets[0].uri;
        if (isEditing) setEditData(p => ({ ...p, photoUri: uri }));
        else updateAdvocateProfile({ photoUri: uri });
      }
    } catch { Alert.alert('Error', 'Could not pick photo.'); }
  };

  const setField = (field: keyof AdvocateProfile, value: string) => setEditData(p => ({ ...p, [field]: value }));
  const profile = isEditing ? editData : advocateProfile;
  const initials = getInitials(profile.name || 'U');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} testID="profile-back-btn">
          <Feather name="arrow-left" size={22} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        {!isEditing ? (
          <TouchableOpacity style={{ width: 60, alignItems: 'flex-end' }} onPress={handleEdit} testID="edit-profile-btn">
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={{ width: 60, alignItems: 'flex-end' }} onPress={handleCancel} testID="cancel-edit-btn">
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={handlePickPhoto} activeOpacity={0.8} testID="avatar-btn">
              <View style={styles.avatarWrap}>
                {profile.photoUri ? (
                  <Image source={{ uri: profile.photoUri }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  </View>
                )}
                <View style={styles.avatarCamBadge}>
                  <Feather name="camera" size={12} color={c.background} />
                </View>
              </View>
            </TouchableOpacity>
            {!isEditing ? (
              <>
                <Text style={styles.avatarName}>{advocateProfile.name}</Text>
                <Text style={styles.avatarDesignation}>{advocateProfile.designation || 'Advocate'}</Text>
              </>
            ) : (
              <TextInput
                style={styles.avatarNameInput}
                value={editData.name}
                onChangeText={v => setField('name', v)}
                placeholder="Full Name"
                placeholderTextColor={c.textTertiary}
                textAlign="center"
              />
            )}
          </View>

          {/* Professional Info */}
          <Text style={styles.sectionLabel}>PROFESSIONAL INFO</Text>
          <View style={styles.card}>
            <Field label="Enrollment No." value={advocateProfile.enrollmentNumber || ''} isEditing={isEditing} field="enrollmentNumber" editData={editData} onChange={setField} />
            <View style={styles.divider} />
            <Field label="Designation" value={advocateProfile.designation || ''} isEditing={isEditing} field="designation" editData={editData} onChange={setField} />
            <View style={styles.divider} />
            <Field label="Bar Council" value={advocateProfile.barCouncil || ''} isEditing={isEditing} field="barCouncil" editData={editData} onChange={setField} />
            <View style={styles.divider} />
            <Field
              label="Years of Exp."
              value={advocateProfile.yearsOfExperience ? String(advocateProfile.yearsOfExperience) : ''}
              isEditing={isEditing} field="yearsOfExperience"
              editData={{ ...editData, yearsOfExperience: editData.yearsOfExperience ?? undefined }}
              onChange={setField}
            />
          </View>

          {/* Contact Info */}
          <Text style={styles.sectionLabel}>CONTACT INFO</Text>
          <View style={styles.card}>
            <Field label="Phone" value={advocateProfile.phone} isEditing={isEditing} field="phone" editData={editData} onChange={setField} />
            <View style={styles.divider} />
            <Field label="Email" value={advocateProfile.email || ''} isEditing={isEditing} field="email" editData={editData} onChange={setField} />
            <View style={styles.divider} />
            <Field label="Office Address" value={advocateProfile.officeAddress || ''} isEditing={isEditing} field="officeAddress" editData={editData} onChange={setField} />
          </View>

          {/* Practice Info */}
          <Text style={styles.sectionLabel}>PRACTICE INFO</Text>
          <View style={styles.card}>
            {!isEditing ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.m, paddingVertical: 14, gap: Spacing.m }}>
                  <Text style={{ width: 110, ...Typography.footnote, color: c.textSecondary }}>Practice Areas</Text>
                  <Text style={{ flex: 1, ...Typography.subhead, color: c.textPrimary }}>{(advocateProfile.practiceAreas || []).join(', ') || '—'}</Text>
                </View>
                <View style={styles.divider} />
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.m, paddingVertical: 14, gap: Spacing.m }}>
                  <Text style={{ width: 110, ...Typography.footnote, color: c.textSecondary }}>Primary Courts</Text>
                  <Text style={{ flex: 1, ...Typography.subhead, color: c.textPrimary }}>{(advocateProfile.primaryCourts || []).join(', ') || '—'}</Text>
                </View>
              </>
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.m, paddingVertical: 14, gap: Spacing.m }}>
                  <Text style={{ width: 110, ...Typography.footnote, color: c.textSecondary }}>Practice Areas</Text>
                  <TextInput
                    style={{ flex: 1, ...Typography.subhead, color: c.textPrimary, borderBottomWidth: 1, borderBottomColor: c.border, paddingBottom: 2 }}
                    value={(editData.practiceAreas || []).join(', ')}
                    onChangeText={v => setEditData(p => ({ ...p, practiceAreas: v.split(',').map(x => x.trim()).filter(Boolean) }))}
                    placeholder="Criminal, Civil, Family"
                    placeholderTextColor={c.textTertiary}
                  />
                </View>
                <View style={styles.divider} />
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.m, paddingVertical: 14, gap: Spacing.m }}>
                  <Text style={{ width: 110, ...Typography.footnote, color: c.textSecondary }}>Primary Courts</Text>
                  <TextInput
                    style={{ flex: 1, ...Typography.subhead, color: c.textPrimary, borderBottomWidth: 1, borderBottomColor: c.border, paddingBottom: 2 }}
                    value={(editData.primaryCourts || []).join(', ')}
                    onChangeText={v => setEditData(p => ({ ...p, primaryCourts: v.split(',').map(x => x.trim()).filter(Boolean) }))}
                    placeholder="Bombay High Court, City Civil Court"
                    placeholderTextColor={c.textTertiary}
                  />
                </View>
              </>
            )}
          </View>

          <View style={{ height: isEditing ? 80 : 32 }} />
        </ScrollView>

        {isEditing && (
          <View style={styles.saveBar}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} testID="save-profile-btn" activeOpacity={0.85}>
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
