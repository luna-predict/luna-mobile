import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Animated, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { AppMode, Sex, UserProfile } from '../types';
import { toISODay } from '../services/CycleEngine';
import { PearsPartnerService, isValidInviteCode } from '../services/PearsPartnerService';
import { PrimaryButton } from '../ui';

/**
 * First-run onboarding. Two flows:
 *  - Women: goal selection + mode-specific cycle setup (ported from the web app)
 *  - Partners (men side): short — explain the model, optionally link with a code
 */

type StepId =
  | 'welcome' | 'who'
  // women
  | 'goal' | 'cycle' | 'lastPeriod' | 'regularity' | 'dueDate' | 'periLastPeriod'
  | 'notifications' | 'consent'
  // men
  | 'partnerIntro' | 'partnerCode';

const WOMEN_STEPS: Record<AppMode, StepId[]> = {
  period: ['goal', 'cycle', 'lastPeriod', 'regularity', 'notifications', 'consent'],
  conceive: ['goal', 'cycle', 'lastPeriod', 'regularity', 'notifications', 'consent'],
  pregnancy: ['goal', 'dueDate', 'notifications', 'consent'],
  perimenopause: ['goal', 'periLastPeriod', 'notifications', 'consent'],
};
const MEN_STEPS: StepId[] = ['partnerIntro', 'partnerCode', 'consent'];

const GOALS: { id: AppMode; label: string; emoji: string; desc: string; color: string }[] = [
  { id: 'period', label: 'Track My Cycle', emoji: '🩸', desc: 'Predict periods & symptoms', color: '#F43F5E' },
  { id: 'conceive', label: 'Get Pregnant', emoji: '👶', desc: 'Identify fertile days', color: '#14B8A6' },
  { id: 'pregnancy', label: 'Follow Pregnancy', emoji: '🤰', desc: 'Track baby growth week by week', color: '#A855F7' },
  { id: 'perimenopause', label: 'Navigate Changes', emoji: '🌿', desc: 'Manage the transition', color: '#8B5CF6' },
];

