import React, { useState, useMemo, useRef } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { useMode } from '../context/ModeContext';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Generate a simple month grid
function generateMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

export default function CalendarScreen() {
  const { themeColors, currentMode } = useMode();
  const today = new Date();
  const [monthOffset, setMonthOffset] = useState(0);

  const viewDate = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    return d;
  }, [monthOffset]);

  const cells = useMemo(() => generateMonthGrid(viewDate.getFullYear(), viewDate.getMonth()), [viewDate]);
  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Mock cycle data
  const periodDays = [1, 2, 3, 4, 5];
  const fertileDays = [12, 13, 14, 15, 16];
  const ovulationDay = 14;
  const isCurrentMonth = monthOffset === 0;

  const getCellStyle = (day: number) => {
    if (!isCurrentMonth) return { bg: 'transparent', text: '#334155', border: 'transparent' };
    if (periodDays.includes(day)) return { bg: themeColors.primary, text: '#fff', border: themeColors.primary };
    if (day === ovulationDay) return { bg: '#f59e0b', text: '#fff', border: '#f59e0b' };
    if (fertileDays.includes(day)) return { bg: '#fef3c7', text: '#b45309', border: '#fde68a' };
    if (day === today.getDate() && isCurrentMonth) return { bg: themeColors.primary + '15', text: themeColors.primary, border: themeColors.primary };
    return { bg: 'transparent', text: '#334155', border: 'transparent' };
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.card }]}>
        <Text style={styles.headerTitle}>
          Cycle <Text style={{ color: themeColors.primary }}>Calendar</Text>
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => setMonthOffset(o => o - 1)} style={styles.navBtn}>
            <Text style={styles.navBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <TouchableOpacity onPress={() => setMonthOffset(o => o + 1)} style={styles.navBtn}>
            <Text style={styles.navBtnText}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Calendar Grid */}
        <View style={[styles.calendarCard, { backgroundColor: themeColors.card }]}>
          {/* Weekday headers */}
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((d, i) => (
              <Text key={i} style={styles.weekdayText}>{d}</Text>
            ))}
          </View>

          {/* Day cells */}
          <View style={styles.dayGrid}>
            {cells.map((day, i) => {
              if (day === null) return <View key={`e-${i}`} style={styles.dayCell} />;
              const cs = getCellStyle(day);
              return (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayCell, { backgroundColor: cs.bg, borderColor: cs.border, borderWidth: cs.border !== 'transparent' ? 1.5 : 0 }]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayText, { color: cs.text }]}>{day}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Legend */}
        <View style={[styles.legendCard, { backgroundColor: themeColors.card }]}>
          <Text style={styles.legendTitle}>Legend</Text>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: themeColors.primary }]} />
              <Text style={styles.legendText}>Period</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#fde68a' }]} />
              <Text style={styles.legendText}>Fertile</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
              <Text style={styles.legendText}>Ovulation</Text>
            </View>
          </View>
        </View>

        {/* Upcoming Events */}
        <View style={[styles.eventsCard, { backgroundColor: themeColors.card }]}>
          <Text style={styles.legendTitle}>Upcoming</Text>
          <View style={styles.eventItem}>
            <View style={[styles.eventDot, { backgroundColor: themeColors.primary }]} />
            <View>
              <Text style={styles.eventTitle}>Next Period</Text>
              <Text style={styles.eventSub}>In 14 days</Text>
            </View>
          </View>
          <View style={styles.eventItem}>
            <View style={[styles.eventDot, { backgroundColor: '#f59e0b' }]} />
            <View>
              <Text style={styles.eventTitle}>Next Fertile Window</Text>
              <Text style={styles.eventSub}>In 26 days</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  navBtnText: { fontSize: 22, color: '#64748b', fontWeight: '600' },
  monthLabel: { fontSize: 18, fontWeight: '700', color: '#334155' },
  calendarCard: {
    borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 16,
  },
  weekdayRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  weekdayText: { width: 36, textAlign: 'center', fontSize: 13, fontWeight: '700', color: '#94a3b8' },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  dayCell: {
    width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
    borderRadius: 20, marginBottom: 4,
  },
  dayText: { fontSize: 14, fontWeight: '700' },
  legendCard: {
    borderRadius: 20, padding: 16, marginTop: 16,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 16,
  },
  legendTitle: { fontSize: 12, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  legendRow: { flexDirection: 'row', gap: 24 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  eventsCard: {
    borderRadius: 20, padding: 16, marginTop: 16,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 16,
  },
  eventItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  eventDot: { width: 10, height: 10, borderRadius: 5 },
  eventTitle: { fontSize: 14, fontWeight: '600', color: '#334155' },
  eventSub: { fontSize: 12, color: '#94a3b8' },
});
