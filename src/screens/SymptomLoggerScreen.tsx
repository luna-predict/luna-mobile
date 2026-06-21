import React, { useState } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useMode } from '../context/ModeContext';
import { PlusCircle, Check } from 'lucide-react-native';

const symptomsList = [
  { id: 'cramps', label: 'Cramps', icon: '😫' },
  { id: 'fatigue', label: 'Fatigue', icon: '😴' },
  { id: 'headache', label: 'Headache', icon: '🤕' },
  { id: 'bloating', label: 'Bloating', icon: '🎈' },
  { id: 'acne', label: 'Acne', icon: '🌋' },
  { id: 'tender_breasts', label: 'Tender Breasts', icon: '🍈' },
  { id: 'mood_swings', label: 'Mood Swings', icon: '🎭' },
  { id: 'spotting', label: 'Spotting', icon: '🩸' },
];

export default function SymptomLoggerScreen() {
  const { themeColors } = useMode();
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);

  const toggleSymptom = (id: string) => {
    setSelectedSymptoms(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    Alert.alert('Success', 'Symptoms logged locally.');
    setSelectedSymptoms([]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <View className="px-6 py-4 flex-row justify-between items-center z-20 bg-white border-b border-slate-200/50" style={{ backgroundColor: themeColors.card }}>
        <Text className="text-xl font-bold text-slate-800 tracking-tight">
          Log <Text style={{ color: themeColors.primary }}>Symptoms</Text>
        </Text>
        <PlusCircle color={themeColors.primary} size={24} />
      </View>

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 100 }}>
        <Text className="text-slate-500 font-bold uppercase tracking-wider text-xs mb-4 mt-2">How are you feeling today?</Text>
        
        <View className="flex-row flex-wrap justify-between gap-y-4">
          {symptomsList.map((symptom) => {
            const isSelected = selectedSymptoms.includes(symptom.id);
            return (
              <TouchableOpacity
                key={symptom.id}
                onPress={() => toggleSymptom(symptom.id)}
                className="w-[31%] aspect-square rounded-2xl items-center justify-center border p-2"
                style={{
                  backgroundColor: isSelected ? themeColors.primary : themeColors.card,
                  borderColor: isSelected ? themeColors.primary : '#e2e8f0',
                  shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2
                }}
              >
                {isSelected && (
                  <View className="absolute top-2 right-2">
                    <Check color="#fff" size={12} />
                  </View>
                )}
                <Text className="text-3xl mb-2">{symptom.icon}</Text>
                <Text 
                  className="text-[10px] text-center font-bold"
                  style={{ color: isSelected ? '#fff' : '#64748b' }}
                >
                  {symptom.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity 
          onPress={handleSave}
          disabled={selectedSymptoms.length === 0}
          className="mt-8 rounded-full py-4 items-center justify-center shadow-lg"
          style={{ backgroundColor: selectedSymptoms.length > 0 ? themeColors.primary : '#cbd5e1' }}
        >
          <Text className="text-white font-bold text-lg">Save Log</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
