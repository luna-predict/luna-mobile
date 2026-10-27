import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, NavigationProp } from '@react-navigation/native';
import { Link2, Droplet, Sparkles, Moon, Lock, Baby, Heart, ClipboardCheck, ChevronRight } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { PearsPartnerService, isValidInviteCode } from '../../services/PearsPartnerService';
import { partnerTip } from '../../domain';
import { CyclePhase, SharedSnapshot } from '../../types';
import { Card, SectionLabel, Button, Badge, Banner, StatTile, EmptyState, useToast, space, type, radius, IconType } from '../../ui';
import { MenTabParamList } from '../../navigation/AppNavigator';

const PHASE: Record<CyclePhase, { icon: IconType; label: string }> = {
  menstrual: { icon: Droplet, label: 'On her period' },
  follicular: { icon: Sparkles, label: 'Energy rising' },
  ovulatory: { icon: Sparkles, label: 'Peak energy' },
  luteal: { icon: Moon, label: 'Winding down' },
};

/** Partner home: read-only view of what she shares + phase-aware support tips. */
export default function PartnerDashboardScreen() {
  const navigation = useNavigation<NavigationProp<MenTabParamList>>();
  const toast = useToast();
  const { themeColors: t, partnerLink, refreshPartnerLink } = useApp();
  const [snapshot, setSnapshot] = useState<SharedSnapshot | null>(null);
  const [code, setCode] = useState('');
  const [linking, setLinking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => setSnapshot(await PearsPartnerService.fetchSnapshot()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const linkNow = async () => {
    if (!isValidInviteCode(code)) {
      toast.show('That code should look like xxxx-xxxx-xxxx', 'error');
      return;
    }
    setLinking(true);
    try {
      await PearsPartnerService.linkWithCode(code);
      await refreshPartnerLink();
      await load();
      setCode('');
      toast.show('Linked');
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Linking failed', 'error');
    } finally {
      setLinking(false);
    }
  };

  const linked = partnerLink?.linked;
  const phase = snapshot?.phase ? PHASE[snapshot.phase] : null;
  const name = snapshot?.sharerName ?? partnerLink?.partnerName ?? 'Your partner';
  const updated = snapshot ? new Date(snapshot.updatedAt) : null;

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: t.background }]}>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primaryStrong} />}
      >
        <View style={styles.header}>
          <Text accessibilityRole="header" style={[styles.brand, { color: t.text }]}>Luna<Text style={{ color: t.primaryStrong }}>Partner</Text></Text>
          {linked && <Badge label={snapshot?.synthetic ? 'Demo data' : 'Linked'} color={snapshot?.synthetic ? t.warning : t.success} bg={snapshot?.synthetic ? t.warningTint : t.successTint} />}
        </View>

        {!linked ? (
          <>
            <Card>
              <EmptyState icon={Link2} title="Link with your partner" body="Ask her to create a pairing code in LunaPredict (Profile → Partner sharing). You'll see only what she chooses to share." />
            </Card>
            <Card>
              <Text style={{ ...type.label, color: t.text, marginBottom: space.sm }}>Pairing code</Text>
              <TextInput
                style={[styles.code, { borderColor: t.border, color: t.text, backgroundColor: t.surface }]}
                placeholder="xxxx-xxxx-xxxx"
                placeholderTextColor={t.subtext}
                value={code}
                onChangeText={setCode}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Pairing code"
              />
              <Button label="Link" onPress={linkNow} loading={linking} disabled={!code.trim()} style={{ marginTop: space.md }} />
            </Card>
          </>
        ) : (
          <>
            {snapshot?.synthetic && (
              <Banner severity="warn" title="Demo data" body="Phone-to-phone sync isn't live yet, so this is sample data — not your partner's real cycle." />
            )}

            <Card style={{ alignItems: 'center', paddingVertical: space.xl }}>
              <Text style={{ ...type.caption, color: t.textMuted }}>{name.toUpperCase()}</Text>
              {phase ? (
                <>
                  <View style={[styles.phaseIcon, { backgroundColor: t.tint }]}><phase.icon color={t.primaryStrong} size={34} /></View>
                  <Text style={{ ...type.title, color: t.text }}>{phase.label}</Text>
                  {snapshot?.cycleDay != null && <Text style={{ color: t.textMuted, marginTop: 4 }}>Cycle day {snapshot.cycleDay} · {snapshot.phaseLabel} phase</Text>}
                </>
              ) : snapshot?.pregnancyWeek != null ? (
                <>
                  <View style={[styles.phaseIcon, { backgroundColor: t.tint }]}><Baby color={t.primaryStrong} size={34} /></View>
                  <Text style={{ ...type.title, color: t.text }}>Pregnancy week {snapshot.pregnancyWeek}</Text>
                </>
              ) : (
                <>
                  <View style={[styles.phaseIcon, { backgroundColor: t.surface }]}><Lock color={t.textMuted} size={30} /></View>
                  <Text style={{ color: t.textMuted, textAlign: 'center' }}>Phase not shared — she controls this from her app.</Text>
                </>
              )}
            </Card>

            {(snapshot?.daysUntilPeriod != null || snapshot?.inFertileWindow != null) && (
              <View style={styles.stats}>
                {snapshot?.daysUntilPeriod != null && <StatTile icon={Droplet} value={`${snapshot.daysUntilPeriod}d`} label="To her next period" />}
                {snapshot?.inFertileWindow != null && <StatTile icon={Sparkles} value={snapshot.inFertileWindow ? 'Now' : 'Not now'} label="Fertile window" color={t.warning} />}
              </View>
            )}

            {(snapshot?.recentMood || (snapshot?.recentSymptoms?.length ?? 0) > 0) && (
              <Card>
                <Text style={{ ...type.label, color: t.text }}>How she's been feeling</Text>
                {snapshot?.recentMood && <Text style={{ color: t.textMuted, marginTop: space.sm }}>Mood: {snapshot.recentMood}{snapshot.recentEnergy ? ` · energy ${snapshot.recentEnergy}` : ''}</Text>}
                {(snapshot?.recentSymptoms?.length ?? 0) > 0 && <Text style={{ color: t.textMuted, marginTop: 4 }}>Symptoms: {snapshot!.recentSymptoms!.map(s => s.replace(/_/g, ' ')).join(', ')}</Text>}
              </Card>
            )}

            <SectionLabel style={{ marginTop: space.sm }}>How to support her today</SectionLabel>
            <Card style={{ flexDirection: 'row', gap: space.md }}>
              <Heart color={t.primaryStrong} size={22} />
              <Text style={{ flex: 1, color: t.text, lineHeight: 22 }}>{partnerTip(snapshot?.phase)}</Text>
            </Card>

            {updated && <Text style={{ fontSize: 12, color: t.subtext, textAlign: 'center' }}>Updated {updated.toLocaleString()}</Text>}
          </>
        )}

        <SectionLabel style={{ marginTop: space.lg }}>You</SectionLabel>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <ClipboardCheck color={t.primaryStrong} size={22} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...type.label, color: t.text }}>Your own wellness matters too</Text>
            <Text style={{ fontSize: 13, color: t.textMuted, marginTop: 2 }}>A 30-second daily check-in, private to your phone.</Text>
          </View>
          <Button label="Check in" compact variant="tonal" icon={ChevronRight} onPress={() => navigation.navigate('Check-In')} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg },
  brand: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  code: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: space.lg, minHeight: 54, fontSize: 20, letterSpacing: 2, textAlign: 'center' },
  phaseIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginVertical: space.md },
  stats: { flexDirection: 'row', gap: space.md, marginBottom: space.md },
});

export { radius };
