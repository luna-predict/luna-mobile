import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, SafeAreaView, Animated, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useMode, AppMode } from '../context/ModeContext';
import { Droplet, Sparkles, TrendingUp, Heart } from 'lucide-react-native';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Phase configuration matching the web app
const PHASE_CONFIG: Record<string, {
  emoji: string;
  desc: string;
  gradient: [string, string];
}> = {
  menstrual: { emoji: '🌸', desc: 'Rest and nurture yourself', gradient: ['#fb7185', '#f472b6'] },
  follicular: { emoji: '🌱', desc: 'Energy is rising!', gradient: ['#14b8a6', '#06b6d4'] },
  ovulatory: { emoji: '✨', desc: 'Peak energy & fertility', gradient: ['#f59e0b', '#fbbf24'] },
  luteal: { emoji: '🌙', desc: 'Wind down and reflect', gradient: ['#8b5cf6', '#a78bfa'] },
};

// Mode-specific tips from the web InsightsPanel
const MODE_TIPS: Record<AppMode, string[]> = {
  period: [
    'Track your flow to spot patterns',
    'Rest is productive during menstruation',
    'Magnesium may help with cramps',
  ],
  conceive: [
    'Log BBT before getting out of bed',
    'Egg white discharge signals peak fertility',
    'Ovulation typically occurs mid-cycle',
  ],
  pregnancy: [
    'Stay hydrated for you and baby',
    'Prenatal vitamins are essential',
    'Movement helps reduce discomfort',
  ],
  perimenopause: [
    'Irregular cycles are normal during this phase',
    'Track hot flashes to find triggers',
    'Sleep hygiene can improve rest quality',
  ],
};

const MODE_ICONS: Record<AppMode, string> = {
  period: '🌸',
  conceive: '🥚',
  pregnancy: '🤰',
  perimenopause: '🌿',
};

