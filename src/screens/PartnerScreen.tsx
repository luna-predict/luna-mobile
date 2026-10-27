import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { Copy, RefreshCw, Link2, Unlink, Moon, CalendarDays, Smile, ListChecks, Baby, Sparkles } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { PearsPartnerService, buildSnapshot } from '../services/PearsPartnerService';
import { SharingPreferences } from '../types';
import { Card, SectionLabel, Button, Badge, Banner, ScreenHeader, SettingsRow, useToast, space, type, radius, IconType } from '../ui';

/**
 * Women-side partner management: create a pairing code, choose exactly what the partner sees
 * (preview rendered from the same function that builds the snapshot), unlink any time.
 */
export default function PartnerScreen() {
  const navigation = useNavigation();
  const toast = useToast();
  const { themeColors: t, user, updateUser, partnerLink, refreshPartnerLink, cycle, pregnancy, logs, today } = useApp();
  const [generating, setGenerating] = useState(false);
  const [confirmName, setConfirmName] = useState('');

  useEffect(() => { refreshPartnerLink(); }, [refreshPartnerLink]);

  const link = partnerLink;
  const sharing: SharingPreferences = user?.sharing ?? { sharePhase: true, sharePredictions: true, shareMood: true, shareSymptoms: false };
  const preview = useMemo(() => (user ? buildSnapshot(user, cycle, pregnancy, logs, today) : null), [user, cycle, pregnancy, logs, today]);

  const generate = async () => {
    setGenerating(true);
    try {
      await PearsPartnerService.generateInvite();
      await refreshPartnerLink();
    } finally {
      setGenerating(false);
    }
  };

  const copyCode = async () => {
    if (!link?.inviteCode) return;
    await Clipboard.setStringAsync(link.inviteCode);
    toast.show('Code copied — send it to your partner');
  };

  const confirmJoined = async () => {
    if (!confirmName.trim()) return;
    await PearsPartnerService.confirmPartnerJoined(confirmName.trim());
    await refreshPartnerLink();
    setConfirmName('');
    toast.show('Partner linked');
  };

  const unlink = () => {
    Alert.alert('Unlink partner?', `${link?.partnerName ?? 'Your partner'} will lose access to everything you share.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unlink', style: 'destructive', onPress: async () => { await PearsPartnerService.unlink(); await refreshPartnerLink(); toast.show('Partner unlinked', 'info'); } },
    ]);
  };

  const OPTIONS: { key: keyof SharingPreferences; icon: IconType; label: string }[] = [
    { key: 'sharePhase', icon: Moon, label: 'Cycle phase and day' },
    { key: 'sharePredictions', icon: CalendarDays, label: 'Next period and fertile window' },
    { key: 'shareMood', icon: Smile, label: 'Mood and energy (last 2 days)' },
    { key: 'shareSymptoms', icon: ListChecks, label: 'Symptom names (never notes)' },
    { key: 'sharePregnancy', icon: Baby, label: 'Pregnancy week' },
  ];

  const previewLines = preview ? [
    preview.phase ? `Phase: ${preview.phaseLabel}, day ${preview.cycleDay}` : null,
    preview.daysUntilPeriod != null ? `Next period in ${preview.daysUntilPeriod} days${preview.inFertileWindow ? ' · fertile window now' : ''}` : null,
    preview.pregnancyWeek != null ? `Pregnancy week ${preview.pregnancyWeek}` : null,
    preview.recentMood ? `Mood: ${preview.recentMood}${preview.recentEnergy ? `, energy ${preview.recentEnergy}` : ''}` : null,
    preview.recentSymptoms?.length ? `Symptoms: ${preview.recentSymptoms.map(s => s.replace(/_/g, ' ')).join(', ')}` : null,
  ].filter(Boolean) as string[] : [];

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: t.background }]}>
      <ScreenHeader title="Partner" accent="sharing" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}>
        <Banner
          severity="info"
          title="Preview: pairing is simulated"
          body="Codes and sharing controls work, but phone-to-phone sync isn't live yet — a partner's phone shows demo data until it is."
        />

        {!link?.linked && (
          <Card>
            <Text style={{ ...type.heading, color: t.text }}>Invite your partner</Text>
            <Text style={{ color: t.textMuted, marginTop: space.xs, lineHeight: 20 }}>
              Create a one-time code. Your partner enters it in their LunaPredict app (choose "I'm a partner").
            </Text>
            {link?.inviteCode ? (
              <View style={{ marginTop: space.lg, gap: space.md }}>
                <Badge label="Waiting for your partner" color={t.warning} bg={t.warningTint} />
                <Text selectable accessibilityLabel={`Pairing code ${link.inviteCode.split('').join(' ')}`} style={[styles.code, { color: t.primaryStrong, backgroundColor: t.tint }]}>{link.inviteCode}</Text>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Button label="Copy code" icon={Copy} variant="outline" compact onPress={copyCode} style={{ flex: 1 }} />
                  <Button label="New code" icon={RefreshCw} variant="ghost" compact onPress={generate} style={{ flex: 1 }} />
                </View>
                <Text style={{ ...type.label, color: t.text, marginTop: space.sm }}>Partner entered the code? Finish linking:</Text>
                <TextInput
                  style={[styles.input, { borderColor: t.border, color: t.text, backgroundColor: t.surface }]}
                  placeholder="Partner's name"
                  placeholderTextColor={t.subtext}
                  value={confirmName}
                  onChangeText={setConfirmName}
                  accessibilityLabel="Partner's name"
                />
                <Button label="Confirm link" icon={Link2} onPress={confirmJoined} disabled={!confirmName.trim()} />
              </View>
            ) : (
              <Button label="Create pairing code" icon={Sparkles} onPress={generate} loading={generating} style={{ marginTop: space.lg }} />
            )}
          </Card>
        )}

        {link?.linked && (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={[styles.avatar, { backgroundColor: t.tint }]}><Text style={{ fontSize: 20, fontWeight: '800', color: t.primaryStrong }}>{(link.partnerName ?? 'P').slice(0, 1)}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...type.heading, color: t.text }}>{link.partnerName ?? 'Your partner'}</Text>
              <Text style={{ fontSize: 13, color: t.textMuted }}>Linked {link.linkedAt ? new Date(link.linkedAt).toLocaleDateString() : ''}</Text>
            </View>
            <Badge label="Linked" color={t.success} bg={t.successTint} />
          </Card>
        )}

        <SectionLabel style={{ marginTop: space.sm }}>What your partner can see</SectionLabel>
        <Card>
          {OPTIONS.map((o, i) => (
            <SettingsRow
              key={o.key}
              first={i === 0}
              icon={o.icon}
              label={o.label}
              toggle={{
                value: o.key === 'sharePregnancy' ? sharing.sharePregnancy !== false : !!sharing[o.key],
                onChange: v => updateUser({ sharing: { ...sharing, [o.key]: v } }),
              }}
            />
          ))}
        </Card>

        <SectionLabel style={{ marginTop: space.sm }}>Exactly what is shared right now</SectionLabel>
        <Card style={{ backgroundColor: t.surface }}>
          {previewLines.length
            ? previewLines.map(l => <Text key={l} style={{ color: t.text, lineHeight: 24 }}>{l}</Text>)
            : <Text style={{ color: t.textMuted }}>Nothing — every option is off or there's nothing to share yet.</Text>}
          <Text style={{ fontSize: 12, color: t.subtext, marginTop: space.sm }}>Notes, temperatures, test results and chats are never shared.</Text>
        </Card>

        {link?.linked && <Button label="Unlink partner" icon={Unlink} variant="danger" onPress={unlink} style={{ marginTop: space.md }} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  code: { fontSize: 26, fontWeight: '800', letterSpacing: 3, textAlign: 'center', paddingVertical: space.lg, borderRadius: radius.md },
  input: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: space.lg, minHeight: 52, fontSize: 16 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
