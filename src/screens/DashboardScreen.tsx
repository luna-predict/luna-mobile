import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, SafeAreaView, Animated, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { AppMode, CyclePhase } from '../types';
import { phaseInsight, parseISODay } from '../services/CycleEngine';
import { Droplet, Sparkles } from 'lucide-react-native';
import { Card, SectionLabel, Badge } from '../ui';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const PHASE_CONFIG: Record<CyclePhase, { emoji: string }> = {
  menstrual: { emoji: '🌸' },
  follicular: { emoji: '🌱' },
  ovulatory: { emoji: '✨' },
  luteal: { emoji: '🌙' },
};

const MODE_TIPS: Record<AppMode, string[]> = {
  period: [
    'Track your flow to spot patterns',
    'Rest is productive during menstruation',
    'Magnesium may help with cramps',
  ],
  conceive: [
    'Log BBT before getting out of bed',
    'Egg white discharge signals peak fertility',
    'Intercourse every 1–2 days across the fertile window',
  ],
  pregnancy: [
    'Stay hydrated for you and baby',
    'Prenatal vitamins are essential',
    'Count kicks daily after week 28',
  ],
  perimenopause: [
    'Irregular cycles are normal during this phase',
    'Track hot flashes to find triggers',
    'Sleep hygiene can improve rest quality',
  ],
};

const MODE_ICONS: Record<AppMode, string> = {
  period: '🌸', conceive: '🥚', pregnancy: '🤰', perimenopause: '🌿',
};

const MOOD_EMOJI: Record<string, string> = {
  great: '😊', good: '🙂', okay: '😐', down: '😔', stressed: '😰', irritable: '😤',
};

