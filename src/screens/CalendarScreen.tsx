import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, PenLine, Droplet } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { toISODay, parseISODay, formatDay, BLEEDING_FLOWS } from '../domain';
import { Card, SectionLabel, Badge, Button, IconButton, ScreenHeader, useToast, space, type } from '../ui';
import { RootStackParamList } from '../navigation/AppNavigator';
import { LogDay, SymptomLog } from '../types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function monthGrid(year: number, month: number): (LogDay | null)[] {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (LogDay | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push(toISODay(new Date(year, month, d)));
  while (cells.length % 7) cells.push(null);
  return cells;
}

const SYMPTOM_LABEL = (s: string) => s.replace(/_/g, ' ');

export default function CalendarScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const toast = useToast();
  const { themeColors: t, currentMode, cycle, pregnancy, logs, today, saveLog, getLog } = useApp();
  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState<LogDay>(today);

  const view = useMemo(() => {
    const now = parseISODay(today);
    return new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  }, [monthOffset, today]);
  const cells = useMemo(() => monthGrid(view.getFullYear(), view.getMonth()), [view]);
  const monthLabel = view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const showPredictions = currentMode === 'period' || currentMode === 'conceive';
  const periodSet = useMemo(() => new Set(showPredictions ? cycle?.periodDates ?? [] : []), [cycle, showPredictions]);
  const fertileSet = useMemo(() => new Set(showPredictions ? cycle?.fertileDates ?? [] : []), [cycle, showPredictions]);
  const peakSet = useMemo(() => new Set(showPredictions ? cycle?.peakDays ?? [] : []), [cycle, showPredictions]);
  const ovulationDay = showPredictions ? cycle?.ovulationDate : undefined;

  const logByDay = useMemo(() => {
    const m = new Map<LogDay, SymptomLog>();
    for (const l of logs) if (l.mode === currentMode || !m.has(l.day)) m.set(l.day, l);
    return m;
  }, [logs, currentMode]);

  const describe = (day: LogDay) => {
    const log = logByDay.get(day);
    const bleeding = !!log && (log.periodStart || (!!log.flow && BLEEDING_FLOWS.has(log.flow)));
    const spotting = log?.flow === 'spotting';
    return {
      log,
      bleeding,
      spotting,
      predictedPeriod: !bleeding && periodSet.has(day) && day >= today,
      ovulation: day === ovulationDay,
      fertile: fertileSet.has(day),
      peak: peakSet.has(day),
      due: !!pregnancy && day === pregnancy.dueDate,
    };
  };

  const cellStyle = (day: LogDay) => {
    const d = describe(day);
    let bg = 'transparent';
    let fg = t.text;
    let border = 'transparent';
    let dashed = false;
    if (d.due) { bg = t.primaryStrong; fg = '#FFFFFF'; }
    else if (d.bleeding) { bg = t.primaryStrong; fg = '#FFFFFF'; }
    else if (d.predictedPeriod) { bg = t.tint; fg = t.primaryStrong; border = t.primary; dashed = true; }
    else if (d.ovulation) {
      bg = cycle?.ovulationStatus === 'predicted' ? t.warningTint : t.warning;
      fg = cycle?.ovulationStatus === 'predicted' ? t.warning : '#FFFFFF';
      border = t.warning;
      dashed = cycle?.ovulationStatus === 'predicted';
    } else if (d.peak) { bg = '#FDE68A'; fg = '#78350F'; }
    else if (d.fertile) { bg = t.warningTint; fg = t.warning; }
    if (day === today && bg === 'transparent') { border = t.primaryStrong; }
    return { bg, fg, border, dashed, d };
  };

  const a11yLabel = (day: LogDay) => {
    const d = describe(day);
    const parts = [formatDay(day, { weekday: 'long', month: 'long', day: 'numeric' })];
    if (day === today) parts.push('today');
    if (d.bleeding) parts.push('period logged');
    if (d.spotting) parts.push('spotting');
    if (d.predictedPeriod) parts.push('period predicted');
    if (d.ovulation) parts.push(`ovulation ${cycle?.ovulationStatus}`);
    else if (d.peak) parts.push('peak fertility');
    else if (d.fertile) parts.push('fertile window');
    if (d.due) parts.push('due date');
    if (d.log) parts.push('has a log');
    return parts.join(', ');
  };

  const sel = describe(selected);
  const isFuture = selected > today;

  const markPeriodStart = async () => {
    const existing = getLog(selected, currentMode);
    await saveLog({
      ...(existing ?? { symptoms: [], mood: null, energy: null, notes: '' }),
      id: existing?.id,
      day: selected,
      mode: currentMode,
      flow: existing?.flow && existing.flow !== 'spotting' ? existing.flow : 'medium',
      periodStart: true,
      periodEnd: undefined,
    });
    toast.show(`Period start saved for ${formatDay(selected)}`);
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: t.background }]}>
      <ScreenHeader
        title={currentMode === 'pregnancy' ? 'Pregnancy' : 'Cycle'}
        accent="calendar"
        right={cycle && showPredictions ? (
          <Badge
            label={cycle.confidence === 'established' ? 'Learned' : cycle.confidence === 'irregular' ? 'Irregular' : cycle.confidence === 'learning' ? 'Learning' : 'From onboarding'}
            color={cycle.confidence === 'established' ? t.success : t.warning}
            bg={cycle.confidence === 'established' ? t.successTint : t.warningTint}
          />
        ) : undefined}
      />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}>
        <View style={styles.monthNav}>
          <IconButton icon={ChevronLeft} label="Previous month" onPress={() => setMonthOffset(o => o - 1)} />
          <Pressable onPress={() => { setMonthOffset(0); setSelected(today); }} accessibilityRole="button" accessibilityLabel={`${monthLabel}. Jump to today`}>
            <Text style={{ ...type.heading, color: t.text }}>{monthLabel}</Text>
          </Pressable>
          <IconButton icon={ChevronRight} label="Next month" onPress={() => setMonthOffset(o => o + 1)} />
        </View>

        <Card style={{ paddingHorizontal: space.sm }}>
          <View style={styles.week}>
            {WEEKDAYS.map(d => <Text key={d} style={[styles.weekday, { color: t.subtext }]} accessibilityElementsHidden>{d.slice(0, 1)}</Text>)}
          </View>
          <View style={styles.grid}>
            {cells.map((day, i) => {
              if (!day) return <View key={`e${i}`} style={styles.cell} />;
              const s = cellStyle(day);
              const isSel = day === selected;
              return (
                <Pressable
                  key={day}
                  testID={`cal-${day}`}
                  onPress={() => setSelected(day)}
                  accessibilityRole="button"
                  accessibilityLabel={a11yLabel(day)}
                  accessibilityState={{ selected: isSel }}
                  style={styles.cell}
                >
                  <View style={[styles.dayCircle, {
                    backgroundColor: s.bg,
                    borderColor: isSel ? t.text : s.border,
                    borderWidth: isSel || s.border !== 'transparent' ? 2 : 0,
                    borderStyle: s.dashed && !isSel ? 'dashed' : 'solid',
                  }]}>
                    <Text style={{ fontSize: 15, fontWeight: day === today ? '800' : '600', color: s.fg }}>{parseInt(day.slice(8), 10)}</Text>
                  </View>
                  <View style={styles.markers}>
                    {s.d.spotting && <Droplet color={t.primaryStrong} size={9} fill={t.primaryStrong} />}
                    {s.d.log && !s.d.spotting && <View style={[styles.dot, { backgroundColor: t.textMuted }]} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Legend */}
        <View style={styles.legend} accessibilityLabel="Legend">
          {(currentMode === 'pregnancy'
            ? [[t.primaryStrong, 'Due date'], [t.textMuted, 'Logged']]
            : showPredictions
              ? [[t.primaryStrong, 'Period'], [t.tint, 'Predicted'], [t.warningTint, 'Fertile'], [t.warning, 'Ovulation'], [t.textMuted, 'Logged']]
              : [[t.primaryStrong, 'Bleeding'], [t.textMuted, 'Logged']]
          ).map(([c, l]) => (
            <View key={l} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: c, borderColor: t.border }]} />
              <Text style={{ fontSize: 13, color: t.textMuted }}>{l}</Text>
            </View>
          ))}
        </View>

        {/* Selected day */}
        <SectionLabel>{formatDay(selected, { weekday: 'long', month: 'long', day: 'numeric' })}</SectionLabel>
        <Card>
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', marginBottom: space.md }}>
            {sel.bleeding && <Badge label="Period" color="#FFFFFF" bg={t.primaryStrong} />}
            {sel.spotting && <Badge label="Spotting" color={t.primaryStrong} bg={t.tint} />}
            {sel.predictedPeriod && <Badge label="Period predicted" color={t.primaryStrong} bg={t.tint} />}
            {sel.ovulation && <Badge label={`Ovulation · ${cycle?.ovulationStatus}`} color="#FFFFFF" bg={t.warning} />}
            {!sel.ovulation && sel.peak && <Badge label="Peak fertility" color="#78350F" bg="#FDE68A" />}
            {!sel.ovulation && !sel.peak && sel.fertile && <Badge label="Fertile window" color={t.warning} bg={t.warningTint} />}
            {sel.due && <Badge label="Due date" color="#FFFFFF" bg={t.primaryStrong} />}
          </View>

          {sel.log ? (
            <View style={{ gap: space.sm }}>
              <Text style={{ color: t.text, lineHeight: 22 }}>
                {[
                  sel.log.flow && `Flow: ${sel.log.flow}`,
                  sel.log.mood && `Mood: ${sel.log.mood}`,
                  sel.log.energy && `Energy: ${sel.log.energy}`,
                  sel.log.bbt != null && `BBT: ${sel.log.bbt} °C`,
                  sel.log.opkResult && `Ovulation test: ${sel.log.opkResult}`,
                  sel.log.hotFlashCount ? `Hot flashes: ${sel.log.hotFlashCount}` : null,
                  sel.log.symptoms.length ? `Symptoms: ${sel.log.symptoms.map(SYMPTOM_LABEL).join(', ')}` : null,
                ].filter(Boolean).join('\n')}
              </Text>
              {sel.log.notes ? <Text style={{ color: t.textMuted, fontStyle: 'italic' }}>“{sel.log.notes}”</Text> : null}
            </View>
          ) : (
            <Text style={{ color: t.textMuted }}>{isFuture ? 'Future day — nothing to log yet.' : 'Nothing logged this day.'}</Text>
          )}

          {!isFuture && (
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg, flexWrap: 'wrap' }}>
              <Button
                testID="cal-log-day"
                label={sel.log ? 'Edit this day' : 'Log this day'}
                icon={PenLine}
                compact
                onPress={() => navigation.navigate('LogDay', { day: selected })}
                style={{ flex: 1 }}
              />
              {showPredictions && !sel.log?.periodStart && (
                <Button testID="cal-period-start" label="Period started" variant="tonal" icon={Droplet} compact onPress={markPeriodStart} style={{ flex: 1 }} />
              )}
            </View>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', paddingVertical: space.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3, minHeight: 50 },
  dayCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  markers: { height: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginBottom: space.lg, paddingHorizontal: space.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 14, height: 14, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth },
});
