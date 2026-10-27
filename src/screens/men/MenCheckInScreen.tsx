import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { Store } from '../../storage/Store';
import { MenCheckIn } from '../../types';
import { formatDay } from '../../domain';
import { Card, ScreenHeader, Chip, Button, SectionLabel, useToast, space, type } from '../../ui';

const MOODS = [
  { id: 'great', emoji: '😄', label: 'Great' },
  { id: 'good', emoji: '🙂', label: 'Good' },
  { id: 'okay', emoji: '😐', label: 'Okay' },
  { id: 'low', emoji: '😔', label: 'Low' },
];
const ENERGY = [
  { id: 'high', emoji: '⚡', label: 'High' },
  { id: 'normal', emoji: '🔋', label: 'Normal' },
  { id: 'low', emoji: '🪫', label: 'Low' },
];
const STRESS = [
  { id: 'calm', emoji: '🧘', label: 'Calm' },
  { id: 'manageable', emoji: '😌', label: 'Manageable' },
  { id: 'stressed', emoji: '😰', label: 'Stressed' },
];

/** Partner's own private wellness check-in (one per local day). */
export default function MenCheckInScreen() {
  const toast = useToast();
  const { themeColors: t, today } = useApp();
  const [mood, setMood] = useState<string | null>(null);
  const [energy, setEnergy] = useState<string | null>(null);
  const [stress, setStress] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [history, setHistory] = useState<MenCheckIn[]>([]);
  const [existing, setExisting] = useState<MenCheckIn | null>(null);

  useFocusEffect(useCallback(() => {
    Store.getMenCheckIns().then(all => {
      setHistory(all.filter(e => e.day !== today).slice(-7).reverse());
      const mine = all.find(e => e.day === today) ?? null;
      setExisting(mine);
      setMood(mine?.mood ?? null);
      setEnergy(mine?.energy ?? null);
      setStress(mine?.stress ?? null);
      setNotes(mine?.notes ?? '');
    });
  }, [today]));

  const hasData = !!mood || !!energy || !!stress || notes.trim().length > 0;

  const save = async () => {
    const entry: MenCheckIn = {
      id: existing?.id ?? `${today}-${Date.now().toString(36)}`,
      day: today,
      date: today,
      loggedAt: new Date().toISOString(),
      mood, energy, stress, notes: notes.trim(),
    };
    const all = await Store.saveMenCheckIn(entry);
    setExisting(entry);
    setHistory(all.filter(e => e.day !== today).slice(-7).reverse());
    toast.show(existing ? 'Check-in updated' : 'Check-in saved');
  };

  const Row = ({ title, items, value, onChange }: { title: string; items: typeof MOODS; value: string | null; onChange: (v: string | null) => void }) => (
    <Card>
      <Text style={{ ...type.heading, color: t.text, marginBottom: space.md }}>{title}</Text>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {items.map(i => (
          <Chip key={i.id} emoji={i.emoji} label={i.label} selected={value === i.id} onPress={() => onChange(value === i.id ? null : i.id)} style={{ flex: 1 }} />
        ))}
      </View>
    </Card>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: t.background }]}>
      <ScreenHeader title="Daily" accent="check-in" subtitle={`${formatDay(today, { weekday: 'long', month: 'short', day: 'numeric' })}${existing ? ' · editing' : ''}`} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
        <Row title="Mood" items={MOODS} value={mood} onChange={setMood} />
        <Row title="Energy" items={ENERGY} value={energy} onChange={setEnergy} />
        <Row title="Stress" items={STRESS} value={stress} onChange={setStress} />
        <Card>
          <Text style={{ ...type.heading, color: t.text, marginBottom: space.md }}>Notes</Text>
          <TextInput
            style={[styles.notes, { borderColor: t.border, color: t.text, backgroundColor: t.surface }]}
            placeholder="Private to you"
            placeholderTextColor={t.subtext}
            value={notes}
            onChangeText={setNotes}
            multiline
            accessibilityLabel="Notes"
          />
        </Card>
        <Button label={existing ? 'Update check-in' : 'Save check-in'} onPress={save} disabled={!hasData} />

        {history.length > 0 && (
          <>
            <SectionLabel style={{ marginTop: space.xl }}>Last 7 days</SectionLabel>
            <Card>
              {history.map((e, i) => (
                <View key={e.id} style={[styles.historyRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }]}>
                  <Text style={{ ...type.label, color: t.text, width: 80 }}>{formatDay(e.day, { weekday: 'short', day: 'numeric' })}</Text>
                  <Text style={{ flex: 1, color: t.textMuted }} numberOfLines={1}>
                    {[e.mood, e.energy && `${e.energy} energy`, e.stress].filter(Boolean).join(' · ') || 'Notes only'}
                  </Text>
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notes: { borderWidth: 1.5, borderRadius: 14, padding: space.md, minHeight: 88, fontSize: 16, textAlignVertical: 'top' },
  historyRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
});
