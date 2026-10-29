import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import {
  ChevronLeft, ChevronRight, PenLine, Droplet, Sparkles, Flame, Moon, Baby,
  Check, Footprints, AlertTriangle, Calendar as CalendarIcon,
} from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import {
  toISODay, parseISODay, formatDay, addDays, daysBetween, BLEEDING_FLOWS,
  getConceptionInfo, pregnancyStatusOnDay,
} from '../domain';
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
  const { themeColors: t, currentMode, cycle, pregnancy, peri, logs, today, saveLog, getLog } = useApp();
  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState<LogDay>(today);

  const view = useMemo(() => {
    const now = parseISODay(today);
    return new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  }, [monthOffset, today]);

  const cells = useMemo(() => monthGrid(view.getFullYear(), view.getMonth()), [view]);
  const monthLabel = view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // ── Mode-specific prediction sets ──
  const showPredictions = currentMode === 'period' || currentMode === 'conceive';
  const periodSet = useMemo(() => new Set(showPredictions ? cycle?.periodDates ?? [] : []), [cycle, showPredictions]);
  const fertileSet = useMemo(() => new Set(showPredictions ? cycle?.fertileDates ?? [] : []), [cycle, showPredictions]);
  const peakSet = useMemo(() => new Set(showPredictions ? cycle?.peakDays ?? [] : []), [cycle, showPredictions]);
  const ovulationDay = showPredictions ? cycle?.ovulationDate : undefined;

  // Prediction range uncertainty (±sigma window around next period)
  const predictionRangeSet = useMemo(() => {
    if (!showPredictions || !cycle || !cycle.nextPeriodRange) return new Set<string>();
    const s = new Set<string>();
    const start = cycle.nextPeriodRange.start;
    const end = cycle.nextPeriodRange.end;
    const count = daysBetween(start, end);
    for (let i = 0; i <= count; i++) s.add(addDays(start, i));
    return s;
  }, [showPredictions, cycle]);

  const logByDay = useMemo(() => {
    const m = new Map<LogDay, SymptomLog>();
    for (const l of logs) if (l.mode === currentMode || !m.has(l.day)) m.set(l.day, l);
    return m;
  }, [logs, currentMode]);

  // Set of all logged bleeding days for continuous span calculations
  const bleedingDaysSet = useMemo(() => {
    const s = new Set<LogDay>();
    for (const [day, l] of logByDay.entries()) {
      if (l.periodStart || (l.flow && BLEEDING_FLOWS.has(l.flow))) s.add(day);
    }
    return s;
  }, [logByDay]);

  // Gestational status helper for pregnancy mode
  const getPregnancyStatus = useCallback((d: LogDay) => {
    if (currentMode !== 'pregnancy' || !pregnancy?.lmp) return null;
    return pregnancyStatusOnDay(pregnancy.lmp, d);
  }, [currentMode, pregnancy?.lmp]);

  // ── Describe each day cell ──
  const describe = useCallback((day: LogDay) => {
    const log = logByDay.get(day);
    const bleeding = !!log && (log.periodStart || (!!log.flow && BLEEDING_FLOWS.has(log.flow)));
    const spotting = log?.flow === 'spotting';
    const predictedPeriod = !bleeding && periodSet.has(day) && day >= today;
    const inPredictionRange = !bleeding && predictionRangeSet.has(day) && day >= today;
    const isOvulation = showPredictions && day === ovulationDay;
    const isFertile = showPredictions && fertileSet.has(day);
    const isPeak = showPredictions && peakSet.has(day);
    const isDueDate = currentMode === 'pregnancy' && !!pregnancy && day === pregnancy.dueDate;
    const pregDay = currentMode === 'pregnancy' && pregnancy?.lmp ? pregnancyStatusOnDay(pregnancy.lmp, day) : null;
    const hasKicks = !!log?.kickSessions && log.kickSessions.length > 0;
    const hotFlashes = (currentMode === 'perimenopause' && typeof log?.hotFlashCount === 'number') ? log.hotFlashCount : 0;
    const poorSleep = currentMode === 'perimenopause' && log?.sleepQuality === 'poor';

    return {
      log,
      bleeding,
      flow: log?.flow,
      spotting,
      predictedPeriod,
      inPredictionRange,
      ovulation: isOvulation,
      fertile: isFertile,
      peak: isPeak,
      due: isDueDate,
      pregMilestone: pregDay?.milestone,
      pregWeek: pregDay?.week,
      hasKicks,
      hotFlashes,
      poorSleep,
    };
  }, [logByDay, periodSet, today, predictionRangeSet, showPredictions, ovulationDay, fertileSet, peakSet, currentMode, pregnancy]);

  // ── Span calculation for connected Flo/Clue pill spans ──
  const getSpanType = useCallback((day: LogDay, set: Set<LogDay>, cellIndex: number) => {
    const isDayInSet = set.has(day);
    if (!isDayInSet) return 'none';
    const dayOfWeek = cellIndex % 7;
    const prevDay = addDays(day, -1);
    const nextDay = addDays(day, 1);
    const hasPrev = dayOfWeek > 0 && set.has(prevDay);
    const hasNext = dayOfWeek < 6 && set.has(nextDay);

    if (hasPrev && hasNext) return 'middle';
    if (!hasPrev && hasNext) return 'start';
    if (hasPrev && !hasNext) return 'end';
    return 'single';
  }, []);

  const cellStyle = useCallback((day: LogDay, index: number) => {
    const d = describe(day);
    let bg = 'transparent';
    let fg = t.text;
    let border = 'transparent';
    let dashed = false;
    let spanType = 'single';

    if (d.due) {
      bg = t.primaryStrong;
      fg = '#FFFFFF';
    } else if (d.bleeding) {
      bg = t.primaryStrong;
      fg = '#FFFFFF';
      spanType = getSpanType(day, bleedingDaysSet, index);
    } else if (d.predictedPeriod) {
      bg = t.tint;
      fg = t.primaryStrong;
      border = t.primary;
      dashed = true;
      spanType = getSpanType(day, periodSet, index);
    } else if (d.ovulation) {
      bg = cycle?.ovulationStatus === 'confirmed' ? '#D97706' : cycle?.ovulationStatus === 'likely' ? t.warning : t.warningTint;
      fg = cycle?.ovulationStatus === 'predicted' ? t.warning : '#FFFFFF';
      border = t.warning;
      dashed = cycle?.ovulationStatus === 'predicted';
    } else if (d.peak) {
      bg = '#FDE68A';
      fg = '#78350F';
      border = '#F59E0B';
    } else if (d.fertile) {
      bg = t.warningTint;
      fg = t.warning;
    } else if (d.pregMilestone) {
      bg = t.tint;
      fg = t.primaryStrong;
      border = t.primary;
    }

    if (day === today && bg === 'transparent') {
      border = t.primaryStrong;
    }

    return { bg, fg, border, dashed, spanType, d };
  }, [describe, t, getSpanType, bleedingDaysSet, periodSet, cycle?.ovulationStatus, today]);

  const a11yLabel = useCallback((day: LogDay) => {
    const d = describe(day);
    const parts = [formatDay(day, { weekday: 'long', month: 'long', day: 'numeric' })];
    if (day === today) parts.push('today');
    if (d.bleeding) parts.push(`period logged (${d.flow ?? 'flow'})`);
    if (d.spotting) parts.push('spotting');
    if (d.predictedPeriod) parts.push('period predicted');
    if (d.ovulation) parts.push(`ovulation ${cycle?.ovulationStatus ?? 'predicted'}`);
    else if (d.peak) parts.push('peak fertility');
    else if (d.fertile) parts.push('fertile window');
    if (d.due) parts.push('due date');
    if (d.pregMilestone) parts.push(d.pregMilestone);
    if (d.hotFlashes > 0) parts.push(`${d.hotFlashes} hot flashes`);
    if (d.poorSleep) parts.push('poor sleep');
    if (d.hasKicks) parts.push('kick session logged');
    if (d.log) parts.push('has log');
    return parts.join(', ');
  }, [describe, today, cycle?.ovulationStatus]);

  const sel = describe(selected);
  const isFuture = selected > today;
  const isSelectedToday = selected === today;

  // Conception probability for selected day (Conceive mode)
  const conception = useMemo(() => {
    return currentMode === 'conceive' ? getConceptionInfo(cycle, selected) : null;
  }, [currentMode, cycle, selected]);

  // Gestational status for selected day (Pregnancy mode)
  const selPreg = useMemo(() => {
    return getPregnancyStatus(selected);
  }, [getPregnancyStatus, selected]);

  // ── Quick 1-tap Actions ──
  const baseLogFallback = { symptoms: [], mood: null, energy: null, flow: null, notes: '' };

  const setQuickFlow = async (flowValue: 'spotting' | 'light' | 'medium' | 'heavy' | null) => {
    const existing = getLog(selected, currentMode);
    if (flowValue === null) {
      // Clear flow
      if (existing) {
        await saveLog({
          ...existing,
          id: existing.id,
          day: selected,
          mode: currentMode,
          flow: null,
          periodStart: undefined,
          periodEnd: undefined,
        });
      }
      toast.show(`Flow cleared for ${formatDay(selected)}`);
      return;
    }

    const isStart = flowValue !== 'spotting' && !existing?.periodStart && !existing?.flow;
    await saveLog({
      ...(existing ?? baseLogFallback),
      id: existing?.id,
      day: selected,
      mode: currentMode,
      flow: flowValue,
      periodStart: isStart || existing?.periodStart,
      periodEnd: undefined,
    });
    toast.show(`Flow set to ${flowValue} for ${formatDay(selected)}`);
  };

  const togglePeriodStart = async () => {
    const existing = getLog(selected, currentMode);
    const nextStart = !existing?.periodStart;
    await saveLog({
      ...(existing ?? baseLogFallback),
      id: existing?.id,
      day: selected,
      mode: currentMode,
      flow: existing?.flow && existing.flow !== 'spotting' ? existing.flow : (nextStart ? 'medium' : null),
      periodStart: nextStart || undefined,
      periodEnd: undefined,
    });
    toast.show(nextStart ? `Period start saved for ${formatDay(selected)}` : `Period start removed for ${formatDay(selected)}`);
  };

  const togglePeriodEnd = async () => {
    const existing = getLog(selected, currentMode);
    const nextEnd = !existing?.periodEnd;
    await saveLog({
      ...(existing ?? baseLogFallback),
      id: existing?.id,
      day: selected,
      mode: currentMode,
      periodEnd: nextEnd || undefined,
      periodStart: undefined,
    });
    toast.show(nextEnd ? `Period end saved for ${formatDay(selected)}` : `Period end removed for ${formatDay(selected)}`);
  };

  const quickToggleOpk = async (result: 'positive' | 'negative') => {
    const existing = getLog(selected, currentMode);
    const nextOpk = existing?.opkResult === result ? null : result;
    await saveLog({
      ...(existing ?? baseLogFallback),
      id: existing?.id,
      day: selected,
      mode: currentMode,
      opkResult: nextOpk,
    });
    toast.show(nextOpk ? `OPK marked ${nextOpk} for ${formatDay(selected)}` : `OPK cleared`);
  };

  const adjustHotFlashes = async (delta: number) => {
    const existing = getLog(selected, currentMode);
    const cur = existing?.hotFlashCount ?? 0;
    const next = Math.max(0, cur + delta);
    await saveLog({
      ...(existing ?? baseLogFallback),
      id: existing?.id,
      day: selected,
      mode: currentMode,
      hotFlashCount: next,
    });
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: t.background }]}>
      <ScreenHeader
        title={
          currentMode === 'pregnancy' ? 'Pregnancy Calendar'
            : currentMode === 'conceive' ? 'Fertility & Ovulation'
            : currentMode === 'perimenopause' ? 'Cycle & Symptoms'
            : 'Cycle Calendar'
        }
        accent="calendar"
        right={
          cycle && showPredictions ? (
            <Badge
              label={
                cycle.confidence === 'established' ? 'Learned'
                  : cycle.confidence === 'irregular' ? 'Irregular'
                  : cycle.confidence === 'learning' ? 'Learning'
                  : 'From onboarding'
              }
              color={cycle.confidence === 'established' ? t.success : t.warning}
              bg={cycle.confidence === 'established' ? t.successTint : t.warningTint}
            />
          ) : pregnancy ? (
            <Badge label={`Week ${pregnancy.week}`} color={t.primaryStrong} bg={t.tint} icon={Baby} />
          ) : peri ? (
            <Badge label={peri.stageLabel} color={t.primaryStrong} bg={t.tint} />
          ) : undefined
        }
      />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}>
        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <IconButton icon={ChevronLeft} label="Previous month" onPress={() => setMonthOffset(o => o - 1)} />
          <Pressable onPress={() => { setMonthOffset(0); setSelected(today); }} accessibilityRole="button" accessibilityLabel={`${monthLabel}. Jump to today`}>
            <Text style={{ ...type.heading, color: t.text }}>{monthLabel}</Text>
          </Pressable>
          <IconButton icon={ChevronRight} label="Next month" onPress={() => setMonthOffset(o => o + 1)} />
        </View>

        {/* Calendar Grid Card */}
        <Card style={{ paddingHorizontal: space.xs, paddingVertical: space.sm }}>
          <View style={styles.week}>
            {WEEKDAYS.map(d => (
              <Text key={d} style={[styles.weekday, { color: t.subtext }]} accessibilityElementsHidden>
                {d.slice(0, 1)}
              </Text>
            ))}
          </View>
          <View style={styles.grid}>
            {cells.map((day, i) => {
              if (!day) return <View key={`e${i}`} style={styles.cell} />;
              const s = cellStyle(day, i);
              const isSel = day === selected;

              // Border radius logic for connected capsule spans
              const pillRadius = 20;
              const borderRadiusStyle = s.spanType === 'start'
                ? { borderTopLeftRadius: pillRadius, borderBottomLeftRadius: pillRadius, borderTopRightRadius: 4, borderBottomRightRadius: 4 }
                : s.spanType === 'end'
                ? { borderTopRightRadius: pillRadius, borderBottomRightRadius: pillRadius, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 }
                : s.spanType === 'middle'
                ? { borderRadius: 4 }
                : { borderRadius: pillRadius };

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
                  <View
                    style={[
                      styles.dayCircle,
                      borderRadiusStyle,
                      {
                        backgroundColor: s.bg,
                        borderColor: isSel ? t.text : s.border,
                        borderWidth: isSel ? 2.5 : (s.border !== 'transparent' ? 1.5 : 0),
                        borderStyle: s.dashed && !isSel ? 'dashed' : 'solid',
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 15, fontWeight: day === today ? '800' : '600', color: s.fg }}>
                      {parseInt(day.slice(8), 10)}
                    </Text>
                  </View>

                  {/* Multi-marker footer below the day cell */}
                  <View style={styles.markers}>
                    {s.d.spotting && <Droplet color={t.primaryStrong} size={9} fill={t.primaryStrong} />}
                    {s.d.ovulation && <Sparkles color={t.warning} size={9} />}
                    {s.d.hasKicks && <Footprints color={t.primaryStrong} size={9} />}
                    {s.d.hotFlashes > 0 && <Flame color="#EA580C" size={9} fill="#EA580C" />}
                    {s.d.poorSleep && <Moon color="#6B7280" size={9} />}
                    {s.d.log && !s.d.spotting && !s.d.hotFlashes && !s.d.hasKicks && (
                      <View style={[styles.dot, { backgroundColor: t.textMuted }]} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Mode-specific Legend */}
        <View style={styles.legend} accessibilityLabel="Calendar Legend">
          {(currentMode === 'pregnancy'
            ? [
                [t.primaryStrong, 'Due date'],
                [t.tint, 'Trimester milestone'],
                ['#3B82F6', 'Kicks logged'],
                [t.textMuted, 'Logged'],
              ]
            : currentMode === 'conceive'
            ? [
                ['#F59E0B', 'Peak fertility'],
                [t.warningTint, 'Fertile window'],
                [t.warning, 'Ovulation'],
                [t.primaryStrong, 'Period'],
                [t.textMuted, 'Logged'],
              ]
            : currentMode === 'perimenopause'
            ? [
                [t.primaryStrong, 'Bleeding'],
                [t.tint, 'Spotting'],
                ['#EA580C', 'Hot flash'],
                ['#6B7280', 'Poor sleep'],
                [t.textMuted, 'Logged'],
              ]
            : [
                [t.primaryStrong, 'Period'],
                [t.tint, 'Predicted period'],
                [t.warningTint, 'Fertile window'],
                [t.warning, 'Ovulation'],
                [t.textMuted, 'Logged'],
              ]
          ).map(([c, l]) => (
            <View key={l} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: c, borderColor: t.border }]} />
              <Text style={{ fontSize: 12, color: t.textMuted }}>{l}</Text>
            </View>
          ))}
        </View>

        {/* ── Interactive Day Inspector (Flo & Clue Style) ── */}
        <SectionLabel>
          {formatDay(selected, { weekday: 'long', month: 'long', day: 'numeric' })}
          {isSelectedToday ? ' · Today' : ''}
        </SectionLabel>

        <Card style={{ gap: space.md }}>
          {/* Status and Mode Badges */}
          <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' }}>
            {sel.bleeding && <Badge label={sel.log?.flow ? `Period · ${sel.log.flow}` : 'Period'} color="#FFFFFF" bg={t.primaryStrong} />}
            {sel.spotting && <Badge label="Spotting" color={t.primaryStrong} bg={t.tint} icon={Droplet} />}
            {sel.predictedPeriod && <Badge label="Predicted period" color={t.primaryStrong} bg={t.tint} />}
            {sel.ovulation && (
              <Badge
                label={`Ovulation · ${cycle?.ovulationStatus ?? 'predicted'}`}
                color="#FFFFFF"
                bg={cycle?.ovulationStatus === 'confirmed' ? '#D97706' : t.warning}
                icon={Sparkles}
              />
            )}
            {!sel.ovulation && sel.peak && <Badge label="Peak fertility" color="#78350F" bg="#FDE68A" />}
            {!sel.ovulation && !sel.peak && sel.fertile && <Badge label="Fertile window" color={t.warning} bg={t.warningTint} />}
            {sel.due && <Badge label="Due date" color="#FFFFFF" bg={t.primaryStrong} icon={Baby} />}
            {sel.pregMilestone && <Badge label={sel.pregMilestone} color={t.primaryStrong} bg={t.tint} />}
            {sel.hotFlashes > 0 && <Badge label={`${sel.hotFlashes} hot flashes`} color="#FFFFFF" bg="#EA580C" icon={Flame} />}
            {sel.poorSleep && <Badge label="Poor sleep" color="#374151" bg="#E5E7EB" icon={Moon} />}
          </View>

          {/* Mode-specific insights banner */}
          {conception && (
            <View style={[styles.insightBox, { backgroundColor: conception.level === 'peak' ? '#FEF3C7' : conception.level === 'high' ? t.warningTint : t.surface }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '700', fontSize: 15, color: conception.level === 'peak' ? '#92400E' : t.text }}>
                  {conception.chanceLabel}
                </Text>
                <Text style={{ fontWeight: '800', fontSize: 16, color: conception.level === 'peak' ? '#B45309' : t.primaryStrong }}>
                  {conception.percentage}
                </Text>
              </View>
              <Text style={{ fontSize: 13, color: t.textMuted, marginTop: 4, lineHeight: 18 }}>
                {conception.detail}
              </Text>
            </View>
          )}

          {selPreg && (
            <View style={[styles.insightBox, { backgroundColor: t.surface }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '700', fontSize: 15, color: t.text }}>
                  {selPreg.label} · Trimester {selPreg.trimester}
                </Text>
                <Badge label={`Day ${selPreg.gestationDays}`} color={t.primaryStrong} bg={t.tint} />
              </View>
              <Text style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>
                Baby is about the size of {selPreg.babySize}.
              </Text>
              {selPreg.milestone && (
                <Text style={{ fontSize: 13, fontWeight: '700', color: t.primaryStrong, marginTop: 4 }}>
                  🌟 Milestone: {selPreg.milestone}
                </Text>
              )}
            </View>
          )}

          {/* Quick Flow Selector (Interactive 1-Tap) */}
          {!isFuture && (currentMode === 'period' || currentMode === 'conceive' || currentMode === 'perimenopause') && (
            <View style={styles.quickSection}>
              <Text style={[styles.sectionSubtitle, { color: t.text }]}>Quick flow</Text>
              <View style={styles.flowRow}>
                {[
                  { id: null, label: 'None' },
                  { id: 'spotting', label: 'Spotting 💧' },
                  { id: 'light', label: 'Light 🩸' },
                  { id: 'medium', label: 'Medium 🩸' },
                  { id: 'heavy', label: 'Heavy 🩸' },
                ].map(opt => {
                  const isSelectedFlow = opt.id === null ? (!sel.log?.flow && !sel.bleeding) : sel.log?.flow === opt.id;
                  return (
                    <Pressable
                      key={opt.label}
                      onPress={() => setQuickFlow(opt.id as any)}
                      accessibilityRole="button"
                      accessibilityLabel={`Set flow to ${opt.label}`}
                      style={[
                        styles.quickFlowChip,
                        {
                          backgroundColor: isSelectedFlow ? t.primaryStrong : t.surface,
                          borderColor: isSelectedFlow ? t.primaryStrong : t.border,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: isSelectedFlow ? '#FFFFFF' : t.text }}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Conceive Mode: Quick OPK Result Toggle */}
          {!isFuture && currentMode === 'conceive' && (
            <View style={styles.quickSection}>
              <Text style={[styles.sectionSubtitle, { color: t.text }]}>Ovulation test (OPK)</Text>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Pressable
                  onPress={() => quickToggleOpk('positive')}
                  style={[
                    styles.quickActionPill,
                    {
                      backgroundColor: sel.log?.opkResult === 'positive' ? t.success : t.surface,
                      borderColor: sel.log?.opkResult === 'positive' ? t.success : t.border,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: sel.log?.opkResult === 'positive' ? '#FFFFFF' : t.text }}>
                    {sel.log?.opkResult === 'positive' ? '✓ OPK Positive' : 'OPK Positive'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => quickToggleOpk('negative')}
                  style={[
                    styles.quickActionPill,
                    {
                      backgroundColor: sel.log?.opkResult === 'negative' ? t.textMuted : t.surface,
                      borderColor: sel.log?.opkResult === 'negative' ? t.textMuted : t.border,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: sel.log?.opkResult === 'negative' ? '#FFFFFF' : t.text }}>
                    {sel.log?.opkResult === 'negative' ? '✓ OPK Negative' : 'OPK Negative'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Perimenopause Mode: Quick Hot Flash Counter */}
          {!isFuture && currentMode === 'perimenopause' && (
            <View style={styles.quickSection}>
              <Text style={[styles.sectionSubtitle, { color: t.text }]}>Hot flashes</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFEDD5', alignItems: 'center', justifyContent: 'center' }}>
                  <Flame color="#EA580C" size={20} fill="#EA580C" />
                </View>
                <Text style={{ fontSize: 20, fontWeight: '800', color: t.text, minWidth: 40, textAlign: 'center' }}>
                  {sel.hotFlashes}
                </Text>
                <Button label="−" compact variant="outline" onPress={() => adjustHotFlashes(-1)} disabled={sel.hotFlashes <= 0} />
                <Button label="+" compact variant="outline" onPress={() => adjustHotFlashes(1)} />
              </View>
            </View>
          )}

          {/* Pregnancy Mode: Kick Count Summary */}
          {!isFuture && currentMode === 'pregnancy' && sel.log?.kickSessions && sel.log.kickSessions.length > 0 && (
            <View style={styles.quickSection}>
              <Text style={[styles.sectionSubtitle, { color: t.text }]}>Baby movements</Text>
              <Text style={{ color: t.text, fontSize: 14 }}>
                {sel.log.kickSessions.reduce((acc, s) => acc + s.count, 0)} total movements logged across {sel.log.kickSessions.length} session{sel.log.kickSessions.length === 1 ? '' : 's'}.
              </Text>
            </View>
          )}

          {/* Detailed Log Summary */}
          {sel.log ? (
            <View style={{ gap: space.xs, marginTop: space.xs }}>
              <Text style={{ color: t.text, lineHeight: 22 }}>
                {[
                  sel.log.mood && `Mood: ${sel.log.mood}`,
                  sel.log.energy && `Energy: ${sel.log.energy}`,
                  sel.log.bbt != null && `BBT: ${sel.log.bbt} °C`,
                  sel.log.cervicalMucus && `Cervical mucus: ${sel.log.cervicalMucus}`,
                  sel.log.symptoms.length ? `Symptoms: ${sel.log.symptoms.map(SYMPTOM_LABEL).join(', ')}` : null,
                ].filter(Boolean).join('\n')}
              </Text>
              {sel.log.notes ? (
                <Text style={{ color: t.textMuted, fontStyle: 'italic', marginTop: 4 }}>“{sel.log.notes}”</Text>
              ) : null}
            </View>
          ) : (
            <Text style={{ color: t.textMuted }}>
              {isFuture ? 'Future day — predicted values based on your cycles.' : 'Nothing logged this day.'}
            </Text>
          )}

          {/* Action Buttons */}
          {!isFuture && (
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm, flexWrap: 'wrap' }}>
              <Button
                testID="cal-log-day"
                label={sel.log ? 'Edit full log' : 'Log this day'}
                icon={PenLine}
                compact
                onPress={() => navigation.navigate('LogDay', { day: selected })}
                style={{ flex: 1 }}
              />
              {showPredictions && (
                <Button
                  testID="cal-period-start"
                  label={sel.log?.periodStart ? 'Period started ✓' : 'Period started'}
                  variant={sel.log?.periodStart ? 'primary' : 'tonal'}
                  icon={Droplet}
                  compact
                  onPress={togglePeriodStart}
                  style={{ flex: 1 }}
                />
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
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3, minHeight: 52 },
  dayCircle: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  markers: { height: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, marginTop: 1 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.sm, marginBottom: space.lg, paddingHorizontal: space.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth },
  insightBox: { padding: space.sm, borderRadius: 12 },
  quickSection: { gap: space.xs, paddingTop: space.xs },
  sectionSubtitle: { fontSize: 13, fontWeight: '700' },
  flowRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  quickFlowChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  quickActionPill: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10, borderWidth: 1 },
});
