import React, { useState, useCallback } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, TextInput, Alert, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { AppMode, SymptomLog } from '../types';
import { toISODay } from '../services/CycleEngine';
import { Store } from '../storage/Store';
import { Card, Chip, PrimaryButton } from '../ui';

const COMMON_SYMPTOMS = [
  { id: 'cramps', emoji: '😣', label: 'Cramps' },
  { id: 'headache', emoji: '🤕', label: 'Headache' },
  { id: 'bloating', emoji: '🎈', label: 'Bloating' },
  { id: 'fatigue', emoji: '😩', label: 'Fatigue' },
  { id: 'backache', emoji: '🔙', label: 'Back Pain' },
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
  { id: 'medium', emoji: '🩸🩸', label: 'Medium' },
  { id: 'heavy', emoji: '🩸🩸🩸', label: 'Heavy' },
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
    { id: 'breast_tenderness', emoji: '🎯', label: 'Tender Breasts' },
  ],
  conceive: [
    { id: 'ovulation_pain', emoji: '🥚', label: 'Ovulation Pain' },
    { id: 'breast_tenderness', emoji: '🎯', label: 'Tender Breasts' },
    { id: 'implantation_spotting', emoji: '✨', label: 'Spotting' },
  ],
  pregnancy: [
    { id: 'morning_sickness', emoji: '🤮', label: 'Morning Sickness' },
    { id: 'heartburn', emoji: '🔥', label: 'Heartburn' },
    { id: 'swelling', emoji: '🦶', label: 'Swelling' },
    { id: 'contractions', emoji: '⚡', label: 'Contractions' },
  ],
  perimenopause: [
    { id: 'hot_flash', emoji: '🔥', label: 'Hot Flash' },
    { id: 'night_sweats', emoji: '🌙', label: 'Night Sweats' },
    { id: 'brain_fog', emoji: '🌫️', label: 'Brain Fog' },
    { id: 'joint_pain', emoji: '🦴', label: 'Joint Pain' },
  ],
};

/** Which optional tracking sections each mode shows */
const MODE_SECTIONS: Record<AppMode, { flow: boolean; bbt: boolean; mucus: boolean; opk: boolean; kicks: boolean; hotFlashes: boolean; sleep: boolean }> = {
  period: { flow: true, bbt: false, mucus: false, opk: false, kicks: false, hotFlashes: false, sleep: true },
  conceive: { flow: true, bbt: true, mucus: true, opk: true, kicks: false, hotFlashes: false, sleep: false },
  pregnancy: { flow: false, bbt: false, mucus: false, opk: false, kicks: true, hotFlashes: false, sleep: true },
  perimenopause: { flow: true, bbt: false, mucus: false, opk: false, kicks: false, hotFlashes: true, sleep: true },
};

