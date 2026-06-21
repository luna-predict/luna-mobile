import React from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { useMode, AppMode } from '../context/ModeContext';
import { User, Settings, ShieldCheck, Wallet } from 'lucide-react-native';

const modes: { id: AppMode; label: string; icon: string }[] = [
  { id: 'period', label: 'Track Period', icon: '🌸' },
  { id: 'conceive', label: 'Try to Conceive', icon: '🌱' },
  { id: 'pregnancy', label: 'Pregnancy', icon: '🍼' },
  { id: 'perimenopause', label: 'Perimenopause', icon: '🦋' },
];

export default function ProfileScreen() {
  const { currentMode, setMode, themeColors } = useMode();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <View className="px-6 py-4 flex-row justify-between items-center z-20 bg-white border-b border-slate-200/50" style={{ backgroundColor: themeColors.card }}>
        <Text className="text-xl font-bold text-slate-800 tracking-tight">
          My <Text style={{ color: themeColors.primary }}>Profile</Text>
        </Text>
        <Settings color="#64748b" size={24} />
      </View>

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* User Card */}
        <View className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 items-center mb-6" style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 }}>
          <View className="w-20 h-20 rounded-full bg-slate-100 items-center justify-center mb-4">
            <User color="#94a3b8" size={40} />
          </View>
          <Text className="text-xl font-bold text-slate-800">Anonymous User</Text>
          <View className="flex-row items-center gap-1 mt-2">
            <ShieldCheck color="#10b981" size={14} />
            <Text className="text-xs text-emerald-600 font-bold">Local Data Encrypted</Text>
          </View>
        </View>

        {/* WDK Wallet */}
        <View className="bg-slate-800 rounded-2xl p-5 shadow-lg mb-6 flex-row justify-between items-center">
          <View>
            <Text className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-1">Compute Wallet</Text>
            <View className="flex-row items-end gap-1">
              <Text className="text-3xl font-bold text-emerald-400">5.00</Text>
              <Text className="text-emerald-400/70 font-bold mb-1">USDt</Text>
            </View>
          </View>
          <View className="bg-emerald-500/20 p-3 rounded-full">
            <Wallet color="#34d399" size={28} />
          </View>
        </View>

        {/* App Mode Switcher */}
        <Text className="text-slate-500 font-bold uppercase tracking-wider text-xs mb-3 ml-2">Current Goal</Text>
        <View className="gap-3">
          {modes.map((mode) => {
            const isSelected = currentMode === mode.id;
            return (
              <TouchableOpacity
                key={mode.id}
                onPress={() => setMode(mode.id)}
                className="flex-row items-center p-4 rounded-2xl border"
                style={{
                  backgroundColor: isSelected ? themeColors.primary + '10' : '#fff',
                  borderColor: isSelected ? themeColors.primary : '#e2e8f0',
                }}
              >
                <Text className="text-2xl mr-4">{mode.icon}</Text>
                <Text 
                  className="font-bold text-base flex-1"
                  style={{ color: isSelected ? themeColors.primary : '#334155' }}
                >
                  {mode.label}
                </Text>
                {isSelected && (
                  <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: themeColors.primary }}>
                    <View className="w-2 h-2 rounded-full bg-white" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
