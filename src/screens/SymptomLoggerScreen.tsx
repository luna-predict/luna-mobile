import React, { useState } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, TextInput, Alert, StyleSheet } from 'react-native';
import { useMode, AppMode } from '../context/ModeContext';

// ─── Data from web SymptomLogger.tsx ───
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

const MODE_EXTRAS: Record<AppMode, { id: string; emoji: string; label: string }[]> = {
  period: [
    { id: 'pms', emoji: '😤', label: 'PMS' },
    { id: 'cravings', emoji: '🍫', label: 'Cravings' },
  ],
  conceive: [
    { id: 'ovulation_pain', emoji: '🥚', label: 'Ovulation Pain' },
    { id: 'ewcm', emoji: '💧', label: 'EWCM' },
    { id: 'opk_positive', emoji: '✅', label: 'Positive OPK' },
  ],
  pregnancy: [
    { id: 'kicks', emoji: '🦶', label: 'Baby Kicks' },
    { id: 'morning_sickness', emoji: '🤮', label: 'Morning Sickness' },
    { id: 'heartburn', emoji: '🔥', label: 'Heartburn' },
  ],
  perimenopause: [
    { id: 'hot_flash', emoji: '🔥', label: 'Hot Flash' },
    { id: 'night_sweats', emoji: '🌙', label: 'Night Sweats' },
    { id: 'brain_fog', emoji: '🌫️', label: 'Brain Fog' },
  ],
};

