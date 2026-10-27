import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  Droplet, Baby, HeartPulse, Flower2, Brain, HeartHandshake, Wallet, Bell, CalendarClock, Download, Trash2, Info,
  FlaskConical, Languages, Volume2, Lock, Check,
} from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { AppMode, CoachLanguage } from '../types';
import { Card, SectionLabel, SettingsRow, Badge, Sheet, Button, Segmented, useToast, space, type, radius } from '../ui';
import { ModelManager } from '../services/ModelManager';
import { Reminders } from '../services/Reminders';
import { Store } from '../storage/Store';
import { useModelRegistryVersion } from '../ai/useModels';
import { coachEngine } from '../ai/engine';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ModeSetupSheet, needsSetup } from './components/ModeSetupSheet';

const GOALS: { id: AppMode; label: string; desc: string; icon: React.ComponentType<{ color?: string; size?: number }> }[] = [
  { id: 'period', label: 'Track my cycle', desc: 'Periods, symptoms and predictions', icon: Droplet },
  { id: 'conceive', label: 'Trying to conceive', desc: 'Fertile window, ovulation tests, temperature', icon: HeartPulse },
  { id: 'pregnancy', label: 'Pregnancy', desc: 'Week by week, kick counts, due date', icon: Baby },
  { id: 'perimenopause', label: 'Perimenopause', desc: 'Transition stage, hot flashes, sleep', icon: Flower2 },
];

