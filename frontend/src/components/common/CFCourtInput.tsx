import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../../theme';

interface CFCourtInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  savedCourts: string[];
  onDeleteCourt?: (name: string) => void;
  placeholder?: string;
  error?: string;
  testID?: string;
}

export function CFCourtInput({
  label, value, onChangeText, savedCourts, onDeleteCourt, placeholder, error, testID
}: CFCourtInputProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [focused, setFocused] = useState(false);

  const suggestions = useMemo(() => {
    if (!value.trim() || value.length < 2) return [];
    const q = value.toLowerCase();
    return savedCourts.filter(c => c.toLowerCase().includes(q) && c.toLowerCase() !== value.toLowerCase());
  }, [value, savedCourts]);

  const quickSuggestions = useMemo(() => {
    if (value.trim()) return [];
    return savedCourts.slice(0, 5);
  }, [value, savedCourts]);

  const showSuggestions = focused && (suggestions.length > 0 || quickSuggestions.length > 0);

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <View style={styles.inputWrap}>
        <Feather name="map-pin" size={16} color={c.textSecondary} />
        <TextInput
          testID={testID}
          style={[styles.input, error && styles.inputErr]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.textTertiary}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
        />
        {value.length > 0 && (
          <TouchableOpacity onPress={() => onChangeText('')}>
            <Feather name="x" size={16} color={c.textTertiary} />
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={styles.errText}>{error}</Text> : null}

      {showSuggestions && (
        <View style={styles.suggestionsWrap}>
          {!value.trim() && quickSuggestions.length > 0 && (
            <Text style={styles.suggestionsLabel}>Recent Courts</Text>
          )}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionsRow}
          >
            {(value.trim() ? suggestions : quickSuggestions).map(s => (
              <TouchableOpacity
                key={s}
                style={styles.suggestionChip}
                onPress={() => { onChangeText(s); setFocused(false); }}
                onLongPress={() => onDeleteCourt?.(s)}
                activeOpacity={0.7}
              >
                <Text style={styles.suggestionText} numberOfLines={1}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  group: { marginBottom: Spacing.m },
  label: { fontSize: 11, fontWeight: '600', color: c.textSecondary, letterSpacing: 0.8, marginBottom: Spacing.s },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.m,
    backgroundColor: c.surface, borderRadius: Radius.m, height: 48, paddingHorizontal: Spacing.m,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  input: { flex: 1, ...Typography.body, color: c.textPrimary, height: 48 },
  inputErr: { borderColor: c.textPrimary },
  errText: { ...Typography.caption1, color: c.textPrimary, opacity: 0.6, marginTop: 4 },

  suggestionsWrap: { marginTop: Spacing.s },
  suggestionsLabel: { ...Typography.caption1, color: c.textSecondary, marginBottom: 6 },
  suggestionsRow: { gap: Spacing.s },
  suggestionChip: {
    backgroundColor: c.surfaceHighlight, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 6, maxWidth: 180,
  },
  suggestionText: { ...Typography.footnote, color: c.textPrimary },
});