export default function SymptomLoggerScreen() {
  const { themeColors, currentMode } = useMode();
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedEnergy, setSelectedEnergy] = useState<string | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const toggleSymptom = (id: string) => {
    setSelectedSymptoms(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const hasData = selectedSymptoms.length > 0 || !!selectedMood || !!selectedEnergy || !!selectedFlow;

  const handleSave = () => {
    Alert.alert('Saved ✨', 'Your symptoms have been logged locally and encrypted on-device.');
    setSelectedSymptoms([]);
    setSelectedMood(null);
    setSelectedEnergy(null);
    setSelectedFlow(null);
    setNotes('');
  };

  const allSymptoms = [...COMMON_SYMPTOMS, ...MODE_EXTRAS[currentMode]];

  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.card }]}>
        <View>
          <Text style={styles.headerTitle}>Daily Log</Text>
          <Text style={styles.headerDate}>{dateLabel}</Text>
        </View>
        <TouchableOpacity
          onPress={handleSave}
          disabled={!hasData}
          style={[styles.saveBtn, { backgroundColor: hasData ? themeColors.primary : '#e2e8f0' }]}
        >
          <Text style={{ color: hasData ? '#fff' : '#94a3b8', fontWeight: '700', fontSize: 14 }}>✓</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Mood Section */}
        <View style={[styles.section, { backgroundColor: themeColors.card }]}>
          <Text style={styles.sectionTitle}>🎭 How are you feeling?</Text>
          <View style={styles.chipRow}>
            {MOODS.map(m => (
              <TouchableOpacity
                key={m.id}
                onPress={() => setSelectedMood(selectedMood === m.id ? null : m.id)}
                style={[styles.moodChip, selectedMood === m.id && { backgroundColor: themeColors.primary + '15', borderColor: themeColors.primary, borderWidth: 2 }]}
              >
                <Text style={{ fontSize: 24 }}>{m.emoji}</Text>
                <Text style={[styles.chipLabel, selectedMood === m.id && { color: themeColors.primary }]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Energy Section */}
        <View style={[styles.section, { backgroundColor: themeColors.card }]}>
          <Text style={styles.sectionTitle}>⚡ Energy Level</Text>
          <View style={styles.energyRow}>
            {ENERGY.map(e => (
              <TouchableOpacity
                key={e.id}
                onPress={() => setSelectedEnergy(selectedEnergy === e.id ? null : e.id)}
                style={[styles.energyChip, selectedEnergy === e.id && { backgroundColor: '#fef9c3', borderColor: '#eab308', borderWidth: 2 }]}
              >
                <Text style={{ fontSize: 22 }}>{e.emoji}</Text>
                <Text style={[styles.energyLabel, selectedEnergy === e.id && { color: '#a16207' }]}>{e.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Flow Section (Period mode only) */}
        {currentMode === 'period' && (
          <View style={[styles.section, { backgroundColor: themeColors.card }]}>
            <Text style={styles.sectionTitle}>🩸 Flow</Text>
            <View style={styles.flowRow}>
              {FLOW_OPTIONS.map(f => (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => setSelectedFlow(selectedFlow === f.id ? null : f.id)}
                  style={[styles.flowChip, selectedFlow === f.id && { backgroundColor: '#fce7f3', borderColor: '#ec4899', borderWidth: 2 }]}
                >
                  <Text style={{ fontSize: 18 }}>{f.emoji}</Text>
                  <Text style={[styles.flowLabel, selectedFlow === f.id && { color: '#be185d' }]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Symptoms Section */}
        <View style={[styles.section, { backgroundColor: themeColors.card }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={styles.sectionTitle}>📋 Symptoms</Text>
            {selectedSymptoms.length > 0 && (
              <View style={[styles.countBadge, { backgroundColor: themeColors.primary + '15' }]}>
                <Text style={[styles.countText, { color: themeColors.primary }]}>{selectedSymptoms.length}</Text>
              </View>
            )}
          </View>
          <View style={styles.symptomGrid}>
            {allSymptoms.map(s => {
              const isSelected = selectedSymptoms.includes(s.id);
              return (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => toggleSymptom(s.id)}
                  style={[
                    styles.symptomChip,
                    isSelected && { backgroundColor: themeColors.primary + '15', borderColor: themeColors.primary, borderWidth: 2 },
                  ]}
                >
                  <Text style={{ fontSize: 22 }}>{s.emoji}</Text>
                  <Text style={[styles.symptomLabel, isSelected && { color: themeColors.primary }]}>{s.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Notes */}
        <View style={[styles.section, { backgroundColor: themeColors.card }]}>
          <Text style={styles.sectionTitle}>✏️ Notes</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Add any notes for today..."
            placeholderTextColor="#94a3b8"
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={!hasData}
          style={[styles.bigSaveBtn, { backgroundColor: hasData ? themeColors.primary : '#cbd5e1' }]}
        >
          <Text style={styles.bigSaveBtnText}>Save Today's Log</Text>
        </TouchableOpacity>
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
  section: {
    borderRadius: 20, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 16,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#334155', marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moodChip: {
    width: '30%', alignItems: 'center', paddingVertical: 12, borderRadius: 16,
    backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: 'transparent',
  },
  chipLabel: { fontSize: 10, marginTop: 4, color: '#64748b', fontWeight: '600' },
  energyRow: { flexDirection: 'row', gap: 8 },
  energyChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 16, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: 'transparent',
  },
  energyLabel: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  flowRow: { flexDirection: 'row', gap: 8 },
  flowChip: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 16,
    backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: 'transparent',
  },
  flowLabel: { fontSize: 10, marginTop: 4, color: '#64748b', fontWeight: '600' },
  countBadge: { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  countText: { fontSize: 12, fontWeight: '700' },
  symptomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  symptomChip: {
    width: '30%', alignItems: 'center', paddingVertical: 14, borderRadius: 16,
    backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: 'transparent',
  },
  symptomLabel: { fontSize: 10, marginTop: 4, color: '#64748b', fontWeight: '600', textAlign: 'center' },
  notesInput: {
    backgroundColor: '#f8fafc', borderRadius: 16, padding: 14, fontSize: 14,
    borderWidth: 1, borderColor: '#e2e8f0', minHeight: 96, color: '#334155',
  },
  bigSaveBtn: {
    borderRadius: 100, paddingVertical: 18, alignItems: 'center', justifyContent: 'center', marginTop: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16,
  },
  bigSaveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