const CHECKIN_TIMES = [{ value: '08:00', label: 'Morning' }, { value: '13:00', label: 'Midday' }, { value: '20:00', label: 'Evening' }];

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const toast = useToast();
  const { currentMode, themeColors: t, user, updateUser, partnerLink, resetApp, logs, cycle } = useApp();
  const isPartner = user?.sex === 'male';
  const [setupTarget, setSetupTarget] = useState<AppMode | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteModels, setDeleteModels] = useState(false);
  useModelRegistryVersion();

  if (!user) return null;
  const activeModel = ModelManager.getActiveModel();
  const engineKind = coachEngine.kind();
  const language: CoachLanguage = user.language ?? 'en';

  const chooseGoal = async (mode: AppMode) => {
    if (mode === currentMode) return;
    if (needsSetup(currentMode, mode)) setSetupTarget(mode);
    else {
      await updateUser({ mode });
      toast.show(mode === 'conceive' ? 'Trying to conceive — fertility signs added to your log' : 'Cycle tracking on');
    }
  };

  const setNotif = async (key: 'periodReminders' | 'dailyCheckIn', value: boolean) => {
    if (value) {
      const granted = await Reminders.requestPermission();
      if (!granted) {
        Alert.alert('Notifications are off', 'Allow notifications for LunaPredict in your phone settings to get reminders.');
        return;
      }
    }
    await updateUser({ notifications: { ...user.notifications, [key]: value } });
    const count = await Reminders.reschedule({ ...user, notifications: { ...user.notifications, [key]: value } }, cycle).catch(() => 0);
    toast.show(value ? `Reminders on (${count} scheduled)` : 'Reminder turned off', 'info');
  };

  const exportData = async () => {
    try {
      const data = await Store.exportAll();
      const file = new File(Paths.cache, `lunapredict-export-${new Date().toISOString().slice(0, 10)}.json`);
      file.create({ overwrite: true });
      file.write(JSON.stringify(data, null, 2));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save your LunaPredict data' });
      } else {
        toast.show('Sharing is not available on this device', 'error');
      }
    } catch (e) {
      toast.show('Export failed', 'error');
    }
  };

  const confirmDelete = async () => {
    setDeleteOpen(false);
    await resetApp({ deleteModels });
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: t.background }]}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}>
        <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>Profile</Text>

        <Card style={{ alignItems: 'center', paddingVertical: space.xl }}>
          <View style={[styles.avatar, { backgroundColor: t.tint }]}>
            <Text style={{ fontSize: 30, fontWeight: '800', color: t.primaryStrong }}>{(user.name || '?').slice(0, 1).toUpperCase()}</Text>
          </View>
          <Text style={{ ...type.title, color: t.text, marginTop: space.md }}>{user.name}</Text>
          <Text style={{ color: t.textMuted, marginTop: 4 }}>
            {isPartner ? 'Partner mode' : `${logs.length} day${logs.length === 1 ? '' : 's'} logged`} · since {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </Text>
          <View style={{ marginTop: space.md }}>
            <Badge label="All data stays on this phone" color={t.success} bg={t.successTint} icon={Lock} />
          </View>
        </Card>

        {!isPartner && (
          <>
            <SectionLabel style={{ marginTop: space.sm }}>Your goal</SectionLabel>
            <View accessibilityRole="radiogroup" style={{ gap: space.sm, marginBottom: space.lg }}>
              {GOALS.map(g => {
                const on = g.id === currentMode;
                return (
                  <Pressable
                    key={g.id}
                    testID={`goal-${g.id}`}
                    onPress={() => chooseGoal(g.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${g.label}. ${g.desc}`}
                    style={({ pressed }) => [styles.goal, { backgroundColor: t.card, borderColor: on ? t.primaryStrong : t.border, opacity: pressed ? 0.85 : 1 }]}
                  >
                    <View style={[styles.goalIcon, { backgroundColor: on ? t.tint : t.surface }]}><g.icon color={on ? t.primaryStrong : t.textMuted} size={22} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...type.heading, color: on ? t.primaryStrong : t.text }}>{g.label}</Text>
                      <Text style={{ fontSize: 13, color: t.textMuted, marginTop: 2 }}>{g.desc}</Text>
                    </View>
                    {on && <Check color={t.primaryStrong} size={22} />}
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        <SectionLabel>Luna (AI coach)</SectionLabel>
        <Card>
          <SettingsRow first icon={Brain} label="AI models" testID="profile-models"
            value={engineKind === 'demo' ? 'Demo mode' : activeModel ? activeModel.name : 'None downloaded'}
            onPress={() => navigation.navigate('Models')} />
          <View style={[styles.inlineRow, { borderTopColor: t.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm }}>
              <Languages color={t.textMuted} size={20} />
              <Text style={{ ...type.label, color: t.text, fontSize: 16 }}>Luna replies in</Text>
            </View>
            <Segmented value={language} onChange={v => updateUser({ language: v as CoachLanguage })}
              options={[{ value: 'en', label: 'English' }, { value: 'sw', label: 'Kiswahili' }]} />
            {language === 'sw' && <Text style={[styles.hint, { color: t.subtext }]}>Kiswahili uses the on-device TranslatePsy model (download on AI models). Translation is machine-made — tap "Show English" on any answer.</Text>}
          </View>
          <SettingsRow icon={Volume2} label="Read answers aloud after voice questions"
            toggle={{ value: user.voiceOutput === 'system', onChange: v => updateUser({ voiceOutput: v ? 'system' : 'off' }) }} />
        </Card>

        {!isPartner && (
          <>
            <SectionLabel style={{ marginTop: space.sm }}>Partner</SectionLabel>
            <Card>
              <SettingsRow first icon={HeartHandshake} label="Partner sharing"
                value={partnerLink?.linked ? `Linked with ${partnerLink.partnerName ?? 'partner'}` : 'Not linked'}
                onPress={() => navigation.navigate('Partner')} />
            </Card>
          </>
        )}

        <SectionLabel style={{ marginTop: space.sm }}>Reminders</SectionLabel>
        <Card>
          {!isPartner && (
            <SettingsRow first icon={Bell} label="Period is coming" toggle={{ value: user.notifications.periodReminders, onChange: v => setNotif('periodReminders', v) }} />
          )}
          <SettingsRow first={isPartner} icon={CalendarClock} label="Daily check-in" toggle={{ value: user.notifications.dailyCheckIn, onChange: v => setNotif('dailyCheckIn', v) }} />
          {user.notifications.dailyCheckIn && (
            <View style={[styles.inlineRow, { borderTopColor: t.border }]}>
              <Segmented
                value={user.notifications.checkInTime ?? '20:00'}
                onChange={async v => {
                  const notifications = { ...user.notifications, checkInTime: v };
                  await updateUser({ notifications });
                  await Reminders.reschedule({ ...user, notifications }, cycle).catch(() => 0);
                  toast.show(`Check-in reminder at ${v}`, 'info');
                }}
                options={CHECKIN_TIMES}
              />
            </View>
          )}
        </Card>

        <SectionLabel style={{ marginTop: space.sm }}>Privacy & data</SectionLabel>
        <Card>
          <SettingsRow first icon={Download} label="Export my data" value="JSON file" onPress={exportData} />
          <SettingsRow icon={Trash2} label="Delete all data" danger onPress={() => setDeleteOpen(true)} testID="profile-delete" />
        </Card>

        <SectionLabel style={{ marginTop: space.sm }}>More</SectionLabel>
        <Card>
          <SettingsRow first icon={FlaskConical} label="Labs: experimental features"
            toggle={{ value: !!user.labs, onChange: v => updateUser({ labs: v }) }} />
          {user.labs && !isPartner && (
            <SettingsRow icon={Wallet} label="WDK wallet (simulated)" onPress={() => navigation.navigate('Wallet')} />
          )}
          <SettingsRow icon={Info} label="About LunaPredict" onPress={() => Alert.alert(
            'LunaPredict',
            'Private cycle, fertility, pregnancy and perimenopause tracking. Predictions are computed on this phone; Luna runs QVAC MedPsy on-device.\n\nLunaPredict gives estimates for awareness. It is not a contraceptive and not a medical device. In an emergency call 999 or 112.',
          )} />
        </Card>
      </ScrollView>

      <ModeSetupSheet target={setupTarget} onClose={() => setSetupTarget(null)} onDone={m => toast.show(m)} />

      <Sheet visible={deleteOpen} title="Delete all data?" subtitle="This removes your profile, logs, chats, partner link and reminders from this phone. It can't be undone." onClose={() => setDeleteOpen(false)}>
        <View style={{ gap: space.lg, paddingBottom: space.lg }}>
          <Pressable
            onPress={() => setDeleteModels(v => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: deleteModels }}
            style={[styles.checkRow, { borderColor: t.border }]}
          >
            <Switch value={deleteModels} onValueChange={setDeleteModels} trackColor={{ true: t.danger, false: t.border }} thumbColor="#FFFFFF" />
            <Text style={{ flex: 1, color: t.text, fontSize: 15 }}>Also delete downloaded AI models (frees storage; you'd need to download them again)</Text>
          </Pressable>
          <Button testID="confirm-delete" label="Delete everything" variant="danger" icon={Trash2} onPress={confirmDelete} />
          <Button label="Cancel" variant="ghost" onPress={() => setDeleteOpen(false)} />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { ...type.title, marginBottom: space.lg },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  goal: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 2, minHeight: 72 },
  goalIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  inlineRow: { paddingVertical: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  hint: { fontSize: 13, lineHeight: 18, marginTop: space.sm },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: radius.md, padding: space.md },
});
