import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, Alert, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, Footprints, Trash2 } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { AppMode, KickSession, LogDay } from '../types';
import { addDays, formatDay } from '../domain';
import { Card, Chip, Button, IconButton, ScreenHeader, SettingsRow, Banner, useToast, space, type } from '../ui';
import { MicButton } from '../ui/MicButton';
import { extractLog, isEmpty } from '../ai/voice/extractLog';

const COMMON_SYMPTOMS = [
  { id: 'cramps', emoji: '😣', label: 'Cramps' },
  { id: 'headache', emoji: '🤕', label: 'Headache' },
  { id: 'bloating', emoji: '🎈', label: 'Bloating' },
  { id: 'fatigue', emoji: '😩', label: 'Fatigue' },
  { id: 'backache', emoji: '🔙', label: 'Back pain' },
  { id: 'nausea', emoji: '🤢', label: 'Nausea' },
];

const MOODS = [
  { id: 'great', emoji: '😊', label: 'Great' },
  { id: 'good', emoji: '🙂', label: 'Good' },
  { id: 'okay', emoji: '😐', label: 'Okay' },
  { id: 'down', emoji: '😔', label: 'Down' },
  { id: 'stressed', emoji: '😰', label: 'Stressed' },
  { id: 'irritable', emoji: '😤', label: 'Irritable' },
];

const ENERGY = [
  { id: 'high', emoji: '⚡', label: 'High' },
  { id: 'normal', emoji: '🔋', label: 'Normal' },
  { id: 'low', emoji: '🪫', label: 'Low' },
];

const FLOW_OPTIONS = [
  { id: 'spotting', emoji: '💧', label: 'Spotting' },
  { id: 'light', emoji: '🩸', label: 'Light' },
  { id: 'medium', emoji: '🩸', label: 'Medium' },
  { id: 'heavy', emoji: '🩸', label: 'Heavy' },
];

const MUCUS_OPTIONS = [
  { id: 'dry', emoji: '🏜️', label: 'Dry' },
  { id: 'sticky', emoji: '🍯', label: 'Sticky' },
  { id: 'creamy', emoji: '🥛', label: 'Creamy' },
  { id: 'eggwhite', emoji: '💧', label: 'Egg white' },
];

const SLEEP_OPTIONS = [
  { id: 'good', emoji: '😴', label: 'Good' },
  { id: 'fair', emoji: '🥱', label: 'Fair' },
  { id: 'poor', emoji: '😵', label: 'Poor' },
];

const MODE_EXTRAS: Record<AppMode, { id: string; emoji: string; label: string }[]> = {
  period: [
    { id: 'pms', emoji: '😤', label: 'PMS' },
    { id: 'cravings', emoji: '🍫', label: 'Cravings' },
    { id: 'breast_tenderness', emoji: '🎯', label: 'Tender breasts' },
  ],
  conceive: [
    { id: 'ovulation_pain', emoji: '🥚', label: 'Ovulation pain' },
    { id: 'breast_tenderness', emoji: '🎯', label: 'Tender breasts' },
    { id: 'cravings', emoji: '🍫', label: 'Cravings' },
  ],
  pregnancy: [
    { id: 'morning_sickness', emoji: '🤮', label: 'Morning sickness' },
    { id: 'heartburn', emoji: '🔥', label: 'Heartburn' },
    { id: 'swelling', emoji: '🦶', label: 'Swelling' },
    { id: 'contractions', emoji: '⚡', label: 'Contractions' },
  ],
  perimenopause: [
    { id: 'hot_flash', emoji: '🔥', label: 'Hot flash' },
    { id: 'night_sweats', emoji: '🌙', label: 'Night sweats' },
    { id: 'brain_fog', emoji: '🌫️', label: 'Brain fog' },
    { id: 'joint_pain', emoji: '🦴', label: 'Joint pain' },
  ],
};

const MODE_SECTIONS: Record<AppMode, { flow: boolean; fertility: boolean; kicks: boolean; hotFlashes: boolean; sleep: boolean }> = {
  period: { flow: true, fertility: false, kicks: false, hotFlashes: false, sleep: true },
  conceive: { flow: true, fertility: true, kicks: false, hotFlashes: false, sleep: true },
  pregnancy: { flow: true, fertility: false, kicks: true, hotFlashes: false, sleep: true },
  perimenopause: { flow: true, fertility: false, kicks: false, hotFlashes: true, sleep: true },
};