export default function SymptomLoggerScreen() {
  const { themeColors, currentMode, saveLog } = useApp();
  const sections = MODE_SECTIONS[currentMode];

  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedEnergy, setSelectedEnergy] = useState<string | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null);
  const [bbt, setBbt] = useState('');
  const [mucus, setMucus] = useState<string | null>(null);
  const [opk, setOpk] = useState<'positive' | 'negative' | null>(null);
  const [kicks, setKicks] = useState(0);
  const [hotFlashes, setHotFlashes] = useState(0);
  const [sleep, setSleep] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [editingExisting, setEditingExisting] = useState(false);

  // Load today's log for editing when the tab gains focus or mode changes
  useFocusEffect(useCallback(() => {
    Store.getLogForDay(toISODay(new Date()), currentMode).then(log => {
      if (log) {
        setEditingExisting(true);
        setSelectedSymptoms(log.symptoms);
        setSelectedMood(log.mood);
        setSelectedEnergy(log.energy);
        setSelectedFlow(log.flow);
        setBbt(log.bbt != null ? String(log.bbt) : '');
        setMucus(log.cervicalMucus ?? null);
        setOpk(log.opkResult ?? null);
        setKicks(log.kicksCount ?? 0);
        setHotFlashes(log.hotFlashCount ?? 0);
        setSleep(log.sleepQuality ?? null);
        setNotes(log.notes);
      } else {
        setEditingExisting(false);
        setSelectedSymptoms([]); setSelectedMood(null); setSelectedEnergy(null); setSelectedFlow(null);
        setBbt(''); setMucus(null); setOpk(null); setKicks(0); setHotFlashes(0); setSleep(null); setNotes('');
      }
    });
  }, [currentMode]));

  const toggleSymptom = (id: string) => {
    setSelectedSymptoms(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const hasData = selectedSymptoms.length > 0 || !!selectedMood || !!selectedEnergy || !!selectedFlow ||
    !!bbt || !!mucus || !!opk || kicks > 0 || hotFlashes > 0 || !!sleep || notes.trim().length > 0;

  const handleSave = async () => {
    const bbtNum = bbt ? parseFloat(bbt.replace(',', '.')) : null;
    if (bbt && (bbtNum == null || isNaN(bbtNum) || bbtNum < 34 || bbtNum > 42)) {
      Alert.alert('Check BBT', 'Basal body temperature should be between 34.0 and 42.0 °C.');
      return;
    }
    const log: SymptomLog = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      symptoms: selectedSymptoms,
      mood: selectedMood,
      energy: selectedEnergy,
      flow: selectedFlow,
      bbt: bbtNum,
      cervicalMucus: mucus,
      opkResult: opk,
      kicksCount: sections.kicks ? kicks : null,
      hotFlashCount: sections.hotFlashes ? hotFlashes : null,
      sleepQuality: sleep,
      notes: notes.trim(),
      mode: currentMode,
    };
    await saveLog(log);
    Alert.alert(
      editingExisting ? 'Updated ✨' : 'Saved ✨',
      'Logged locally and added to your on-device RAG index. Predictions update instantly.',
    );
    setEditingExisting(true);
  };

  const handleVoiceLog = () => {
    Alert.alert(
      'Voice logging 🎙️',
      'Whisper transcribes your voice fully on-device. Download the Whisper model from Profile → AI Models to enable this.',
    );
  };

  const allSymptoms = [...COMMON_SYMPTOMS, ...MODE_EXTRAS[currentMode]];
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  const Counter = ({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) => (
    <View style={styles.counterRow}>
      <TouchableOpacity style={styles.counterBtn} onPress={() => onChange(Math.max(0, value - 1))}>
        <Text style={styles.counterBtnText}>−</Text>
      </TouchableOpacity>
      <View style={{ alignItems: 'center', minWidth: 80 }}>
        <Text style={[styles.counterValue, { color: themeColors.primary }]}>{value}</Text>
        <Text style={styles.counterLabel}>{label}</Text>
      </View>
      <TouchableOpacity style={[styles.counterBtn, { backgroundColor: themeColors.primary }]} onPress={() => onChange(value + 1)}>
        <Text style={[styles.counterBtnText, { color: '#fff' }]}>+</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.card }]}>
        <View>
          <Text style={styles.headerTitle}>Daily Log</Text>
          <Text style={styles.headerDate}>{dateLabel}{editingExisting ? ' · editing today' : ''}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={handleVoiceLog} style={[styles.saveBtn, { backgroundColor: themeColors.primary + '15' }]}>
            <Text style={{ fontSize: 18 }}>🎙️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!hasData}
            style={[styles.saveBtn, { backgroundColor: hasData ? themeColors.primary : '#e2e8f0' }]}
          >
            <Text style={{ color: hasData ? '#fff' : '#94a3b8', fontWeight: '700', fontSize: 14 }}>✓</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Mood */}
        <Card>
          <Text style={styles.sectionTitle}>🎭 How are you feeling?</Text>
          <View style={styles.chipGrid}>
            {MOODS.map(m => (
              <Chip key={m.id} emoji={m.emoji} label={m.label} selected={selectedMood === m.id}
                onPress={() => setSelectedMood(selectedMood === m.id ? null : m.id)} style={{ width: '30%' }} />
            ))}
          </View>
        </Card>

        {/* Energy */}
        <Card>
          <Text style={styles.sectionTitle}>⚡ Energy Level</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {ENERGY.map(e => (
              <Chip key={e.id} emoji={e.emoji} label={e.label} selected={selectedEnergy === e.id} color="#eab308"
                onPress={() => setSelectedEnergy(selectedEnergy === e.id ? null : e.id)} style={{ flex: 1 }} />
            ))}
          </View>
        </Card>

        {/* Flow */}
        {sections.flow && (
          <Card>
            <Text style={styles.sectionTitle}>🩸 Flow</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {FLOW_OPTIONS.map(f => (
                <Chip key={f.id} emoji={f.emoji} label={f.label} selected={selectedFlow === f.id} color="#ec4899"
                  onPress={() => setSelectedFlow(selectedFlow === f.id ? null : f.id)} style={{ flex: 1 }} />
              ))}
            </View>
          </Card>
        )}

        {/* Conceive: BBT + mucus + OPK */}
        {sections.bbt && (
          <Card>
            <Text style={styles.sectionTitle}>🌡️ Basal Body Temperature</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TextInput
                style={[styles.bbtInput, { flex: 1 }]}
                placeholder="36.5"
                placeholderTextColor="#94a3b8"
                value={bbt}
                onChangeText={setBbt}
                keyboardType="decimal-pad"
                maxLength={5}
              />
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#64748b' }}>°C</Text>
            </View>
            <Text style={styles.hint}>Measure first thing in the morning, before getting up</Text>
          </Card>
        )}
        {sections.mucus && (
          <Card>
            <Text style={styles.sectionTitle}>💧 Cervical Mucus</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {MUCUS_OPTIONS.map(m => (
                <Chip key={m.id} emoji={m.emoji} label={m.label} selected={mucus === m.id} color="#14B8A6"
                  onPress={() => setMucus(mucus === m.id ? null : m.id)} style={{ flex: 1 }} />
              ))}
            </View>
            <Text style={styles.hint}>Egg-white consistency signals peak fertility</Text>
          </Card>
        )}
        {sections.opk && (
          <Card>
            <Text style={styles.sectionTitle}>🧪 Ovulation Test (OPK)</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Chip emoji="✅" label="Positive" selected={opk === 'positive'} color="#059669"
                onPress={() => setOpk(opk === 'positive' ? null : 'positive')} style={{ flex: 1 }} />
              <Chip emoji="➖" label="Negative" selected={opk === 'negative'} color="#64748b"
                onPress={() => setOpk(opk === 'negative' ? null : 'negative')} style={{ flex: 1 }} />
            </View>
          </Card>
        )}

        {/* Pregnancy: kicks */}
        {sections.kicks && (
          <Card>
            <Text style={styles.sectionTitle}>🦶 Baby Kicks Today</Text>
            <Counter value={kicks} onChange={setKicks} label="kicks" />
          </Card>
        )}

        {/* Perimenopause: hot flashes */}
        {sections.hotFlashes && (
          <Card>
            <Text style={styles.sectionTitle}>🔥 Hot Flashes Today</Text>
            <Counter value={hotFlashes} onChange={setHotFlashes} label="episodes" />
          </Card>
        )}

        {/* Sleep */}
        {sections.sleep && (
          <Card>
            <Text style={styles.sectionTitle}>😴 Sleep Quality</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {SLEEP_OPTIONS.map(s => (
                <Chip key={s.id} emoji={s.emoji} label={s.label} selected={sleep === s.id} color="#6366f1"
                  onPress={() => setSleep(sleep === s.id ? null : s.id)} style={{ flex: 1 }} />
              ))}
            </View>
          </Card>
        )}

        {/* Symptoms */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>📋 Symptoms</Text>
            {selectedSymptoms.length > 0 && (
              <View style={[styles.countBadge, { backgroundColor: themeColors.primary + '15' }]}>
                <Text style={[styles.countText, { color: themeColors.primary }]}>{selectedSymptoms.length}</Text>
              </View>
            )}
          </View>
          <View style={styles.chipGrid}>
            {allSymptoms.map(s => (
              <Chip key={s.id} emoji={s.emoji} label={s.label} selected={selectedSymptoms.includes(s.id)}
                onPress={() => toggleSymptom(s.id)} style={{ width: '30%' }} />
            ))}
          </View>
        </Card>

        {/* Notes */}
        <Card>
          <Text style={styles.sectionTitle}>✏️ Notes <Text style={styles.privateTag}>never shared</Text></Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Add any notes for today…"
            placeholderTextColor="#94a3b8"
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
          />
        </Card>

        <PrimaryButton
          label={editingExisting ? "Update Today's Log" : "Save Today's Log"}
          onPress={handleSave}
          disabled={!hasData}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 24, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  headerDate: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  saveBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#334155', marginBottom: 12 },
  privateTag: { fontSize: 10, fontWeight: '700', color: '#94a3b8' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bbtInput: {
    backgroundColor: '#f8fafc', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 22, fontWeight: '700', color: '#1e293b', borderWidth: 1, borderColor: '#e2e8f0', textAlign: 'center',
  },
  hint: { fontSize: 11.5, color: '#94a3b8', marginTop: 8 },
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, paddingVertical: 4 },
  counterBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#f1f5f9',
    alignItems: 'center', justifyContent: 'center',
  },
  counterBtnText: { fontSize: 22, color: '#64748b', fontWeight: '600' },
  counterValue: { fontSize: 30, fontWeight: '800' },
  counterLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  countBadge: { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  countText: { fontSize: 12, fontWeight: '700' },
  notesInput: {
    backgroundColor: '#f8fafc', borderRadius: 16, padding: 14, fontSize: 14,
    borderWidth: 1, borderColor: '#e2e8f0', minHeight: 96, color: '#334155',
  },
});
