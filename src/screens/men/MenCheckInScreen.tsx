import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { Store } from '../../storage/Store';
import { MenCheckIn } from '../../types';
import { toISODay } from '../../services/CycleEngine';
import { Card, ScreenHeader, Chip, PrimaryButton, SectionLabel } from '../../ui';

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

/** Men-side personal wellness check-in — their own private data. */
export default function MenCheckInScreen() {
  const { themeColors } = useApp();
  const [mood, setMood] = useState<string | null>(null);
  const [energy, setEnergy] = useState<string | null>(null);
  const [stress, setStress] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [history, setHistory] = useState<MenCheckIn[]>([]);

  useFocusEffect(useCallback(() => {
    Store.getMenCheckIns().then(all => {
      setHistory(all.slice(-7).reverse());
      const today = all.find(e => e.date.slice(0, 10) === toISODay(new Date()));
      if (today) {
        setMood(today.mood);
        setEnergy(today.energy);
        setStress(today.stress);
        setNotes(today.notes);
      }
    });
  }, []));

  const hasData = !!mood || !!energy || !!stress || notes.trim().length > 0;

  const save = async () => {
    const entry: MenCheckIn = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      mood, energy, stress, notes: notes.trim(),
    };
    const all = await Store.saveMenCheckIn(entry);
    setHistory(all.slice(-7).reverse());
    Alert.alert('Saved ✓', 'Your check-in is stored locally on this device.');
  };

  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ScreenHeader title="Daily" accent="Check-In" subtitle={dateLabel} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <Card>
          <Text style={styles.sectionTitle}>🎭 Mood</Text>
          <View style={styles.chipRow}>
            {MOODS.map(m => (
              <Chip key={m.id} emoji={m.emoji} label={m.label} selected={mood === m.id}
                onPress={() => setMood(mood === m.id ? null : m.id)} style={{ width: '23%' }} />
            ))}
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>⚡ Energy</Text>
          <View style={styles.chipRow}>
            {ENERGY.map(e => (
              <Chip key={e.id} emoji={e.emoji} label={e.label} selected={energy === e.id}
                onPress={() => setEnergy(energy === e.id ? null : e.id)} style={{ flex: 1 }} />
            ))}
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>😮‍💨 Stress</Text>
          <View style={styles.chipRow}>
            {STRESS.map(s => (
              <Chip key={s.id} emoji={s.emoji} label={s.label} selected={stress === s.id}
                onPress={() => setStress(stress === s.id ? null : s.id)} style={{ flex: 1 }} />
            ))}
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>✏️ Notes</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Anything on your mind…"
            placeholderTextColor="#94a3b8"
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
          />
        </Card>

        <PrimaryButton label="Save check-in" onPress={save} disabled={!hasData} />

        {history.length > 0 && (
          <>
            <SectionLabel style={{ marginTop: 24 }}>Last 7 days</SectionLabel>
            <Card style={{ paddingVertical: 6 }}>
              {history.map((entry, i) => (
                <View key={entry.id} style={[styles.historyRow, i > 0 && styles.rowBorder]}>
                  <Text style={styles.historyDate}>
                    {new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}
                  </Text>
                  <Text style={styles.historyDetail}>
                    {[
                      entry.mood ? MOODS.find(m => m.id === entry.mood)?.emoji : null,
                      entry.energy ? ENERGY.find(e => e.id === entry.energy)?.emoji : null,
                      entry.stress ? STRESS.find(s => s.id === entry.stress)?.emoji : null,
                    ].filter(Boolean).join('  ') || '—'}
                  </Text>
                  {entry.notes ? <Text style={styles.historyNotes} numberOfLines={1}>{entry.notes}</Text> : <View style={{ flex: 1 }} />}
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
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#334155', marginBottom: 12 },
  chipRow: { flexDirection: 'row', gap: 8 },
  notesInput: {
    backgroundColor: '#f8fafc', borderRadius: 16, padding: 14, fontSize: 14,
    borderWidth: 1, borderColor: '#e2e8f0', minHeight: 80, color: '#334155',
  },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  historyDate: { fontSize: 12, fontWeight: '700', color: '#64748b', width: 64 },
  historyDetail: { fontSize: 15, width: 84 },
  historyNotes: { flex: 1, fontSize: 12, color: '#94a3b8' },
});