type LogRoute = RouteProp<{ Log: { day?: LogDay; periodStart?: boolean } | undefined }, 'Log'>;

export default function SymptomLoggerScreen() {
  const navigation = useNavigation();
  const route = useRoute<LogRoute>();
  const toast = useToast();
  const { themeColors: t, currentMode, saveLog, deleteLog, getLog, today, user, pregnancy } = useApp();
  const sections = MODE_SECTIONS[currentMode];
  const isStackRoute = route.name === ('LogDay' as string);
  const [day, setDay] = useState<LogDay>(route.params?.day ?? today);

  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [mood, setMood] = useState<string | null>(null);
  const [energy, setEnergy] = useState<string | null>(null);
  const [flow, setFlow] = useState<string | null>(null);
  const [periodStart, setPeriodStart] = useState(false);
  const [periodEnd, setPeriodEnd] = useState(false);
  const [bbt, setBbt] = useState('');
  const [mucus, setMucus] = useState<string | null>(null);
  const [opk, setOpk] = useState<'positive' | 'negative' | null>(null);
  const [kickSessions, setKickSessions] = useState<KickSession[]>([]);
  const [hotFlashes, setHotFlashes] = useState(0);
  const [sleep, setSleep] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [bbtError, setBbtError] = useState<string | null>(null);
  const existing = getLog(day, currentMode);

  // Follow route params (Calendar → "Log this day", Dashboard → "It started")
  useEffect(() => {
    if (route.params?.day) setDay(route.params.day);
  }, [route.params?.day]);

  // Prefill from the stored log whenever the day or mode changes
  useEffect(() => {
    const log = getLog(day, currentMode);
    setSymptoms(log?.symptoms ?? []);
    setMood(log?.mood ?? null);
    setEnergy(log?.energy ?? null);
    setFlow(log?.flow ?? (route.params?.periodStart && day === route.params.day ? 'medium' : null));
    setPeriodStart(log?.periodStart ?? (!!route.params?.periodStart && day === route.params?.day));
    setPeriodEnd(log?.periodEnd ?? false);
    setBbt(log?.bbt != null ? String(log.bbt) : '');
    setMucus(log?.cervicalMucus ?? null);
    setOpk(log?.opkResult ?? null);
    setKickSessions(log?.kickSessions ?? []);
    setHotFlashes(log?.hotFlashCount ?? 0);
    setSleep(log?.sleepQuality ?? null);
    setNotes(log?.notes ?? '');
    setBbtError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, currentMode]);

  const hasData = symptoms.length > 0 || !!mood || !!energy || !!flow || periodStart || periodEnd || !!bbt || !!mucus || !!opk
    || kickSessions.length > 0 || hotFlashes > 0 || !!sleep || notes.trim().length > 0;

  const toggle = (id: string) => setSymptoms(prev => (prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]));

  const handleSave = async () => {
    let bbtNum: number | null = null;
    if (bbt.trim()) {
      bbtNum = parseFloat(bbt.replace(',', '.'));
      if (isNaN(bbtNum) || bbtNum < 34 || bbtNum > 42) {
        setBbtError('Enter a temperature between 34.0 and 42.0 °C');
        return;
      }
    }
    await saveLog({
      id: existing?.id,
      day,
      mode: currentMode,
      symptoms,
      mood,
      energy,
      flow,
      periodStart: periodStart || undefined,
      periodEnd: periodEnd || undefined,
      bbt: bbtNum,
      cervicalMucus: mucus,
      opkResult: opk,
      kickSessions: kickSessions.length ? kickSessions : undefined,
      hotFlashCount: sections.hotFlashes ? hotFlashes : null,
      sleepQuality: sleep,
      notes: notes.trim(),
    });
    toast.show(existing ? 'Log updated — predictions refreshed' : 'Saved — predictions refreshed');
    if (isStackRoute) navigation.goBack();
  };

  const handleClear = () => {
    Alert.alert('Clear this day?', `Remove everything logged for ${formatDay(day, { weekday: 'long', month: 'long', day: 'numeric' })}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => { await deleteLog(day, currentMode); toast.show('Day cleared', 'info'); } },
    ]);
  };

  const onVoiceText = useCallback((text: string) => {
    const e = extractLog(text);
    if (isEmpty(e)) {
      setNotes(prev => (prev ? `${prev} ${text}` : text));
      toast.show('Added what you said to notes', 'info');
      return;
    }
    setSymptoms(prev => [...new Set([...prev, ...e.symptoms])]);
    if (e.mood) setMood(e.mood);
    if (e.energy) setEnergy(e.energy);
    if (e.flow && sections.flow) setFlow(e.flow);
    if (e.periodStart) setPeriodStart(true);
    if (e.bbt != null && sections.fertility) setBbt(String(e.bbt));
    if (e.hotFlashes != null && sections.hotFlashes) setHotFlashes(e.hotFlashes);
    toast.show('Filled in from your voice — check and save', 'info');
  }, [sections, toast]);

  const onVoiceError = useCallback((m: string) => toast.show(m, 'error'), [toast]);

  const allSymptoms = useMemo(() => {
    const seen = new Set<string>();
    return [...COMMON_SYMPTOMS, ...MODE_EXTRAS[currentMode]].filter(s => (seen.has(s.id) ? false : (seen.add(s.id), true)));
  }, [currentMode]);

  const isToday = day === today;
  const dateLabel = isToday ? 'Today' : formatDay(day, { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: t.background }]}>
      <ScreenHeader
        title={isToday ? 'Log today' : 'Log a day'}
        subtitle={`${dateLabel}${existing ? ' · editing' : ''}`}
        onBack={isStackRoute ? () => navigation.goBack() : undefined}
        right={<MicButton testID="log-mic" language={user?.language ?? 'en'} onText={onVoiceText} onError={onVoiceError} />}
      />

      {/* Day switcher */}
      <View style={[styles.dayBar, { backgroundColor: t.card, borderBottomColor: t.border }]}>
        <IconButton icon={ChevronLeft} label="Previous day" onPress={() => setDay(d => addDays(d, -1))} testID="log-prev-day" />
        <Text style={{ ...type.label, color: t.text }} accessibilityLiveRegion="polite">
          {formatDay(day, { weekday: 'short', month: 'short', day: 'numeric' })}
        </Text>
        <IconButton icon={ChevronRight} label="Next day" onPress={() => setDay(d => addDays(d, 1))} disabled={isToday} testID="log-next-day" />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          {currentMode === 'pregnancy' && flow && (
            <Banner severity="urgent" title="Bleeding during pregnancy" body="Contact your midwife or doctor today. If it is heavy or painful, call emergency services." />
          )}

          <Card>
            <Text style={[styles.sectionTitle, { color: t.text }]}>How are you feeling?</Text>
            <View style={styles.grid}>
              {MOODS.map(m => (
                <Chip key={m.id} emoji={m.emoji} label={m.label} selected={mood === m.id}
                  onPress={() => setMood(mood === m.id ? null : m.id)} style={styles.third} testID={`mood-${m.id}`} />
              ))}
            </View>
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: t.text }]}>Energy</Text>
            <View style={styles.row}>
              {ENERGY.map(e => (
                <Chip key={e.id} emoji={e.emoji} label={e.label} selected={energy === e.id}
                  onPress={() => setEnergy(energy === e.id ? null : e.id)} style={{ flex: 1 }} testID={`energy-${e.id}`} />
              ))}
            </View>
          </Card>

          {sections.flow && (
            <Card>
              <Text style={[styles.sectionTitle, { color: t.text }]}>{currentMode === 'pregnancy' ? 'Any bleeding?' : 'Flow'}</Text>
              <View style={styles.row}>
                {FLOW_OPTIONS.map(f => (
                  <Chip key={f.id} emoji={f.emoji} label={f.label} selected={flow === f.id} color={t.primaryStrong}
                    onPress={() => setFlow(flow === f.id ? null : f.id)} style={{ flex: 1 }} testID={`flow-${f.id}`} />
                ))}
              </View>
              {currentMode !== 'pregnancy' && (
                <View style={{ marginTop: space.sm }}>
                  <SettingsRow first label="My period started this day" toggle={{ value: periodStart, onChange: v => { setPeriodStart(v); if (v) { setPeriodEnd(false); if (!flow || flow === 'spotting') setFlow('medium'); } } }} testID="toggle-period-start" />
                  <SettingsRow label="My period ended this day" toggle={{ value: periodEnd, onChange: v => { setPeriodEnd(v); if (v) setPeriodStart(false); } }} testID="toggle-period-end" />
                  <Text style={[styles.hint, { color: t.subtext }]}>Spotting never counts as a new period. Mark the start yourself if Luna gets it wrong.</Text>
                </View>
              )}
            </Card>
          )}

          {sections.fertility && (
            <Card>
              <Text style={[styles.sectionTitle, { color: t.text }]}>Fertility signs</Text>
              <Text style={[styles.label, { color: t.textMuted }]}>Basal body temperature (°C)</Text>
              <TextInput
                testID="bbt-input"
                style={[styles.input, { borderColor: bbtError ? t.danger : t.border, color: t.text, backgroundColor: t.surface }]}
                placeholder="e.g. 36.5"
                placeholderTextColor={t.subtext}
                value={bbt}
                onChangeText={v => { setBbt(v); setBbtError(null); }}
                keyboardType="decimal-pad"
                maxLength={5}
                accessibilityLabel="Basal body temperature in degrees Celsius"
              />
              {bbtError
                ? <Text style={[styles.hint, { color: t.danger }]} accessibilityLiveRegion="polite">{bbtError}</Text>
                : <Text style={[styles.hint, { color: t.subtext }]}>Measure first thing in the morning, before getting up.</Text>}

              <Text style={[styles.label, { color: t.textMuted, marginTop: space.lg }]}>Cervical mucus</Text>
              <View style={styles.row}>
                {MUCUS_OPTIONS.map(m => (
                  <Chip key={m.id} emoji={m.emoji} label={m.label} selected={mucus === m.id}
                    onPress={() => setMucus(mucus === m.id ? null : m.id)} style={{ flex: 1 }} />
                ))}
              </View>

              <Text style={[styles.label, { color: t.textMuted, marginTop: space.lg }]}>Ovulation test (OPK)</Text>
              <View style={styles.row}>
                <Chip emoji="✅" label="Positive" selected={opk === 'positive'} onPress={() => setOpk(opk === 'positive' ? null : 'positive')} style={{ flex: 1 }} testID="opk-positive" />
                <Chip emoji="➖" label="Negative" selected={opk === 'negative'} onPress={() => setOpk(opk === 'negative' ? null : 'negative')} style={{ flex: 1 }} />
              </View>
            </Card>
          )}

          {sections.kicks && (
            <KickCounter sessions={kickSessions} onChange={setKickSessions} week={pregnancy?.week ?? 0} />
          )}

          {sections.hotFlashes && (
            <Card>
              <Text style={[styles.sectionTitle, { color: t.text }]}>Hot flashes</Text>
              <Counter value={hotFlashes} onChange={setHotFlashes} label="hot flashes" />
            </Card>
          )}

          {sections.sleep && (
            <Card>
              <Text style={[styles.sectionTitle, { color: t.text }]}>Sleep last night</Text>
              <View style={styles.row}>
                {SLEEP_OPTIONS.map(s => (
                  <Chip key={s.id} emoji={s.emoji} label={s.label} selected={sleep === s.id}
                    onPress={() => setSleep(sleep === s.id ? null : s.id)} style={{ flex: 1 }} />
                ))}
              </View>
            </Card>
          )}

          <Card>
            <Text style={[styles.sectionTitle, { color: t.text }]}>Symptoms{symptoms.length ? ` · ${symptoms.length}` : ''}</Text>
            <View style={styles.grid}>
              {allSymptoms.map(s => (
                <Chip key={s.id} emoji={s.emoji} label={s.label} selected={symptoms.includes(s.id)}
                  onPress={() => toggle(s.id)} style={styles.third} testID={`symptom-${s.id}`} />
              ))}
            </View>
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: t.text }]}>Notes</Text>
            <TextInput
              style={[styles.input, styles.notes, { borderColor: t.border, color: t.text, backgroundColor: t.surface }]}
              placeholder="Anything else? Only you (and Luna on this phone) can see this."
              placeholderTextColor={t.subtext}
              value={notes}
              onChangeText={setNotes}
              multiline
              accessibilityLabel="Notes"
            />
          </Card>

          {existing && (
            <Button label="Clear this day" variant="danger" icon={Trash2} onPress={handleClear} />
          )}
        </ScrollView>

        <View style={[styles.saveBar, { backgroundColor: t.card, borderTopColor: t.border }]}>
          <Button testID="log-save" label={existing ? 'Update log' : 'Save log'} onPress={handleSave} disabled={!hasData} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Counter({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const t = useApp().themeColors;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xl }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Fewer ${label}`} onPress={() => onChange(Math.max(0, value - 1))}
        style={[styles.counterBtn, { backgroundColor: t.surface }]}>
        <Text style={{ fontSize: 26, color: t.text }}>−</Text>
      </Pressable>
      <Text style={{ fontSize: 34, fontWeight: '800', color: t.primaryStrong, minWidth: 60, textAlign: 'center' }} accessibilityLabel={`${value} ${label}`}>{value}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`More ${label}`} onPress={() => onChange(value + 1)}
        style={[styles.counterBtn, { backgroundColor: t.primaryStrong }]}>
        <Text style={{ fontSize: 26, color: '#FFFFFF' }}>+</Text>
      </Pressable>
    </View>
  );
}

