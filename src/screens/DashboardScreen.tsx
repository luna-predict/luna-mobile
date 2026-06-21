import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, Animated } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useMode } from '../context/ModeContext';
import { Droplet, Sparkles, User, Settings } from 'lucide-react-native';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function DashboardScreen() {
  const { currentMode, themeColors } = useMode();

  // Mock Cycle Data
  const cycleStatus = {
    cycleDay: 14,
    avgCycleLength: 28,
    phase: currentMode === 'pregnancy' ? 'trimester 1' : 'ovulatory',
    daysUntilPeriod: 14,
    fertileWindow: true,
  };

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.02, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true })
      ])
    ).start();

    Animated.timing(progressAnim, {
      toValue: cycleStatus.cycleDay / cycleStatus.avgCycleLength,
      duration: 1500,
      useNativeDriver: true
    }).start();
  }, [currentMode]);

  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0]
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Header */}
        <View className="px-6 py-4 flex-row justify-between items-center z-20">
          <Text className="text-2xl font-bold text-slate-800 tracking-tight">
            Luna<Text style={{ color: themeColors.primary }}>Predict</Text>
          </Text>
        </View>

        {/* Hero Cycle Ring */}
        <View className="mx-4 mt-2 rounded-[2rem] p-6 border border-slate-200/50" style={{ backgroundColor: themeColors.card, shadowColor: themeColors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 32, elevation: 5 }}>
          <View className="flex-row justify-between items-start mb-4">
            <View>
              <Text className="text-lg font-bold text-slate-800">Today</Text>
              <Text className="text-xs text-slate-500 uppercase tracking-widest mt-1">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
            </View>
            <View style={{ backgroundColor: themeColors.primary + '20' }} className="px-3 py-1.5 rounded-full shadow-sm">
              <Text style={{ color: themeColors.primary }} className="text-xs font-bold">✨ {cycleStatus.phase}</Text>
            </View>
          </View>

          <View className="items-center justify-center py-6">
            <Animated.View style={{ transform: [{ scale: pulseAnim }], alignItems: 'center', justifyContent: 'center' }}>
              <View className="absolute w-[200px] h-[200px] rounded-full" style={{ backgroundColor: themeColors.primary + '10', shadowColor: themeColors.primary, shadowOpacity: 0.2, shadowRadius: 40 }} />
              
              <Svg width="240" height="240" viewBox="0 0 240 240">
                <Defs>
                  <LinearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor={themeColors.primary} />
                    <Stop offset="100%" stopColor={themeColors.primary} stopOpacity="0.6" />
                  </LinearGradient>
                </Defs>
                
                <Circle cx="120" cy="120" r={radius} stroke="rgba(14,14,17,0.05)" strokeWidth="12" fill="transparent" />
                <AnimatedCircle
                  cx="120"
                  cy="120"
                  r={radius}
                  stroke="url(#grad)"
                  strokeWidth="14"
                  fill="transparent"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  rotation="-90"
                  origin="120, 120"
                />
              </Svg>

              <View className="absolute items-center justify-center">
                <Text className="text-xs uppercase tracking-widest text-slate-400 font-medium">{currentMode === 'pregnancy' ? 'Week' : 'Day'}</Text>
                <Text className="text-6xl font-bold mt-[-4px]" style={{ color: themeColors.primary }}>{cycleStatus.cycleDay}</Text>
                <Text className="text-sm text-slate-400 mt-[-2px]">of {cycleStatus.avgCycleLength} {currentMode === 'pregnancy' ? 'weeks' : 'days'}</Text>
              </View>
            </Animated.View>
            
            <Text className="text-center text-slate-500 mt-6 text-sm">
              {currentMode === 'period' ? 'Peak energy & fertility' : 'Baby is the size of a peach!'}
            </Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View className="flex-row px-4 gap-3 mt-4">
          <View className="flex-1 border border-slate-200/50 rounded-[1rem] p-4 flex-row items-center gap-3" style={{ backgroundColor: themeColors.card, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 16 }}>
            <Droplet color={themeColors.primary} size={24} />
            <View>
              <Text className="text-xl font-bold" style={{ color: themeColors.primary }}>{cycleStatus.daysUntilPeriod}</Text>
              <Text className="text-[10px] text-slate-500 uppercase tracking-wider">Days to period</Text>
            </View>
          </View>
          <View className="flex-1 border border-slate-200/50 rounded-[1rem] p-4 flex-row items-center gap-3" style={{ backgroundColor: themeColors.card, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 16 }}>
            <Sparkles color="#f59e0b" size={24} />
            <View>
              <Text className="text-xl font-bold text-amber-500">High</Text>
              <Text className="text-[10px] text-slate-500 uppercase tracking-wider">Fertility</Text>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