function Stepper({ value, onChange, min, max, suffix }: {
  value: number; onChange: (v: number) => void; min: number; max: number; suffix: string;
}) {
  return (
    <View style={styles.stepperRow}>
      <TouchableOpacity style={styles.stepperBtn} onPress={() => onChange(Math.max(min, value - 1))}>
        <Text style={styles.stepperBtnText}>−</Text>
      </TouchableOpacity>
      <View style={{ alignItems: 'center', minWidth: 110 }}>
        <Text style={styles.stepperValue}>{value}</Text>
        <Text style={styles.stepperSuffix}>{suffix}</Text>
      </View>
      <TouchableOpacity style={styles.stepperBtn} onPress={() => onChange(Math.min(max, value + 1))}>
        <Text style={styles.stepperBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function OnboardingScreen() {
  const { saveUser, refreshPartnerLink } = useApp();

  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState(1995);
  const [sex, setSex] = useState<Sex | null>(null);
  const [mode, setModeSel] = useState<AppMode>('period');
  const [cycleLength, setCycleLength] = useState(28);
  const [periodLength, setPeriodLength] = useState(5);
  const [lastPeriodDaysAgo, setLastPeriodDaysAgo] = useState(14);
  const [regularity, setRegularity] = useState<'regular' | 'irregular' | 'unknown' | null>(null);
  const [weeksPregnant, setWeeksPregnant] = useState(8);
  const [periMonthsAgo, setPeriMonthsAgo] = useState(1);
  const [notifPeriod, setNotifPeriod] = useState(true);
  const [notifCheckIn, setNotifCheckIn] = useState(true);
  const [notifInsights, setNotifInsights] = useState(true);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [partnerCode, setPartnerCode] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkedOk, setLinkedOk] = useState(false);

  const fade = useRef(new Animated.Value(1)).current;

  const steps: StepId[] = ['welcome', 'who', ...(sex === 'male' ? MEN_STEPS : WOMEN_STEPS[mode])];
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const progress = (stepIndex + 1) / steps.length;

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [stepIndex]);

  const next = () => setStepIndex(i => Math.min(i + 1, steps.length - 1));
  const back = () => setStepIndex(i => Math.max(i - 1, 0));

  const finish = async () => {
    const today = new Date();
    const lastPeriodStart =
      sex === 'female' && (mode === 'period' || mode === 'conceive')
        ? toISODay(new Date(today.getTime() - lastPeriodDaysAgo * 86400000))
        : mode === 'perimenopause'
          ? toISODay(new Date(today.getTime() - periMonthsAgo * 30 * 86400000))
          : undefined;
    const dueDate = mode === 'pregnancy'
      ? toISODay(new Date(today.getTime() + (40 - weeksPregnant) * 7 * 86400000))
      : undefined;

    const user: UserProfile = {
      id: Date.now().toString(36),
      name: name.trim(),
      birthYear,
      sex: sex ?? 'female',
      mode: sex === 'male' ? 'period' : mode,
      onboardingComplete: true,
      createdAt: new Date().toISOString(),
      avgCycleLength: cycleLength,
      avgPeriodLength: periodLength,
      lastPeriodStart,
      cycleRegularity: regularity ?? 'unknown',
      dueDate,
      notifications: { periodReminders: notifPeriod, dailyCheckIn: notifCheckIn, insights: notifInsights },
      sharing: { sharePhase: true, sharePredictions: true, shareMood: true, shareSymptoms: false },
    };
    await saveUser(user);
  };

  const tryLinkPartner = async () => {
    if (!isValidInviteCode(partnerCode)) {
      Alert.alert('Invalid code', 'The code should look like xxxx-xxxx-xxxx — ask your partner to generate it from Profile → Partner.');
      return;
    }
    setLinking(true);
    try {
      await PearsPartnerService.linkWithCode(partnerCode);
      await refreshPartnerLink();
      setLinkedOk(true);
      setTimeout(next, 900);
    } catch (e: unknown) {
      Alert.alert('Pairing failed', e instanceof Error ? e.message : 'Could not reach the swarm.');
    } finally {
      setLinking(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return (
          <View style={styles.stepBody}>
            <View style={styles.logoWrap}>
              <View style={styles.logoCircle}><Text style={{ fontSize: 44 }}>🌙</Text></View>
            </View>
            <Text style={styles.title}>Welcome to LunaPredict</Text>
            <Text style={styles.subtitle}>
              Private, on-device health intelligence. Your data never leaves your phone unless you choose to share it.
            </Text>
            <Text style={styles.fieldLabel}>What should we call you?</Text>
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor="#94a3b8"
              value={name}
              onChangeText={setName}
              autoFocus
            />
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Birth year</Text>
            <Stepper value={birthYear} onChange={setBirthYear} min={1950} max={2012} suffix="year" />
            <View style={{ flex: 1 }} />
            <PrimaryButton label="Continue" onPress={next} disabled={!name.trim()} />
          </View>
        );

      case 'who':
        return (
          <View style={styles.stepBody}>
            <Text style={styles.title}>Who is Luna for today?</Text>
            <Text style={styles.subtitle}>This shapes your entire experience.</Text>
            {[
              { id: 'female' as Sex, emoji: '🌸', label: 'Track my own health', desc: 'Cycle, fertility, pregnancy or menopause tracking with a private AI coach.' },
              { id: 'male' as Sex, emoji: '🤝', label: "I'm a partner", desc: 'Understand and support your partner\'s cycle — with only what she shares.' },
            ].map(opt => (
              <TouchableOpacity
                key={opt.id}
                onPress={() => setSex(opt.id)}
                style={[styles.bigOption, sex === opt.id && styles.bigOptionSelected]}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 32 }}>{opt.emoji}</Text>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.bigOptionLabel}>{opt.label}</Text>
                  <Text style={styles.bigOptionDesc}>{opt.desc}</Text>
                </View>
                {sex === opt.id && <Text style={styles.check}>✓</Text>}
              </TouchableOpacity>
            ))}
            <View style={{ flex: 1 }} />
            <PrimaryButton label="Continue" onPress={next} disabled={!sex} />
          </View>
        );

      case 'goal':
        return (
          <View style={styles.stepBody}>
            <Text style={styles.title}>What's your goal?</Text>
            <Text style={styles.subtitle}>We'll tailor tracking, insights and your AI coach.</Text>
            {GOALS.map(goal => (
              <TouchableOpacity
                key={goal.id}
                onPress={() => setModeSel(goal.id)}
                style={[styles.bigOption, mode === goal.id && { borderColor: goal.color, backgroundColor: goal.color + '08' }]}
                activeOpacity={0.8}
              >
                <View style={[styles.goalIcon, { backgroundColor: goal.color + '20' }]}>
                  <Text style={{ fontSize: 24 }}>{goal.emoji}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={[styles.bigOptionLabel, mode === goal.id && { color: goal.color }]}>{goal.label}</Text>
                  <Text style={styles.bigOptionDesc}>{goal.desc}</Text>
                </View>
                {mode === goal.id && <Text style={[styles.check, { color: goal.color }]}>✓</Text>}
              </TouchableOpacity>
            ))}
            <View style={{ flex: 1 }} />
            <PrimaryButton label="Next" onPress={next} />
          </View>
        );

      case 'cycle':
        return (
          <View style={styles.stepBody}>
            <Text style={styles.title}>Your cycle details</Text>
            <Text style={styles.subtitle}>This seeds your first predictions — Luna learns and refines them as you log.</Text>
            <Text style={styles.fieldLabel}>Average cycle length</Text>
            <Stepper value={cycleLength} onChange={setCycleLength} min={21} max={45} suffix="days" />
            <Text style={styles.hint}>Most cycles are 21–35 days</Text>
            <Text style={[styles.fieldLabel, { marginTop: 20 }]}>Average period length</Text>
            <Stepper value={periodLength} onChange={setPeriodLength} min={2} max={10} suffix="days" />
            <View style={{ flex: 1 }} />
            <PrimaryButton label="Next" onPress={next} />
          </View>
        );

      case 'lastPeriod': {
        const date = new Date(Date.now() - lastPeriodDaysAgo * 86400000);
        return (
          <View style={styles.stepBody}>
            <Text style={styles.title}>When did your last period start?</Text>
            <Text style={styles.subtitle}>The single most important data point for your first prediction.</Text>
            <Stepper value={lastPeriodDaysAgo} onChange={setLastPeriodDaysAgo} min={0} max={60} suffix="days ago" />
            <View style={styles.dateCard}>
              <Text style={styles.dateCardText}>
                {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
            </View>
            <View style={styles.quickRow}>
              {[['Today', 0], ['1 week ago', 7], ['2 weeks ago', 14], ['3 weeks ago', 21]].map(([label, v]) => (
                <TouchableOpacity key={label as string} style={styles.quickChip} onPress={() => setLastPeriodDaysAgo(v as number)}>
                  <Text style={styles.quickChipText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flex: 1 }} />
            <PrimaryButton label="Next" onPress={next} />
          </View>
        );
      }

      case 'regularity':
        return (
          <View style={styles.stepBody}>
            <Text style={styles.title}>How regular is your cycle?</Text>
            <Text style={styles.subtitle}>This calibrates how confident predictions should be.</Text>
            {[
              { id: 'regular', label: 'Regular', desc: 'Consistent timing each month' },
              { id: 'irregular', label: 'Irregular', desc: 'Varies significantly' },
              { id: 'unknown', label: "I'm not sure", desc: "Haven't tracked before" },
            ].map(opt => (
              <TouchableOpacity
                key={opt.id}
                onPress={() => setRegularity(opt.id as typeof regularity)}
                style={[styles.bigOption, regularity === opt.id && styles.bigOptionSelected]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.bigOptionLabel}>{opt.label}</Text>
                  <Text style={styles.bigOptionDesc}>{opt.desc}</Text>
                </View>
                {regularity === opt.id && <Text style={styles.check}>✓</Text>}
              </TouchableOpacity>
            ))}
            <View style={{ flex: 1 }} />
            <PrimaryButton label="Next" onPress={next} disabled={!regularity} />
          </View>
        );

      case 'dueDate': {
        const due = new Date(Date.now() + (40 - weeksPregnant) * 7 * 86400000);
        return (
          <View style={styles.stepBody}>
            <Text style={styles.title}>How far along are you?</Text>
            <Text style={styles.subtitle}>We'll compute your due date and track each week with you.</Text>
            <Stepper value={weeksPregnant} onChange={setWeeksPregnant} min={1} max={40} suffix="weeks pregnant" />
            <View style={styles.dateCard}>
              <Text style={styles.hint}>Estimated due date</Text>
              <Text style={styles.dateCardText}>
                {due.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
            <View style={{ flex: 1 }} />
            <PrimaryButton label="Next" onPress={next} />
          </View>
        );
      }

      case 'periLastPeriod':
        return (
          <View style={styles.stepBody}>
            <Text style={styles.title}>When was your last period?</Text>
            <Text style={styles.subtitle}>Cycles often become irregular in perimenopause — an estimate is fine.</Text>
            <Stepper value={periMonthsAgo} onChange={setPeriMonthsAgo} min={0} max={24} suffix="months ago" />
            <View style={{ flex: 1 }} />
            <PrimaryButton label="Next" onPress={next} />
          </View>
        );

      case 'notifications':
        return (
          <View style={styles.stepBody}>
            <Text style={styles.title}>Stay in the loop</Text>
            <Text style={styles.subtitle}>All reminders are generated on-device.</Text>
            {[
              { label: '🔔 Period reminders', value: notifPeriod, set: setNotifPeriod },
              { label: '📝 Daily check-in nudge', value: notifCheckIn, set: setNotifCheckIn },
              { label: '💡 Cycle insights', value: notifInsights, set: setNotifInsights },
            ].map(row => (
              <TouchableOpacity
                key={row.label}
                onPress={() => row.set(!row.value)}
                style={[styles.bigOption, { paddingVertical: 16 }]}
              >
                <Text style={[styles.bigOptionLabel, { flex: 1 }]}>{row.label}</Text>
                <View style={[styles.toggle, row.value && styles.toggleOn]}>
                  <View style={[styles.toggleDot, row.value && styles.toggleDotOn]} />
                </View>
              </TouchableOpacity>
            ))}
            <View style={{ flex: 1 }} />
            <PrimaryButton label="Next" onPress={next} />
          </View>
        );

      case 'partnerIntro':
        return (
          <View style={styles.stepBody}>
            <Text style={styles.title}>Partner mode</Text>
            <Text style={styles.subtitle}>Here's the deal — she stays in control.</Text>
            {[
              ['👀', 'You see only what she shares', 'Phase, predictions, mood — she picks exactly which, from her app.'],
              ['🔒', 'Peer-to-peer, no servers', 'Data syncs directly between your phones over an encrypted Pears connection.'],
              ['🚫', "You can't edit her data", 'Partner mode is read-only. You track your own wellness separately.'],
              ['🤖', 'Your own AI coach', 'Ask how to support her in each phase — plus tips for yourself.'],
            ].map(([emoji, title, desc]) => (
              <View key={title} style={styles.infoRow}>
                <Text style={{ fontSize: 24 }}>{emoji}</Text>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.bigOptionLabel}>{title}</Text>
                  <Text style={styles.bigOptionDesc}>{desc}</Text>
                </View>
              </View>
            ))}
            <View style={{ flex: 1 }} />
            <PrimaryButton label="Got it" onPress={next} />
          </View>
        );

      case 'partnerCode':
        return (
          <View style={styles.stepBody}>
            <Text style={styles.title}>Link with your partner</Text>
            <Text style={styles.subtitle}>
              Ask her to open LunaPredict → Profile → Partner and generate a pairing code.
            </Text>
            <TextInput
              style={[styles.input, { textAlign: 'center', fontSize: 18, letterSpacing: 2 }]}
              placeholder="xxxx-xxxx-xxxx"
              placeholderTextColor="#94a3b8"
              value={partnerCode}
              onChangeText={setPartnerCode}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {linkedOk && <Text style={styles.linkedOk}>✓ Paired successfully over Pears P2P</Text>}
            <View style={{ flex: 1 }} />
            <PrimaryButton label={linking ? 'Pairing…' : 'Pair now'} onPress={tryLinkPartner} loading={linking} disabled={!partnerCode.trim()} />
            <TouchableOpacity onPress={next} style={{ alignItems: 'center', paddingVertical: 14 }}>
              <Text style={{ color: '#94a3b8', fontWeight: '600' }}>Skip — link later from Profile</Text>
            </TouchableOpacity>
          </View>
        );

      case 'consent':
        return (
          <View style={styles.stepBody}>
            <Text style={styles.title}>Your data, your device</Text>
            <Text style={styles.subtitle}>How LunaPredict handles privacy:</Text>
            {[
              ['📱', 'Everything is stored locally on this phone — there is no LunaPredict server.'],
              ['🧠', 'AI runs on-device (QVAC MedPsy). Optional P2P compute is end-to-end encrypted.'],
              ['🤝', 'Partner sharing is opt-in, granular, and revocable at any time.'],
            ].map(([emoji, text]) => (
              <View key={text} style={styles.infoRow}>
                <Text style={{ fontSize: 22 }}>{emoji}</Text>
                <Text style={[styles.bigOptionDesc, { flex: 1, marginLeft: 12, fontSize: 14, lineHeight: 20 }]}>{text}</Text>
              </View>
            ))}
            <TouchableOpacity
              onPress={() => setConsentPrivacy(!consentPrivacy)}
              style={[styles.bigOption, consentPrivacy && styles.bigOptionSelected, { marginTop: 8 }]}
            >
              <View style={[styles.checkbox, consentPrivacy && styles.checkboxOn]}>
                {consentPrivacy && <Text style={{ color: '#fff', fontWeight: '800' }}>✓</Text>}
              </View>
              <Text style={[styles.bigOptionDesc, { flex: 1, marginLeft: 12 }]}>
                I understand my data stays on my device and I'm in control of any sharing.
              </Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <PrimaryButton label="Start using Luna 🌙" onPress={finish} disabled={!consentPrivacy} />
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Progress + back */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={back} disabled={stepIndex === 0} style={{ opacity: stepIndex === 0 ? 0 : 1, padding: 8 }}>
            <Text style={{ fontSize: 20, color: '#64748b' }}>‹</Text>
          </TouchableOpacity>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <View style={{ width: 36 }} />
        </View>
        <Animated.View style={{ flex: 1, opacity: fade }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }} keyboardShouldPersistTaps="handled">
            {renderStep()}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF7F8' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#fde8ec', marginHorizontal: 8, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#F43F5E' },
  stepBody: { flex: 1, minHeight: 520 },
  logoWrap: { alignItems: 'center', marginTop: 12, marginBottom: 20 },
  logoCircle: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#F43F5E', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 8,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#1e293b', marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#64748b', lineHeight: 21, marginBottom: 24 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 },
  input: {
    backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: '#1e293b', borderWidth: 1.5, borderColor: '#e2e8f0',
  },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, paddingVertical: 8 },
  stepperBtn: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#e2e8f0',
  },
  stepperBtnText: { fontSize: 26, color: '#F43F5E', fontWeight: '600', marginTop: -2 },
  stepperValue: { fontSize: 36, fontWeight: '800', color: '#F43F5E' },
  stepperSuffix: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  hint: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 6 },
  dateCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 16,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
  },
  dateCardText: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, justifyContent: 'center' },
  quickChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  quickChipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  bigOption: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, marginBottom: 10,
    borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#fff',
  },
  bigOptionSelected: { borderColor: '#F43F5E', backgroundColor: '#F43F5E08' },
  bigOptionLabel: { fontSize: 15, fontWeight: '700', color: '#334155' },
  bigOptionDesc: { fontSize: 12, color: '#94a3b8', marginTop: 2, lineHeight: 17 },
  goalIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  check: { fontSize: 18, fontWeight: '800', color: '#F43F5E' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10 },
  toggle: {
    width: 48, height: 28, borderRadius: 14, backgroundColor: '#e2e8f0', padding: 3, justifyContent: 'center',
  },
  toggleOn: { backgroundColor: '#F43F5E' },
  toggleDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  toggleDotOn: { alignSelf: 'flex-end' },
  checkbox: {
    width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: '#cbd5e1',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#F43F5E', borderColor: '#F43F5E' },
  linkedOk: { color: '#059669', fontWeight: '700', textAlign: 'center', marginTop: 14 },
});