export default function DashboardScreen() {
  const { currentMode, themeColors } = useMode();

  // Mock data — in prod this comes from local storage
  const cycleStatus = useMemo(() => ({
    cycleDay: 14,
    avgCycleLength: currentMode === 'pregnancy' ? 40 : 28,
    phase: currentMode === 'pregnancy' ? 'trimester 1' : 'ovulatory',
    daysUntilPeriod: 14,
    daysUntilOvulation: 0,
    fertileWindow: true,
  }), [currentMode]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Reset & restart animations when mode changes
    progressAnim.setValue(0);
    fadeAnim.setValue(0);

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();

    Animated.timing(progressAnim, {
      toValue: cycleStatus.cycleDay / cycleStatus.avgCycleLength,
      duration: 1500,
      useNativeDriver: true,
    }).start();

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [currentMode]);

  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  const phaseKey = cycleStatus.phase.toLowerCase();
  const phase = PHASE_CONFIG[Object.keys(PHASE_CONFIG).find(k => phaseKey.includes(k)) || 'follicular']!;
  const tips = MODE_TIPS[currentMode];
  const tipIndex = Math.floor(Date.now() / 86400000) % tips.length; // rotates daily

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>      
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              Luna<Text style={{ color: themeColors.primary }}>Predict</Text>
            </Text>
          </View>

          {/* Hero Cycle Ring Card */}
          <View style={[styles.ringCard, { backgroundColor: themeColors.card, shadowColor: themeColors.primary }]}>
            {/* Date bar */}
            <View style={styles.dateRow}>
              <View>
                <Text style={styles.todayText}>Today</Text>
                <Text style={styles.dateText}>
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </Text>
              </View>
              <View style={[styles.phaseBadge, { backgroundColor: themeColors.primary + '20' }]}>
                <Text style={[styles.phaseBadgeText, { color: themeColors.primary }]}>
                  {phase.emoji} {cycleStatus.phase}
                </Text>
              </View>
            </View>

            {/* Ring */}
            <View style={styles.ringContainer}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }], alignItems: 'center', justifyContent: 'center' }}>
                <View style={[styles.glowCircle, { backgroundColor: themeColors.primary + '10', shadowColor: themeColors.primary }]} />

                <Svg width={240} height={240} viewBox="0 0 240 240">
                  <Defs>
                    <LinearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <Stop offset="0%" stopColor={themeColors.primary} />
                      <Stop offset="100%" stopColor={themeColors.primary} stopOpacity={0.5} />
                    </LinearGradient>
                  </Defs>
                  <Circle cx={120} cy={120} r={radius} stroke="rgba(14,14,17,0.05)" strokeWidth={12} fill="transparent" />
                  <AnimatedCircle
                    cx={120} cy={120} r={radius}
                    stroke="url(#grad)" strokeWidth={14} fill="transparent"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    rotation={-90} origin="120, 120"
                  />
                </Svg>

                <View style={styles.ringCenter}>
                  <Text style={styles.ringLabel}>{currentMode === 'pregnancy' ? 'Week' : 'Day'}</Text>
                  <Text style={[styles.ringValue, { color: themeColors.primary }]}>{cycleStatus.cycleDay}</Text>
                  <Text style={styles.ringSubLabel}>of {cycleStatus.avgCycleLength} {currentMode === 'pregnancy' ? 'weeks' : 'days'}</Text>
                </View>
              </Animated.View>
            </View>

            <Text style={styles.phaseDesc}>{phase.desc}</Text>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: themeColors.card }]}>
              <Droplet color={themeColors.primary} size={24} />
              <View style={{ marginLeft: 12 }}>
                <Text style={[styles.statValue, { color: themeColors.primary }]}>{cycleStatus.daysUntilPeriod}</Text>
                <Text style={styles.statLabel}>Days to period</Text>
              </View>
            </View>
            <View style={[styles.statCard, { backgroundColor: themeColors.card }]}>
              <Sparkles color="#f59e0b" size={24} />
              <View style={{ marginLeft: 12 }}>
                <Text style={[styles.statValue, { color: '#f59e0b' }]}>
                  {cycleStatus.fertileWindow ? 'High' : cycleStatus.daysUntilOvulation.toString()}
                </Text>
                <Text style={styles.statLabel}>{cycleStatus.fertileWindow ? 'Fertility' : 'To ovulation'}</Text>
              </View>
            </View>
          </View>

          {/* Insights Panel — ported from web */}
          <View style={[styles.insightCard, { backgroundColor: themeColors.card, borderLeftColor: themeColors.primary }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={[styles.insightIcon, { backgroundColor: themeColors.primary + '15' }]}>
                <Text style={{ fontSize: 20 }}>{MODE_ICONS[currentMode]}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.insightTitle}>Today's Insight</Text>
                <Text style={styles.insightBody}>{tips[tipIndex]}</Text>
              </View>
            </View>
            <View style={styles.insightDivider} />
            <Text style={styles.insightTip}>
              💡 <Text style={{ fontWeight: '700' }}>Tip:</Text> {tips[(tipIndex + 1) % tips.length]}
            </Text>
          </View>

          {/* Recent Activity placeholder */}
          <View style={[styles.recentCard, { backgroundColor: themeColors.card }]}>
            <Text style={styles.sectionLabel}>Recent Logs</Text>
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>📝</Text>
              <Text style={styles.emptyText}>No logs yet today</Text>
              <Text style={styles.emptySubtext}>Tap the + tab to log symptoms</Text>
            </View>
          </View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1e293b', letterSpacing: -0.5 },
  ringCard: {
    marginHorizontal: 16, marginTop: 8, borderRadius: 28, padding: 24,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)',
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 32, elevation: 5,
  },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  todayText: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  dateText: { fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 },
  phaseBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
  phaseBadgeText: { fontSize: 11, fontWeight: '700' },
  ringContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  glowCircle: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    shadowOpacity: 0.25, shadowRadius: 40,
  },
  ringCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  ringLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: '#94a3b8', fontWeight: '600' },
  ringValue: { fontSize: 56, fontWeight: '800', marginTop: -4 },
  ringSubLabel: { fontSize: 13, color: '#94a3b8', marginTop: -4 },
  phaseDesc: { textAlign: 'center', color: '#64748b', fontSize: 14, marginTop: 8 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 16, gap: 12 },
  statCard: {
    flex: 1, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 16,
  },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 },
  insightCard: {
    marginHorizontal: 16, marginTop: 16, borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)', borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 16,
  },
  insightIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  insightTitle: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 4 },
  insightBody: { fontSize: 14, color: '#64748b', lineHeight: 20 },
  insightDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginVertical: 12 },
  insightTip: { fontSize: 12, color: '#94a3b8' },
  recentCard: {
    marginHorizontal: 16, marginTop: 16, borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 16,
  },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 20 },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#64748b' },
  emptySubtext: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
});
