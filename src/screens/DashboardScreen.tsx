import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Animated, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import {
  Droplet, Sparkles, CalendarClock, Baby, Flame, Activity, MessageCircle, Lock, PenLine, ChevronRight, Moon,
} from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { CyclePhase } from '../types';
import { phaseInsight, formatDay, fertilityLevel } from '../domain';
import { Card, SectionLabel, Badge, Banner, FlagBanner, StatTile, Button, useReducedMotion, space, type } from '../ui';
import { RootStackParamList } from '../navigation/AppNavigator';
import { coachEngine } from '../ai/engine';
import { ModelManager } from '../services/ModelManager';
import { useModelRegistryVersion } from '../ai/useModels';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const PHASE_ICON: Record<CyclePhase, React.ComponentType<{ color?: string; size?: number }>> = {
  menstrual: Droplet,
  follicular: Sparkles,
  ovulatory: Sparkles,
  luteal: Moon,
};

const MOOD_LABEL: Record<string, string> = {
  great: 'Great', good: 'Good', okay: 'Okay', down: 'Down', stressed: 'Stressed', irritable: 'Irritable',
};

type Nav = NavigationProp<RootStackParamList & { Log: undefined; Coach: undefined; Calendar: undefined }>;

export default function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { themeColors: t, currentMode, user, cycle, pregnancy, peri, logs, flags, dismissFlag, today, getLog } = useApp();
  const reducedMotion = useReducedMotion();
  const [hideLatePrompt, setHideLatePrompt] = useState(false);

  // Ring value
  const ring = useMemo(() => {
    if (pregnancy) return { value: pregnancy.week, max: 40, label: 'Week', sub: pregnancy.label };
    if (peri) return { value: Math.min(peri.daysSinceLastBleed ?? 0, 365), max: 365, label: 'Days since period', sub: peri.stageLabel };
    if (cycle) return { value: cycle.cycleDay, max: Math.max(cycle.cycleLength, cycle.cycleDay), label: 'Day', sub: `of ~${cycle.cycleLength}` };
    return { value: 0, max: 28, label: 'Day', sub: '—' };
  }, [pregnancy, peri, cycle]);

  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const target = ring.max ? ring.value / ring.max : 0;
    if (reducedMotion) progress.setValue(target);
    else Animated.timing(progress, { toValue: target, duration: 800, useNativeDriver: true }).start();
  }, [ring.value, ring.max, reducedMotion, progress]);

  const radius = 86;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = progress.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] });

  const todayLog = getLog(today, currentMode);
  const recentLogs = useMemo(() => [...logs].filter(l => l.mode === currentMode).sort((a, b) => b.day.localeCompare(a.day)).slice(0, 3), [logs, currentMode]);
  const urgentFlags = flags.filter(f => f.severity === 'urgent');
  const otherFlags = flags.filter(f => f.severity !== 'urgent');

  const hour = new Date().getHours();
  const greeting = `${hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}${user?.name ? `, ${user.name}` : ''}`;

  useModelRegistryVersion();
  const engineKind = coachEngine.kind();
  const coachModel = ModelManager.getActiveModel();
  const coachStatus = engineKind === 'demo'
    ? 'Demo mode — install the LunaPredict build for on-device AI'
    : coachModel ? `${coachModel.name} ready · works offline` : 'Download MedPsy once to chat offline';

  const PhaseIcon = cycle ? PHASE_ICON[cycle.phase] : Moon;
  const isLate = cycle && (cycle.status === 'late' || cycle.status === 'overdue_long');
  const level = cycle && currentMode === 'conceive' ? fertilityLevel(cycle, today) : null;

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: t.background }]}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={[styles.brand, { color: t.text }]}>
              Luna<Text style={{ color: t.primaryStrong }}>Predict</Text>
            </Text>
            <Text style={{ color: t.textMuted, fontSize: 15 }}>{greeting}</Text>
          </View>
          <Badge label="Private · on this phone" color={t.success} bg={t.successTint} icon={Lock} />
        </View>

        {urgentFlags.map(f => <FlagBanner key={f.id} flag={f} />)}

        {/* Late / assumed prompts */}
        {isLate && !hideLatePrompt && (
          <Banner
            testID="banner-late"
            severity="warn"
            title={`Period ${cycle!.daysLate} day${cycle!.daysLate === 1 ? '' : 's'} late`}
            body={currentMode === 'conceive'
              ? 'A pregnancy test is reliable from today. If your period has started, log it so predictions stay accurate.'
              : 'Has your period started? Logging it keeps predictions accurate. If there is a chance you are pregnant, a test is reliable now.'}
            actions={[
              { label: 'It started', testID: 'late-started', onPress: () => navigation.navigate('LogDay', { day: today, periodStart: true }) },
              { label: 'Not yet', onPress: () => setHideLatePrompt(true) },
            ]}
          />
        )}
        {cycle?.status === 'assumed' && !hideLatePrompt && cycle.lastPeriodStart && (
          <Banner
            severity="info"
            title={`Has your period started since ${formatDay(cycle.lastPeriodStart)}?`}
            body="Luna is assuming regular cycles until you log one. Logging real periods makes predictions personal."
            actions={[
              { label: 'Log a period', onPress: () => navigation.navigate('Calendar') },
              { label: 'Later', onPress: () => setHideLatePrompt(true) },
            ]}
          />
        )}

        {/* Hero */}
        <Card style={styles.hero}>
          <View style={styles.heroTop}>
            <View>
              <Text style={{ ...type.caption, color: t.textMuted }}>TODAY</Text>
              <Text style={{ ...type.heading, color: t.text }}>{formatDay(today, { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
            </View>
            {pregnancy ? <Badge label={`Trimester ${pregnancy.trimester}`} color={t.primaryStrong} bg={t.tint} icon={Baby} />
              : peri ? <Badge label={peri.stageLabel} color={t.primaryStrong} bg={t.tint} />
              : cycle ? <Badge label={cycle.phaseLabel} color={isLate ? t.warning : t.primaryStrong} bg={isLate ? t.warningTint : t.tint} icon={PhaseIcon} />
              : null}
          </View>

          <View style={styles.ringWrap} accessible accessibilityLabel={`${ring.label} ${ring.value}${ring.sub ? `, ${ring.sub}` : ''}`}>
            <Svg width={210} height={210} viewBox="0 0 210 210">
              <Circle cx={105} cy={105} r={radius} stroke={t.surface} strokeWidth={14} fill="transparent" />
              <AnimatedCircle
                cx={105} cy={105} r={radius} stroke={isLate ? t.warning : t.primary} strokeWidth={14} fill="transparent"
                strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset}
                rotation={-90} origin="105, 105"
              />
            </Svg>
            <View style={styles.ringCenter}>
              <Text style={{ ...type.caption, color: t.textMuted }}>{ring.label.toUpperCase()}</Text>
              <Text testID="dashboard-ring-value" style={{ fontSize: 52, fontWeight: '800', color: t.primaryStrong }}>{ring.value}</Text>
              <Text style={{ fontSize: 14, color: t.textMuted }}>{ring.sub}</Text>
            </View>
          </View>

          <Text style={[styles.heroLine, { color: t.text }]}>
            {pregnancy ? `Baby is about the size of ${pregnancy.babySize}`
              : peri ? (peri.daysSinceLastBleed != null ? `${peri.daysSinceLastBleed} days since your last period` : 'Log bleeding days to follow your transition')
              : cycle && cycle.status !== 'no_data' ? (isLate ? 'Your period is late' : phaseInsight(cycle.phase))
              : 'Log your first period to start predictions'}
          </Text>
          {cycle && !isLate && cycle.status !== 'no_data' && (
            <Text style={[styles.heroSub, { color: t.textMuted }]}>
              {cycle.confidence === 'seed' ? 'Based on your onboarding answers — sharpens as you log'
                : cycle.confidence === 'irregular' ? `Your cycles vary a lot (${cycle.spread} days) — dates are wider ranges`
                : cycle.confidence === 'learning' ? `Learning from ${cycle.cyclesTracked} logged cycle${cycle.cyclesTracked === 1 ? '' : 's'}`
                : `Learned from your last ${cycle.cyclesTracked} cycles`}
            </Text>
          )}
          {level && !isLate && (
            <View style={{ alignItems: 'center', marginTop: space.md }}>
              <Badge
                label={level === 'peak' ? 'Peak fertility today' : level === 'high' ? 'High fertility today' : 'Low fertility today'}
                color={level === 'low' ? t.textMuted : t.warning}
                bg={level === 'low' ? t.surface : t.warningTint}
              />
            </View>
          )}
        </Card>

        {/* Stats */}
        <View style={styles.stats}>
          {pregnancy ? (
            <>
              <StatTile icon={CalendarClock} value={`${pregnancy.daysUntilDue}`} label="Days to due date" />
              <StatTile icon={Baby} value={formatDay(pregnancy.dueDate)} label="Due date" color={t.warning} />
            </>
          ) : peri ? (
            <>
              <StatTile icon={Activity} value={peri.spread != null ? `${peri.spread}d` : '—'} label="Cycle variation" sub="longest − shortest" />
              <StatTile icon={Flame} value={peri.hotFlashAvg7 != null ? `${peri.hotFlashAvg7}` : '—'} label="Hot flashes / day" sub="last 7 days" color={t.warning} />
            </>
          ) : cycle && cycle.status !== 'no_data' ? (
            <>
              <StatTile
                testID="stat-period"
                icon={Droplet}
                value={isLate ? `+${cycle.daysLate}d` : `${cycle.daysUntilPeriod}d`}
                label={isLate ? 'Period late' : 'To next period'}
                sub={isLate ? `expected ${formatDay(cycle.nextPeriodDate)}` : `likely ${formatDay(cycle.nextPeriodRange.start)}–${formatDay(cycle.nextPeriodRange.end)}`}
                color={isLate ? t.warning : undefined}
              />
              <StatTile
                icon={Sparkles}
                value={cycle.inFertileWindow ? 'Now' : isLate ? '—' : `${cycle.daysUntilOvulation}d`}
                label={cycle.inFertileWindow ? 'Fertile window' : 'To ovulation'}
                sub={cycle.ovulationStatus === 'confirmed' ? 'confirmed by temperature' : cycle.ovulationStatus === 'likely' ? `likely (${cycle.ovulationSource === 'opk' ? 'ovulation test' : 'mucus'})` : 'estimate'}
                color={t.warning}
              />
            </>
          ) : null}
        </View>
        {(currentMode === 'conceive' || currentMode === 'period') && cycle && (
          <Text style={[styles.disclaimer, { color: t.subtext }]}>Fertility estimates are for awareness only — LunaPredict is not a contraceptive.</Text>
        )}

        {otherFlags.map(f => <FlagBanner key={f.id} flag={f} onDismiss={() => dismissFlag(f.id)} />)}

        {/* Coach */}
        <Pressable
          testID="dashboard-ask-luna"
          onPress={() => navigation.navigate('Coach')}
          accessibilityRole="button"
          accessibilityLabel={`Ask Luna. ${coachStatus}`}
          style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
        >
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={[styles.iconCircle, { backgroundColor: t.tint }]}><MessageCircle color={t.primaryStrong} size={22} /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...type.heading, color: t.text }}>Ask Luna</Text>
              <Text style={{ fontSize: 13, color: t.textMuted, marginTop: 2 }}>{coachStatus}</Text>
            </View>
            <ChevronRight color={t.subtext} size={20} />
          </Card>
        </Pressable>

        {/* Today's log */}
        <SectionLabel style={{ marginTop: space.sm }}>Today</SectionLabel>
        <Card>
          {todayLog ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...type.label, color: t.success }}>Logged today</Text>
                <Text style={{ color: t.textMuted, marginTop: 2 }} numberOfLines={2}>{summarize(todayLog)}</Text>
              </View>
              <Button label="Edit" variant="tonal" compact icon={PenLine} onPress={() => navigation.navigate('Log')} />
            </View>
          ) : (
            <View style={{ gap: space.md }}>
              <Text style={{ color: t.textMuted }}>How are you today? A 20-second log keeps predictions sharp.</Text>
              <Button testID="dashboard-log-today" label="Log today" icon={PenLine} onPress={() => navigation.navigate('Log')} />
            </View>
          )}
        </Card>

        {recentLogs.filter(l => l.day !== today).length > 0 && (
          <>
            <SectionLabel style={{ marginTop: space.sm }}>Recent</SectionLabel>
            <Card>
              {recentLogs.filter(l => l.day !== today).map((log, i) => (
                <Pressable
                  key={log.id}
                  onPress={() => navigation.navigate('LogDay', { day: log.day })}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatDay(log.day, { weekday: 'long', day: 'numeric', month: 'long' })}: ${summarize(log)}. Edit`}
                  style={[styles.logRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }]}
                >
                  <Text style={{ ...type.label, color: t.text, width: 72 }}>{formatDay(log.day, { weekday: 'short', day: 'numeric' })}</Text>
                  <Text style={{ flex: 1, color: t.textMuted }} numberOfLines={1}>{summarize(log)}</Text>
                  <ChevronRight color={t.subtext} size={18} />
                </Pressable>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function summarize(log: { flow: string | null; symptoms: string[]; mood: string | null; energy: string | null; notes: string }): string {
  return [
    log.flow ? `${log.flow} flow` : null,
    log.mood ? MOOD_LABEL[log.mood] ?? log.mood : null,
    log.symptoms.length ? `${log.symptoms.length} symptom${log.symptoms.length > 1 ? 's' : ''}` : null,
    log.energy ? `${log.energy} energy` : null,
  ].filter(Boolean).join(' · ') || (log.notes ? 'Notes' : 'Logged');
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: space.lg, gap: space.md },
  brand: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  hero: { paddingVertical: space.xl },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.sm },
  ringWrap: { alignItems: 'center', justifyContent: 'center', marginVertical: space.lg },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  heroLine: { ...type.heading, textAlign: 'center' },
  heroSub: { fontSize: 13, textAlign: 'center', marginTop: space.xs },
  stats: { flexDirection: 'row', gap: space.md, marginBottom: space.sm },
  disclaimer: { fontSize: 12, textAlign: 'center', marginBottom: space.md },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  logRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: space.sm },
});
