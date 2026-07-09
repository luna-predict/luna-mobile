import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { toISODay, parseISODay } from '../services/CycleEngine';
import { Card, SectionLabel, Badge } from '../ui';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function generateMonthGrid(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(toISODay(new Date(year, month, d)));
  }
  return cells;
}

const SYMPTOM_EMOJI: Record<string, string> = {
  cramps: '😣', headache: '🤕', bloating: '🎈', fatigue: '😩', backache: '🔙', nausea: '🤢',
  pms: '😤', cravings: '🍫', breast_tenderness: '🎯', ovulation_pain: '🥚',
  implantation_spotting: '✨', morning_sickness: '🤮', heartburn: '🔥', swelling: '🦶',
  contractions: '⚡', hot_flash: '🔥', night_sweats: '🌙', brain_fog: '🌫️', joint_pain: '🦴',
};

export default function CalendarScreen() {
  const { themeColors, currentMode, cycle, pregnancy, logs, user } = useApp();
  const today = toISODay(new Date());
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string>(today);

  const viewDate = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  }, [monthOffset]);

  const cells = useMemo(() => generateMonthGrid(viewDate.getFullYear(), viewDate.getMonth()), [viewDate]);
  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Real predictions from the engine
  const periodSet = useMemo(() => new Set(cycle?.periodDates ?? []), [cycle]);
  const fertileSet = useMemo(() => new Set(cycle?.fertileDates ?? []), [cycle]);
  const ovulationDay = cycle?.ovulationDate;

  // Logged days (any mode) with quick lookup
  const logByDay = useMemo(() => {
    const map = new Map<string, typeof logs[number]>();
    for (const log of logs) map.set(log.date.slice(0, 10), log);
    return map;
  }, [logs]);

  // Actual (logged) period days override predictions visually
  const loggedFlowSet = useMemo(() => {
    const s = new Set<string>();
    for (const log of logs) if (log.flow) s.add(log.date.slice(0, 10));
    return s;
  }, [logs]);

  const dueDay = user?.dueDate;

  const getCellStyle = (day: string) => {
    const isToday = day === today;
    const isSelected = day === selectedDay;
    let bg = 'transparent', text = '#334155', border = 'transparent';

    if (currentMode === 'pregnancy') {
      if (day === dueDay) { bg = themeColors.primary; text = '#fff'; border = themeColors.primary; }
    } else {
      if (loggedFlowSet.has(day)) { bg = themeColors.primary; text = '#fff'; border = themeColors.primaryDark; }
      else if (periodSet.has(day)) { bg = themeColors.primary + '55'; text = '#fff'; border = 'transparent'; }
      else if (day === ovulationDay) { bg = '#f59e0b'; text = '#fff'; border = '#f59e0b'; }
      else if (fertileSet.has(day)) { bg = '#fef3c7'; text = '#b45309'; border = '#fde68a'; }
    }
    if (isToday && bg === 'transparent') { bg = themeColors.primary + '15'; text = themeColors.primary; border = themeColors.primary; }
    if (isSelected) border = themeColors.primaryDark;
    return { bg, text, border };
  };

  const selectedLog = logByDay.get(selectedDay);
  const selectedDate = parseISODay(selectedDay);
  const selectedIsPeriod = periodSet.has(selectedDay) || loggedFlowSet.has(selectedDay);
  const selectedIsFertile = fertileSet.has(selectedDay);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={[styles.header, { backgroundColor: themeColors.card }]}>
        <Text style={styles.headerTitle}>
          {currentMode === 'pregnancy' ? 'Pregnancy ' : 'Cycle '}
          <Text style={{ color: themeColors.primary }}>Calendar</Text>
        </Text>
        {cycle && (
          <Badge
            label={cycle.confidence === 'established' ? 'LEARNED FROM YOUR DATA' : cycle.confidence === 'learning' ? 'LEARNING YOUR CYCLE' : 'FROM ONBOARDING'}
            color={cycle.confidence === 'established' ? '#059669' : '#b45309'}
            bg={cycle.confidence === 'established' ? '#ecfdf5' : '#fef3c7'}
          />
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Month navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => setMonthOffset(o => o - 1)} style={styles.navBtn}>
            <Text style={styles.navBtnText}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMonthOffset(0)}>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMonthOffset(o => o + 1)} style={styles.navBtn}>
            <Text style={styles.navBtnText}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Grid */}
        <Card style={{ padding: 16 }}>
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((d, i) => <Text key={i} style={styles.weekdayText}>{d}</Text>)}
          </View>
          <View style={styles.dayGrid}>
            {cells.map((day, i) => {
              if (day === null) return <View key={`e-${i}`} style={styles.dayCell} />;
              const cs = getCellStyle(day);
              const hasLog = logByDay.has(day);
              return (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayCell, {
                    backgroundColor: cs.bg,
                    borderColor: cs.border,
                    borderWidth: cs.border !== 'transparent' ? 1.5 : 0,
                  }]}
                  onPress={() => setSelectedDay(day)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayText, { color: cs.text }]}>{parseInt(day.slice(8), 10)}</Text>
                  {hasLog && <View style={[styles.logDot, { backgroundColor: cs.text === '#fff' ? '#fff' : themeColors.primary }]} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* Legend */}
        <Card>
          <SectionLabel style={{ marginBottom: 10 }}>Legend</SectionLabel>
          <View style={styles.legendRow}>
            {currentMode === 'pregnancy' ? (
              <>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: themeColors.primary }]} /><Text style={styles.legendText}>Due date</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: themeColors.primary, opacity: 0.4 }]} /><Text style={styles.legendText}>Logged day</Text></View>
              </>
            ) : (
              <>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: themeColors.primary }]} /><Text style={styles.legendText}>Period (logged)</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: themeColors.primary + '55' }]} /><Text style={styles.legendText}>Predicted</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#fde68a' }]} /><Text style={styles.legendText}>Fertile</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} /><Text style={styles.legendText}>Ovulation</Text></View>
              </>
            )}
          </View>
        </Card>

        {/* Selected day detail */}
        <Card>
          <SectionLabel style={{ marginBottom: 10 }}>
            {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </SectionLabel>
          {currentMode !== 'pregnancy' && (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: selectedLog ? 12 : 0, flexWrap: 'wrap' }}>
              {selectedIsPeriod && <Badge label="PERIOD" color="#fff" bg={themeColors.primary} />}
              {selectedDay === ovulationDay && <Badge label="OVULATION" color="#fff" bg="#f59e0b" />}
              {selectedIsFertile && !selectedIsPeriod && <Badge label="FERTILE WINDOW" color="#b45309" bg="#fef3c7" />}
              {!selectedIsPeriod && !selectedIsFertile && selectedDay !== ovulationDay && (
                <Text style={{ fontSize: 13, color: '#94a3b8' }}>No predictions for this day</Text>
              )}
            </View>
          )}
          {selectedLog ? (
            <View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {selectedLog.mood && <View style={styles.detailChip}><Text style={styles.detailChipText}>🎭 {selectedLog.mood}</Text></View>}
                {selectedLog.energy && <View style={styles.detailChip}><Text style={styles.detailChipText}>⚡ {selectedLog.energy}</Text></View>}
                {selectedLog.flow && <View style={styles.detailChip}><Text style={styles.detailChipText}>🩸 {selectedLog.flow}</Text></View>}
                {selectedLog.bbt != null && <View style={styles.detailChip}><Text style={styles.detailChipText}>🌡️ {selectedLog.bbt}°C</Text></View>}
                {selectedLog.opkResult && <View style={styles.detailChip}><Text style={styles.detailChipText}>🧪 OPK {selectedLog.opkResult}</Text></View>}
                {(selectedLog.kicksCount ?? 0) > 0 && <View style={styles.detailChip}><Text style={styles.detailChipText}>🦶 {selectedLog.kicksCount} kicks</Text></View>}
                {(selectedLog.hotFlashCount ?? 0) > 0 && <View style={styles.detailChip}><Text style={styles.detailChipText}>🔥 {selectedLog.hotFlashCount} hot flashes</Text></View>}
                {selectedLog.symptoms.map(s => (
                  <View key={s} style={styles.detailChip}>
                    <Text style={styles.detailChipText}>{SYMPTOM_EMOJI[s] ?? '•'} {s.replace(/_/g, ' ')}</Text>
                  </View>
                ))}
              </View>
              {selectedLog.notes ? <Text style={styles.notesText}>"{selectedLog.notes}"</Text> : null}
            </View>
          ) : (
            <Text style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
              {selectedDay <= today ? 'Nothing logged this day.' : 'Future day — nothing logged yet.'}
            </Text>
          )}
        </Card>

        {/* Upcoming */}
        <Card>
          <SectionLabel style={{ marginBottom: 10 }}>Upcoming</SectionLabel>
          {currentMode === 'pregnancy' && pregnancy ? (
            <>
              <View style={styles.eventItem}>
                <View style={[styles.eventDot, { backgroundColor: themeColors.primary }]} />
                <View>
                  <Text style={styles.eventTitle}>Due date</Text>
                  <Text style={styles.eventSub}>
                    {parseISODay(pregnancy.dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} · {pregnancy.daysUntilDue} days away
                  </Text>
                </View>
              </View>
              <View style={styles.eventItem}>
                <View style={[styles.eventDot, { backgroundColor: '#f59e0b' }]} />
                <View>
                  <Text style={styles.eventTitle}>Week {pregnancy.week + 1} begins</Text>
                  <Text style={styles.eventSub}>In {7 - pregnancy.day} days</Text>
                </View>
              </View>
            </>
          ) : cycle ? (
            <>
              <View style={styles.eventItem}>
                <View style={[styles.eventDot, { backgroundColor: themeColors.primary }]} />
                <View>
                  <Text style={styles.eventTitle}>Next period</Text>
                  <Text style={styles.eventSub}>
                    {parseISODay(cycle.nextPeriodDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                    {cycle.daysUntilPeriod === 0 ? ' · today' : ` · in ${cycle.daysUntilPeriod} days`}
                  </Text>
                </View>
              </View>
              <View style={styles.eventItem}>
                <View style={[styles.eventDot, { backgroundColor: '#f59e0b' }]} />
                <View>
                  <Text style={styles.eventTitle}>{cycle.inFertileWindow ? 'Fertile window — now' : 'Next fertile window'}</Text>
                  <Text style={styles.eventSub}>
                    {cycle.inFertileWindow
                      ? `Until ${parseISODay(cycle.fertileWindowEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                      : `Opens ${parseISODay(cycle.fertileWindowStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ovulation in ${cycle.daysUntilOvulation} days`}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <Text style={{ fontSize: 13, color: '#94a3b8' }}>Log your first period to unlock predictions.</Text>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  navBtnText: { fontSize: 22, color: '#64748b', fontWeight: '600' },
  monthLabel: { fontSize: 18, fontWeight: '700', color: '#334155' },
  weekdayRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  weekdayText: { width: 36, textAlign: 'center', fontSize: 13, fontWeight: '700', color: '#94a3b8' },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  dayCell: {
    width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
    borderRadius: 20, marginBottom: 4,
  },
  dayText: { fontSize: 14, fontWeight: '700' },
  logDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  legendRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  detailChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100, backgroundColor: '#f1f5f9' },
  detailChipText: { fontSize: 12, color: '#475569', fontWeight: '600', textTransform: 'capitalize' },
  notesText: { fontSize: 13, color: '#64748b', fontStyle: 'italic', marginTop: 10 },
  eventItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  eventDot: { width: 10, height: 10, borderRadius: 5 },
  eventTitle: { fontSize: 14, fontWeight: '600', color: '#334155' },
  eventSub: { fontSize: 12, color: '#94a3b8' },
});