export default function DashboardScreen() {
  const navigation = useNavigation<NavigationProp<{ Log: undefined; Coach: undefined }>>();
  const { currentMode, themeColors, user, cycle, pregnancy, logs } = useApp();

  const isPregnancy = currentMode === 'pregnancy' && pregnancy;
  const ringValue = isPregnancy ? pregnancy.week : cycle?.cycleDay ?? 1;
  const ringMax = isPregnancy ? 40 : cycle?.cycleLength ?? 28;
  const phase = !isPregnancy && cycle ? cycle.phase : null;

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progressAnim.setValue(0);
    fadeAnim.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
    Animated.timing(progressAnim, { toValue: ringValue / ringMax, duration: 1500, useNativeDriver: true }).start();
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, [currentMode, ringValue, ringMax]);

  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  const tips = MODE_TIPS[currentMode];
  const tipIndex = Math.floor(Date.now() / 86400000) % tips.length;

  const recentLogs = useMemo(() => [...logs].slice(-3).reverse(), [logs]);
  const todayLogged = logs.some(l => l.date.slice(0, 10) === new Date().toISOString().slice(0, 10) ||
    l.date.slice(0, 10) === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`);

  const greeting = (() => {
    const h = new Date().getHours();
    const name = user?.name ? `, ${user.name}` : '';
    return h < 12 ? `Good morning${name}` : h < 18 ? `Good afternoon${name}` : `Good evening${name}`;
  })();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>
                Luna<Text style={{ color: themeColors.primary }}>Predict</Text>
              </Text>
              <Text style={styles.greeting}>{greeting}</Text>
            </View>
            <View style={[styles.privacyPill, { backgroundColor: '#ecfdf5' }]}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#059669' }}>🔒 ON-DEVICE</Text>
            </View>
          </View>

          {/* Hero ring */}
          <View style={[styles.ringCard, { backgroundColor: themeColors.card, shadowColor: themeColors.primary }]}>
            <View style={styles.dateRow}>
              <View>
                <Text style={styles.todayText}>Today</Text>
                <Text style={styles.dateText}>
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </Text>
              </View>
              <View style={[styles.phaseBadge, { backgroundColor: themeColors.primary + '20' }]}>
                <Text style={[styles.phaseBadgeText, { color: themeColors.primary }]}>
                  {isPregnancy
                    ? `🤰 Trimester ${pregnancy.trimester}`
                    : phase ? `${PHASE_CONFIG[phase].emoji} ${cycle!.phaseLabel}` : '—'}
                </Text>
              </View>
            </View>

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
                  <Text style={styles.ringLabel}>{isPregnancy ? 'Week' : 'Day'}</Text>
                  <Text style={[styles.ringValue, { color: themeColors.primary }]}>{ringValue}</Text>
                  <Text style={styles.ringSubLabel}>of {ringMax} {isPregnancy ? 'weeks' : 'days'}</Text>
                </View>
              </Animated.View>
            </View>

            <Text style={styles.phaseDesc}>
              {isPregnancy
                ? `Baby is about the size of ${pregnancy.babySize}`
                : phase ? phaseInsight(phase) : 'Log your first period to start predictions'}
            </Text>
            {cycle && cycle.confidence !== 'established' && !isPregnancy && (
              <Text style={styles.confidenceNote}>
                {cycle.confidence === 'seed'
                  ? 'Predictions from onboarding — they sharpen as you log'
                  : 'Luna is learning your cycle from your logs'}
              </Text>
            )}
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            {isPregnancy ? (
              <>
                <Card style={[styles.statCard, { marginBottom: 0 }]}>
                  <Droplet color={themeColors.primary} size={24} />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={[styles.statValue, { color: themeColors.primary }]}>{pregnancy.daysUntilDue}</Text>
                    <Text style={styles.statLabel}>Days to due date</Text>
                  </View>
                </Card>
                <Card style={[styles.statCard, { marginBottom: 0 }]}>
                  <Sparkles color="#f59e0b" size={24} />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={[styles.statValue, { color: '#f59e0b' }]}>
                      {parseISODay(pregnancy.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                    <Text style={styles.statLabel}>Due date</Text>
                  </View>
                </Card>
              </>
            ) : (
              <>
                <Card style={[styles.statCard, { marginBottom: 0 }]}>
                  <Droplet color={themeColors.primary} size={24} />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={[styles.statValue, { color: themeColors.primary }]}>{cycle?.daysUntilPeriod ?? '—'}</Text>
                    <Text style={styles.statLabel}>Days to period</Text>
                  </View>
                </Card>
                <Card style={[styles.statCard, { marginBottom: 0 }]}>
                  <Sparkles color="#f59e0b" size={24} />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={[styles.statValue, { color: '#f59e0b' }]}>
                      {cycle?.inFertileWindow ? 'High' : `${cycle?.daysUntilOvulation ?? '—'}d`}
                    </Text>
                    <Text style={styles.statLabel}>{cycle?.inFertileWindow ? 'Fertility now' : 'To ovulation'}</Text>
                  </View>
                </Card>
              </>
            )}
          </View>

          {/* Insight */}
          <Card style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 0, borderLeftWidth: 4, borderLeftColor: themeColors.primary }}>
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
            <TouchableOpacity onPress={() => navigation.navigate('Coach')}>
              <Text style={styles.insightTip}>
                💬 <Text style={{ fontWeight: '700', color: themeColors.primary }}>Ask Luna</Text> — your on-device AI coach
              </Text>
            </TouchableOpacity>
          </Card>

          {/* Recent logs */}
          <Card style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 0 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <SectionLabel style={{ marginBottom: 0 }}>Recent Logs</SectionLabel>
              {todayLogged && <Badge label="TODAY LOGGED ✓" color="#059669" bg="#ecfdf5" />}
            </View>
            {recentLogs.length === 0 ? (
              <TouchableOpacity style={styles.emptyState} onPress={() => navigation.navigate('Log')}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>📝</Text>
                <Text style={styles.emptyText}>No logs yet</Text>
                <Text style={styles.emptySubtext}>Tap the + tab to log symptoms — every log improves predictions</Text>
              </TouchableOpacity>
            ) : (
              recentLogs.map((log, i) => (
                <View key={log.id} style={[styles.logRow, i > 0 && styles.logRowBorder]}>
                  <Text style={styles.logDate}>
                    {parseISODay(log.date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}
                  </Text>
                  <Text style={{ fontSize: 16, width: 30 }}>{log.mood ? MOOD_EMOJI[log.mood] ?? '📝' : '📝'}</Text>
                  <Text style={styles.logSummary} numberOfLines={1}>
                    {[
                      log.flow ? `${log.flow} flow` : null,
                      log.symptoms.length > 0 ? `${log.symptoms.length} symptom${log.symptoms.length > 1 ? 's' : ''}` : null,
                      log.energy ? `${log.energy} energy` : null,
                    ].filter(Boolean).join(' · ') || 'Notes only'}
                  </Text>
                </View>
              ))
            )}
          </Card>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1e293b', letterSpacing: -0.5 },
  greeting: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  privacyPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100 },
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
  confidenceNote: { textAlign: 'center', color: '#b45309', fontSize: 11, marginTop: 6, fontWeight: '600' },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 16, gap: 12 },
  statCard: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 16 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 },
  insightIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  insightTitle: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 4 },
  insightBody: { fontSize: 14, color: '#64748b', lineHeight: 20 },
  insightDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginVertical: 12 },
  insightTip: { fontSize: 12, color: '#94a3b8' },
  emptyState: { alignItems: 'center', paddingVertical: 20 },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#64748b' },
  emptySubtext: { fontSize: 12, color: '#94a3b8', marginTop: 4, textAlign: 'center' },
  logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  logRowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  logDate: { fontSize: 12, fontWeight: '700', color: '#64748b', width: 62 },
  logSummary: { flex: 1, fontSize: 13, color: '#475569', textTransform: 'capitalize' },
});
