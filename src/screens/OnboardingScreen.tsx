import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Animated, KeyboardAvoidingView, Platform, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getLocales } from 'expo-localization';
import { ChevronLeft, Moon, Droplet, HeartPulse, Baby, Flower2, HeartHandshake, User as UserIcon, Eye, Lock, Ban, MessageCircle, ShieldCheck, Smartphone, Brain, Check } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { AppMode, CoachLanguage, Sex, UserProfile } from '../types';
import { addDays, lmpFromWeeks } from '../domain';
import { PearsPartnerService, isValidInviteCode } from '../services/PearsPartnerService';
import { Reminders } from '../services/Reminders';
import { coachEngine } from '../ai/engine';
import { Button, Stepper, Segmented, useReducedMotion, useToast, space, type, radius, WOMEN_THEMES } from '../ui';

/**
 * First run. Women: goal + only the seed data that goal needs. Partners: what they'll see,
 * optional pairing. Both: reminders (with a real permission prompt) and privacy consent.
 */

type StepId = 'welcome' | 'who' | 'goal' | 'cycle' | 'lastPeriod' | 'regularity' | 'pregnancy' | 'periLastPeriod'
  | 'notifications' | 'consent' | 'partnerIntro' | 'partnerCode';

const WOMEN_STEPS: Record<AppMode, StepId[]> = {
  period: ['goal', 'cycle', 'lastPeriod', 'regularity', 'notifications', 'consent'],
  conceive: ['goal', 'cycle', 'lastPeriod', 'regularity', 'notifications', 'consent'],
  pregnancy: ['goal', 'pregnancy', 'notifications', 'consent'],
  perimenopause: ['goal', 'periLastPeriod', 'notifications', 'consent'],
};
const MEN_STEPS: StepId[] = ['partnerIntro', 'partnerCode', 'notifications', 'consent'];

const GOALS: { id: AppMode; label: string; desc: string; icon: React.ComponentType<{ color?: string; size?: number }> }[] = [
  { id: 'period', label: 'Track my cycle', desc: 'Predict periods and understand symptoms', icon: Droplet },
  { id: 'conceive', label: 'Get pregnant', desc: 'Find your fertile days (not a contraceptive)', icon: HeartPulse },
  { id: 'pregnancy', label: 'Follow my pregnancy', desc: 'Week by week, kick counts, due date', icon: Baby },
  { id: 'perimenopause', label: 'Navigate perimenopause', desc: 'Transition stage, hot flashes, sleep', icon: Flower2 },
];

const T = WOMEN_THEMES.period;

