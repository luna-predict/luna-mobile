import React from 'react';
import { View, Text, SafeAreaView, ScrollView } from 'react-native';
import { useMode } from '../context/ModeContext';
import { Calendar } from 'lucide-react-native';

export default function CalendarScreen() {
  const { themeColors, currentMode } = useMode();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <View className="px-6 py-4 flex-row justify-between items-center z-20 bg-white border-b border-slate-200/50" style={{ backgroundColor: themeColors.card }}>
        <Text className="text-xl font-bold text-slate-800 tracking-tight">
          Cycle <Text style={{ color: themeColors.primary }}>Calendar</Text>
        </Text>
        <Calendar color={themeColors.primary} size={24} />
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Mock Calendar Header */}
        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-lg font-bold text-slate-700">June 2026</Text>
          <View className="flex-row gap-2">
            <View className="w-8 h-8 bg-slate-100 rounded-full items-center justify-center"><Text className="text-slate-500 font-bold">{"<"}</Text></View>
            <View className="w-8 h-8 bg-slate-100 rounded-full items-center justify-center"><Text className="text-slate-500 font-bold">{">"}</Text></View>
          </View>
        </View>

        {/* Mock Calendar Grid */}
        <View className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100" style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 }}>
          <View className="flex-row justify-between mb-4">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
              <Text key={i} className="text-slate-400 font-bold w-8 text-center">{day}</Text>
            ))}
          </View>
          <View className="flex-row flex-wrap justify-between gap-y-4">
            {Array.from({ length: 30 }).map((_, i) => {
              const day = i + 1;
              let isPeriod = day >= 1 && day <= 5;
              let isFertile = day >= 12 && day <= 16;
              let isOvulation = day === 14;

              let bgColor = 'transparent';
              let textColor = '#334155';
              let borderColor = 'transparent';

              if (currentMode === 'period') {
                if (isPeriod) {
                  bgColor = themeColors.primary;
                  textColor = '#fff';
                } else if (isOvulation) {
                  bgColor = '#f59e0b';
                  textColor = '#fff';
                } else if (isFertile) {
                  bgColor = '#fef3c7';
                  textColor = '#b45309';
                  borderColor = '#fde68a';
                }
              }

              return (
                <View 
                  key={i} 
                  className="w-10 h-10 items-center justify-center rounded-full border"
                  style={{ backgroundColor: bgColor, borderColor: borderColor !== 'transparent' ? borderColor : bgColor }}
                >
                  <Text style={{ color: textColor }} className="font-bold">{day}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
