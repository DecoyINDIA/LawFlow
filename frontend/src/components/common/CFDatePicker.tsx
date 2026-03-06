import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors, ColorPalette, Typography, Spacing, Radius } from '../../theme';

interface CFDatePickerProps {
  label: string;
  value?: number;
  onChange: (timestamp: number | undefined) => void;
  placeholder?: string;
  required?: boolean;
  testID?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmtDate(ts: number) {
  const d = new Date(ts);
  return `${d.getDate().toString().padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export function CFDatePicker({
  label, value, onChange, placeholder = 'Select date…', required, testID
}: CFDatePickerProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [open, setOpen] = useState(false);
  const today = new Date();
  const [viewYear, setViewYear] = useState(value ? new Date(value).getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(value ? new Date(value).getMonth() : today.getMonth());

  const selectedDate = value ? new Date(value) : null;
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const handleSelectDay = (day: number) => {
    const date = new Date(viewYear, viewMonth, day, 0, 0, 0, 0);
    onChange(date.getTime());
    setOpen(false);
  };

  const handleClear = () => {
    onChange(undefined);
    setOpen(false);
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const renderCalendar = () => {
    const cells = [];
    // Empty cells for days before first day
    for (let i = 0; i < firstDay; i++) {
      cells.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }
    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected = selectedDate &&
        selectedDate.getFullYear() === viewYear &&
        selectedDate.getMonth() === viewMonth &&
        selectedDate.getDate() === day;
      const isToday = today.getFullYear() === viewYear &&
        today.getMonth() === viewMonth &&
        today.getDate() === day;

      cells.push(
        <TouchableOpacity
          key={day}
          style={[styles.dayCell, isSelected && styles.dayCellSelected]}
          onPress={() => handleSelectDay(day)}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.dayText,
            isSelected && styles.dayTextSelected,
            isToday && !isSelected && styles.dayTextToday
          ]}>
            {day}
          </Text>
        </TouchableOpacity>
      );
    }
    return cells;
  };

  return (
    <>
      <View style={styles.group}>
        <Text style={styles.label}>{label.toUpperCase()}{required ? ' *' : ''}</Text>
        <TouchableOpacity
          testID={testID}
          style={styles.trigger}
          onPress={() => setOpen(true)}
          activeOpacity={0.7}
        >
          <Feather name="calendar" size={16} color={c.textSecondary} />
          <Text style={[styles.triggerText, !value && styles.placeholder]}>
            {value ? fmtDate(value) : placeholder}
          </Text>
          {value && (
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); handleClear(); }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="x" size={16} color={c.textTertiary} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </View>

      <Modal visible={open} transparent animationType="fade" statusBarTranslucent>
        <TouchableOpacity
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          activeOpacity={1}
        >
          <View style={styles.sheet}>
            {/* Header */}
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
                <Feather name="chevron-left" size={20} color={c.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.monthYearText}>
                {MONTHS[viewMonth]} {viewYear}
              </Text>
              <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
                <Feather name="chevron-right" size={20} color={c.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Day headers */}
            <View style={styles.dayHeaders}>
              {DAYS.map(d => (
                <Text key={d} style={styles.dayHeader}>{d}</Text>
              ))}
            </View>

            {/* Calendar grid */}
            <View style={styles.calendarGrid}>
              {renderCalendar()}
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.todayBtn}
                onPress={() => {
                  setViewYear(today.getFullYear());
                  setViewMonth(today.getMonth());
                  handleSelectDay(today.getDate());
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.todayBtnText}>Today</Text>
              </TouchableOpacity>
              {!required && (
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={handleClear}
                  activeOpacity={0.7}
                >
                  <Text style={styles.clearBtnText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  group: { marginBottom: Spacing.m },
  label: { fontSize: 11, fontWeight: '600', color: c.textSecondary, letterSpacing: 0.8, marginBottom: Spacing.s },
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.m,
    backgroundColor: c.surface, borderRadius: Radius.m, height: 48, paddingHorizontal: Spacing.m,
  },
  triggerText: { flex: 1, ...Typography.body, color: c.textPrimary },
  placeholder: { color: c.textTertiary },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  sheet: {
    backgroundColor: c.background, borderRadius: Radius.l, padding: Spacing.l,
    width: '85%', maxWidth: 340,
  },

  calendarHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.m,
  },
  navBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  monthYearText: { ...Typography.headline, color: c.textPrimary },

  dayHeaders: { flexDirection: 'row', marginBottom: Spacing.s },
  dayHeader: {
    flex: 1, textAlign: 'center',
    ...Typography.caption1, fontWeight: '600', color: c.textSecondary,
  },

  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
  },
  dayCellSelected: {
    backgroundColor: c.textPrimary, borderRadius: Radius.full,
  },
  dayText: { ...Typography.subhead, color: c.textPrimary },
  dayTextSelected: { color: c.background, fontWeight: '600' },
  dayTextToday: { color: c.textPrimary, fontWeight: '700' },

  actions: {
    flexDirection: 'row', justifyContent: 'center', gap: Spacing.m,
    marginTop: Spacing.l, paddingTop: Spacing.m,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border,
  },
  todayBtn: {
    paddingHorizontal: 20, paddingVertical: 10, backgroundColor: c.textPrimary, borderRadius: Radius.m,
  },
  todayBtnText: { ...Typography.subhead, fontWeight: '600', color: c.background },
  clearBtn: {
    paddingHorizontal: 20, paddingVertical: 10, backgroundColor: c.surface, borderRadius: Radius.m,
  },
  clearBtnText: { ...Typography.subhead, fontWeight: '600', color: c.textSecondary },
});