export default function OnboardingScreen() {
  const { saveUser, refreshPartnerLink, today } = useApp();
  const toast = useToast();
  const reducedMotion = useReducedMotion();

  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState(1995);
  const [language, setLanguage] = useState<CoachLanguage>(() => (getLocales()[0]?.languageCode === 'sw' ? 'sw' : 'en'));
  const [sex, setSex] = useState<Sex | null>(null);
  const [mode, setMode] = useState<AppMode>('period');
  const [cycleLength, setCycleLength] = useState(28);
  const [periodLength, setPeriodLength] = useState(5);
  const [lastPeriodDaysAgo, setLastPeriodDaysAgo] = useState(14);
  const [lastPeriodUnknown, setLastPeriodUnknown] = useState(false);
  const [regularity, setRegularity] = useState<'regular' | 'irregular' | 'unknown' | null>(null);
  const [pregSource, setPregSource] = useState<'weeks' | 'lmp' | 'dueDate'>('weeks');
  const [weeksPregnant, setWeeksPregnant] = useState(8);
  const [lmpDaysAgo, setLmpDaysAgo] = useState(56);
  const [weeksUntilDue, setWeeksUntilDue] = useState(32);
  const [periMonthsAgo, setPeriMonthsAgo] = useState(1);
  const [notifPeriod, setNotifPeriod] = useState(true);
  const [notifCheckIn, setNotifCheckIn] = useState(true);
  const [checkInTime, setCheckInTime] = useState('20:00');
  const [consent, setConsent] = useState(false);
  const [partnerCode, setPartnerCode] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkedOk, setLinkedOk] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const fade = useRef(new Animated.Value(1)).current;
  const steps: StepId[] = ['welcome', 'who', ...(sex === 'male' ? MEN_STEPS : WOMEN_STEPS[mode])];
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const progress = (stepIndex + 1) / steps.length;

  useEffect(() => {
    if (reducedMotion) return;
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [stepIndex, reducedMotion, fade]);

  const next = () => setStepIndex(i => Math.min(i + 1, steps.length - 1));
  const back = () => setStepIndex(i => Math.max(i - 1, 0));

  const finish = async () => {
    setFinishing(true);
    const isWoman = sex === 'female';
    const lastPeriodStart = isWoman && (mode === 'period' || mode === 'conceive') && !lastPeriodUnknown
      ? addDays(today, -lastPeriodDaysAgo)
      : isWoman && mode === 'perimenopause' ? addDays(today, -periMonthsAgo * 30) : undefined;
    let pregnancy: UserProfile['pregnancy'];
    if (isWoman && mode === 'pregnancy') {
      const lmp = pregSource === 'weeks' ? lmpFromWeeks(weeksPregnant, 0)
        : pregSource === 'lmp' ? addDays(today, -lmpDaysAgo)
        : addDays(addDays(today, weeksUntilDue * 7), -280);
      pregnancy = { lmp, dueDate: addDays(lmp, 280), source: pregSource };
    }
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
      pregnancy,
      dueDate: pregnancy?.dueDate,
      notifications: { periodReminders: notifPeriod && isWoman, dailyCheckIn: notifCheckIn, insights: false, checkInTime },
      sharing: { sharePhase: true, sharePredictions: true, shareMood: true, shareSymptoms: false, sharePregnancy: true },
      language,
      voiceOutput: 'off',
    };
    await saveUser(user);
  };

  const askNotifications = async () => {
    if (notifPeriod || notifCheckIn) {
      const granted = await Reminders.requestPermission().catch(() => false);
      if (!granted) {
        setNotifPeriod(false);
        setNotifCheckIn(false);
        toast.show('Reminders stay off — you can turn them on later in Profile', 'info');
      }
    }
    next();
  };

  const tryLinkPartner = async () => {
    if (!isValidInviteCode(partnerCode)) {
      toast.show('That code should look like xxxx-xxxx-xxxx', 'error');
      return;
    }
    setLinking(true);
    try {
      await PearsPartnerService.linkWithCode(partnerCode);
      await refreshPartnerLink();
      setLinkedOk(true);
      setTimeout(next, 700);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Pairing failed', 'error');
    } finally {
      setLinking(false);
    }
  };

  const BigOption = ({ selected, onPress, icon: Icon, label, desc, testID }: { selected: boolean; onPress: () => void; icon: React.ComponentType<{ color?: string; size?: number }>; label: string; desc: string; testID?: string }) => (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}. ${desc}`}
      style={({ pressed }) => [styles.option, selected && styles.optionOn, { opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={[styles.optionIcon, { backgroundColor: selected ? T.tint : T.surface }]}><Icon color={selected ? T.primaryStrong : T.textMuted} size={24} /></View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.optionLabel, selected && { color: T.primaryStrong }]}>{label}</Text>
        <Text style={styles.optionDesc}>{desc}</Text>
      </View>
      {selected && <Check color={T.primaryStrong} size={22} />}
    </Pressable>
  );

  const ToggleRow = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <View style={styles.toggleRow}>
      <Text style={[styles.optionLabel, { flex: 1 }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: T.primaryStrong, false: T.border }} thumbColor="#FFFFFF" accessibilityLabel={label} />
    </View>
  );

  const Info = ({ icon: Icon, title, desc }: { icon: React.ComponentType<{ color?: string; size?: number }>; title: string; desc: string }) => (
    <View style={styles.infoRow}>
      <View style={[styles.optionIcon, { backgroundColor: T.tint }]}><Icon color={T.primaryStrong} size={22} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.optionLabel}>{title}</Text>
        <Text style={styles.optionDesc}>{desc}</Text>
      </View>
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return (
          <View style={styles.body}>
            <View style={styles.logo}><Moon color={T.primaryStrong} size={44} /></View>
            <Text accessibilityRole="header" style={styles.title}>Welcome to LunaPredict</Text>
            <Text style={styles.subtitle}>Private health tracking with an AI coach that runs on your phone. Your data never leaves it unless you choose to share.</Text>
            <Text style={styles.field}>What should we call you?</Text>
            <TextInput
              testID="onboarding-name"
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor={T.subtext}
              value={name}
              onChangeText={setName}
              autoComplete="name"
              accessibilityLabel="Your name"
            />
            <Text style={[styles.field, { marginTop: space.xl }]}>Birth year</Text>
            <Stepper label="Birth year" value={birthYear} onChange={setBirthYear} min={1950} max={2012} suffix="year" />
            <Text style={[styles.field, { marginTop: space.xl }]}>Luna replies in</Text>
            <Segmented value={language} onChange={v => setLanguage(v as CoachLanguage)} options={[{ value: 'en', label: 'English' }, { value: 'sw', label: 'Kiswahili' }]} />
            <View style={{ flex: 1, minHeight: space.xl }} />
            <Button testID="onboarding-continue" label="Continue" onPress={next} disabled={!name.trim()} />
          </View>
        );
      case 'who':
        return (
          <View style={styles.body}>
            <Text accessibilityRole="header" style={styles.title}>Who is Luna for?</Text>
            <Text style={styles.subtitle}>This shapes your whole experience. You can't switch later without starting again.</Text>
            <View accessibilityRole="radiogroup">
              <BigOption testID="who-female" selected={sex === 'female'} onPress={() => setSex('female')} icon={UserIcon} label="Track my own health" desc="Cycle, fertility, pregnancy or perimenopause, with a private AI coach" />
              <BigOption testID="who-male" selected={sex === 'male'} onPress={() => setSex('male')} icon={HeartHandshake} label="I'm a partner" desc="Understand and support your partner with what she chooses to share" />
            </View>
            <View style={{ flex: 1 }} />
            <Button testID="onboarding-continue" label="Continue" onPress={next} disabled={!sex} />
          </View>
        );
      case 'goal':
        return (
          <View style={styles.body}>
            <Text accessibilityRole="header" style={styles.title}>What's your goal?</Text>
            <Text style={styles.subtitle}>Luna tailors tracking, predictions and coaching. Change it any time in Profile.</Text>
            <View accessibilityRole="radiogroup">
              {GOALS.map(g => <BigOption key={g.id} testID={`goal-${g.id}`} selected={mode === g.id} onPress={() => setMode(g.id)} icon={g.icon} label={g.label} desc={g.desc} />)}
            </View>
            <View style={{ flex: 1 }} />
            <Button testID="onboarding-continue" label="Next" onPress={next} />
          </View>
        );
      case 'cycle':
        return (
          <View style={styles.body}>
            <Text accessibilityRole="header" style={styles.title}>Your usual cycle</Text>
            <Text style={styles.subtitle}>A starting point only — Luna learns your real pattern as you log.</Text>
            <Text style={styles.field}>Cycle length (first day of one period to the next)</Text>
            <Stepper label="Cycle length" value={cycleLength} onChange={setCycleLength} min={21} max={45} suffix="days" />
            <Text style={styles.hint}>Most cycles are 24–38 days. Not sure? Keep 28.</Text>
            <Text style={[styles.field, { marginTop: space.xl }]}>Period length</Text>
            <Stepper label="Period length" value={periodLength} onChange={setPeriodLength} min={2} max={10} suffix="days" />
            <View style={{ flex: 1 }} />
            <Button testID="onboarding-continue" label="Next" onPress={next} />
          </View>
        );
      case 'lastPeriod':
        return (
          <View style={styles.body}>
            <Text accessibilityRole="header" style={styles.title}>When did your last period start?</Text>
            <Text style={styles.subtitle}>The most useful thing for your first prediction.</Text>
            {!lastPeriodUnknown && (
              <>
                <Stepper label="Days since your last period started" value={lastPeriodDaysAgo} onChange={setLastPeriodDaysAgo} min={0} max={90} suffix="days ago" />
                <Text style={styles.dateLine}>{new Date(addDays(today, -lastPeriodDaysAgo) + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
                <View style={styles.quickRow}>
                  {[['Today', 0], ['1 week', 7], ['2 weeks', 14], ['3 weeks', 21]].map(([l, v]) => (
                    <Pressable key={l} onPress={() => setLastPeriodDaysAgo(v as number)} accessibilityRole="button" accessibilityLabel={`${l} ago`}
                      style={[styles.quick, lastPeriodDaysAgo === v && { borderColor: T.primaryStrong }]}>
                      <Text style={styles.quickText}>{l === 'Today' ? l : `${l} ago`}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            <ToggleRow label="I don't remember" value={lastPeriodUnknown} onChange={setLastPeriodUnknown} />
            {lastPeriodUnknown && <Text style={styles.hint}>No problem — log your next period when it starts and predictions begin from there.</Text>}
            <View style={{ flex: 1 }} />
            <Button testID="onboarding-continue" label="Next" onPress={next} />
          </View>
        );
      case 'regularity':
        return (
          <View style={styles.body}>
            <Text accessibilityRole="header" style={styles.title}>How regular is your cycle?</Text>
            <Text style={styles.subtitle}>Helps Luna decide how wide to make prediction ranges at first.</Text>
            <View accessibilityRole="radiogroup">
              <BigOption selected={regularity === 'regular'} onPress={() => setRegularity('regular')} icon={Check} label="Regular" desc="About the same each month" />
              <BigOption selected={regularity === 'irregular'} onPress={() => setRegularity('irregular')} icon={HeartPulse} label="Irregular" desc="Varies by a week or more" />
              <BigOption selected={regularity === 'unknown'} onPress={() => setRegularity('unknown')} icon={Eye} label="Not sure" desc="I haven't tracked before" />
            </View>
            <View style={{ flex: 1 }} />
            <Button testID="onboarding-continue" label="Next" onPress={next} disabled={!regularity} />
          </View>
        );
      case 'pregnancy': {
        const lmp = pregSource === 'weeks' ? lmpFromWeeks(weeksPregnant, 0) : pregSource === 'lmp' ? addDays(today, -lmpDaysAgo) : addDays(addDays(today, weeksUntilDue * 7), -280);
        const due = addDays(lmp, 280);
        return (
          <View style={styles.body}>
            <Text accessibilityRole="header" style={styles.title}>How far along are you?</Text>
            <Text style={styles.subtitle}>Use whichever you know.</Text>
            <Segmented value={pregSource} onChange={v => setPregSource(v as typeof pregSource)}
              options={[{ value: 'weeks', label: 'Weeks' }, { value: 'lmp', label: 'Last period' }, { value: 'dueDate', label: 'Due date' }]} />
            <View style={{ height: space.lg }} />
            {pregSource === 'weeks' && <Stepper label="Weeks pregnant" value={weeksPregnant} onChange={setWeeksPregnant} min={1} max={42} suffix="weeks pregnant" />}
            {pregSource === 'lmp' && <Stepper label="Last period started, days ago" value={lmpDaysAgo} onChange={setLmpDaysAgo} min={7} max={300} suffix="days ago" />}
            {pregSource === 'dueDate' && <Stepper label="Weeks until your due date" value={weeksUntilDue} onChange={setWeeksUntilDue} min={0} max={40} suffix="weeks to go" />}
            <View style={styles.dueCard}>
              <Text style={styles.hint}>Estimated due date</Text>
              <Text style={[styles.optionLabel, { fontSize: 18 }]}>{new Date(due + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
            </View>
            <View style={{ flex: 1 }} />
            <Button testID="onboarding-continue" label="Next" onPress={next} />
          </View>
        );
      }
      case 'periLastPeriod':
        return (
          <View style={styles.body}>
            <Text accessibilityRole="header" style={styles.title}>When was your last period?</Text>
            <Text style={styles.subtitle}>Cycles often become irregular in perimenopause — an estimate is fine. Luna tracks your stage rather than predicting dates.</Text>
            <Stepper label="Months since your last period" value={periMonthsAgo} onChange={setPeriMonthsAgo} min={0} max={24} suffix="months ago" />
            <View style={{ flex: 1 }} />
            <Button testID="onboarding-continue" label="Next" onPress={next} />
          </View>
        );
      case 'notifications':
        return (
          <View style={styles.body}>
            <Text accessibilityRole="header" style={styles.title}>Gentle reminders</Text>
            <Text style={styles.subtitle}>Scheduled on your phone — no server involved.</Text>
            {sex === 'female' && <ToggleRow label="When my period is due" value={notifPeriod} onChange={setNotifPeriod} />}
            <ToggleRow label="Daily check-in" value={notifCheckIn} onChange={setNotifCheckIn} />
            {notifCheckIn && (
              <View style={{ marginTop: space.md }}>
                <Segmented value={checkInTime} onChange={setCheckInTime} options={[{ value: '08:00', label: 'Morning' }, { value: '13:00', label: 'Midday' }, { value: '20:00', label: 'Evening' }]} />
              </View>
            )}
            <View style={{ flex: 1 }} />
            <Button testID="onboarding-continue" label="Next" onPress={askNotifications} />
          </View>
        );
      case 'partnerIntro':
        return (
          <View style={styles.body}>
            <Text accessibilityRole="header" style={styles.title}>Partner mode</Text>
            <Text style={styles.subtitle}>She stays in control.</Text>
            <Info icon={Eye} title="You see only what she shares" desc="Phase, predictions, mood — she picks exactly which, from her app." />
            <Info icon={Lock} title="Phone to phone" desc="Pairing uses a one-time code between your phones." />
            <Info icon={Ban} title="Read-only" desc="You can't edit her data. Your own check-ins stay on your phone." />
            <Info icon={MessageCircle} title="Your own AI coach" desc="Ask how to support her in each phase, and get tips for yourself." />
            <View style={{ flex: 1 }} />
            <Button testID="onboarding-continue" label="Got it" onPress={next} />
          </View>
        );
      case 'partnerCode':
        return (
          <View style={styles.body}>
            <Text accessibilityRole="header" style={styles.title}>Link with your partner</Text>
            <Text style={styles.subtitle}>Ask her to open LunaPredict → Profile → Partner sharing and create a code.</Text>
            <TextInput
              testID="partner-code"
              style={[styles.input, { textAlign: 'center', fontSize: 20, letterSpacing: 2 }]}
              placeholder="xxxx-xxxx-xxxx"
              placeholderTextColor={T.subtext}
              value={partnerCode}
              onChangeText={setPartnerCode}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Pairing code"
            />
            {linkedOk && <Text style={styles.linked} accessibilityLiveRegion="polite">Linked</Text>}
            <View style={{ flex: 1 }} />
            <Button label="Link now" onPress={tryLinkPartner} loading={linking} disabled={!partnerCode.trim()} />
            <Button label="Skip — link later" variant="ghost" onPress={next} style={{ marginTop: space.sm }} />
          </View>
        );
      case 'consent':
        return (
          <View style={styles.body}>
            <Text accessibilityRole="header" style={styles.title}>Your data, your phone</Text>
            <Text style={styles.subtitle}>How LunaPredict handles privacy:</Text>
            <Info icon={Smartphone} title="Stored only on this phone" desc="There is no LunaPredict server and no account." />
            <Info icon={Brain} title="AI on the phone" desc={coachEngine.kind() === 'qvac'
              ? 'Luna runs QVAC MedPsy on this phone after a one-time download. Your questions never leave it.'
              : 'This preview uses demo answers. The LunaPredict build runs QVAC MedPsy on the phone.'} />
            <Info icon={ShieldCheck} title="Estimates, not diagnosis" desc="Predictions are for awareness. LunaPredict is not a contraceptive or a medical device." />
            <Pressable
              testID="consent-check"
              onPress={() => setConsent(c => !c)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consent }}
              style={[styles.option, consent && styles.optionOn, { marginTop: space.md }]}
            >
              <View style={[styles.checkbox, consent && { backgroundColor: T.primaryStrong, borderColor: T.primaryStrong }]}>
                {consent && <Check color="#FFFFFF" size={16} />}
              </View>
              <Text style={[styles.optionDesc, { flex: 1, fontSize: 15, color: T.text }]}>I understand my data stays on my phone and I control any sharing.</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Button testID="onboarding-finish" label="Start using Luna" onPress={finish} loading={finishing} disabled={!consent} />
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          <Pressable onPress={back} disabled={stepIndex === 0} accessibilityRole="button" accessibilityLabel="Back"
            style={[styles.back, { opacity: stepIndex === 0 ? 0 : 1 }]}>
            <ChevronLeft color={T.textMuted} size={24} />
          </Pressable>
          <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: steps.length, now: stepIndex + 1 }} accessibilityLabel={`Step ${stepIndex + 1} of ${steps.length}`}>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <View style={{ width: 48 }} />
        </View>
        <Animated.View style={{ flex: 1, opacity: fade }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, padding: space.xl }} keyboardShouldPersistTaps="handled">
            {renderStep()}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.background },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingTop: space.sm },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: T.tint, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: T.primaryStrong },
  body: { flex: 1, minHeight: 540 },
  logo: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: space.xl, elevation: 4, shadowColor: T.primary, shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  title: { ...type.title, fontSize: 26, color: T.text, marginBottom: space.sm },
  subtitle: { fontSize: 15, lineHeight: 22, color: T.textMuted, marginBottom: space.xl },
  field: { ...type.label, color: T.text, marginBottom: space.sm },
  hint: { fontSize: 13, color: T.subtext, textAlign: 'center', marginTop: space.sm, lineHeight: 18 },
  input: { backgroundColor: '#FFFFFF', borderRadius: radius.md, paddingHorizontal: space.lg, minHeight: 54, fontSize: 17, color: T.text, borderWidth: 1.5, borderColor: T.border },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, marginBottom: space.md, borderWidth: 2, borderColor: T.border, backgroundColor: '#FFFFFF', minHeight: 72 },
  optionOn: { borderColor: T.primaryStrong, backgroundColor: '#FFF7F8' },
  optionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { fontSize: 16, fontWeight: '700', color: T.text },
  optionDesc: { fontSize: 13, color: T.textMuted, marginTop: 2, lineHeight: 18 },
  dateLine: { textAlign: 'center', fontSize: 16, fontWeight: '700', color: T.text, marginTop: space.sm },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center', marginTop: space.lg, marginBottom: space.lg },
  quick: { paddingHorizontal: space.lg, minHeight: 40, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: T.border },
  quickText: { fontSize: 14, fontWeight: '600', color: T.textMuted },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border },
  dueCard: { backgroundColor: '#FFFFFF', borderRadius: radius.md, padding: space.lg, alignItems: 'center', marginTop: space.lg, gap: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.sm },
  checkbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  linked: { color: T.success, fontWeight: '700', textAlign: 'center', marginTop: space.md },
});