/** Kick counting as timed sessions: 10 movements, or stop at 2 hours (ACOG guidance, 03 A8). */
function KickCounter({ sessions, onChange, week }: { sessions: KickSession[]; onChange: (s: KickSession[]) => void; week: number }) {
  const t = useApp().themeColors;
  const [active, setActive] = useState<{ start: number; count: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (active) timer.current = setInterval(() => setNow(Date.now()), 1000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [active]);

  const finish = useCallback((count: number, start: number) => {
    onChange([...sessions, { start: new Date(start).toISOString(), end: new Date().toISOString(), count }]);
    setActive(null);
  }, [sessions, onChange]);

  useEffect(() => {
    if (active && now - active.start >= 2 * 3600_000) finish(active.count, active.start);
  }, [now, active, finish]);

  const elapsedMin = active ? Math.floor((now - active.start) / 60000) : 0;
  const last = sessions[sessions.length - 1];

  return (
    <Card>
      <Text style={[styles.sectionTitle, { color: t.text }]}>Baby movements</Text>
      {week < 28 && <Text style={[styles.hint, { color: t.subtext, marginBottom: space.sm }]}>Kick counting is recommended from 28 weeks. You can practise now.</Text>}
      {active ? (
        <View style={{ alignItems: 'center', gap: space.md }}>
          <Pressable
            testID="kick-tap"
            onPress={() => {
              const count = active.count + 1;
              if (count >= 10) finish(count, active.start);
              else setActive({ ...active, count });
            }}
            accessibilityRole="button"
            accessibilityLabel={`Count a movement. ${active.count} of 10 so far`}
            style={[styles.kickTap, { backgroundColor: t.primaryStrong }]}
          >
            <Footprints color="#FFFFFF" size={36} />
            <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '800' }}>{active.count}/10</Text>
          </Pressable>
          <Text style={{ color: t.textMuted }}>{elapsedMin} min · tap each time you feel a movement</Text>
          <Button label="Stop session" variant="outline" compact onPress={() => finish(active.count, active.start)} />
        </View>
      ) : (
        <>
          {last && (
            <Text style={{ color: t.textMuted, marginBottom: space.sm }}>
              Last session: {last.count} movements in {Math.max(1, Math.round((new Date(last.end).getTime() - new Date(last.start).getTime()) / 60000))} min
            </Text>
          )}
          <Button testID="kick-start" label="Start a kick count" icon={Footprints} variant="tonal" onPress={() => setActive({ start: Date.now(), count: 0 })} />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  dayBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionTitle: { ...type.heading, marginBottom: space.md },
  label: { ...type.label, marginBottom: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  third: { width: '31.5%' },
  row: { flexDirection: 'row', gap: space.sm },
  hint: { fontSize: 13, lineHeight: 18, marginTop: space.sm },
  input: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: space.lg, minHeight: 52, fontSize: 16 },
  notes: { minHeight: 96, paddingTop: space.md, textAlignVertical: 'top' },
  counterBtn: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  kickTap: { width: 160, height: 160, borderRadius: 80, alignItems: 'center', justifyContent: 'center', gap: 4 },
  saveBar: { padding: space.lg, borderTopWidth: StyleSheet.hairlineWidth },
});
