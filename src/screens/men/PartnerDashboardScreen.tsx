import React, { useState, useCallback } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { PearsPartnerService, isValidInviteCode } from '../../services/PearsPartnerService';
import { partnerTip } from '../../services/CycleEngine';
import { SharedSnapshot } from '../../types';
import { Card, SectionLabel, PrimaryButton, Badge } from '../../ui';

const PHASE_VISUALS: Record<string, { emoji: string; color: string; label: string }> = {
  menstrual: { emoji: '🌸', color: '#F43F5E', label: 'On her period' },
  follicular: { emoji: '🌱', color: '#14B8A6', label: 'Energy rising' },
  ovulatory: { emoji: '✨', color: '#F59E0B', label: 'Peak energy' },
  luteal: { emoji: '🌙', color: '#8B5CF6', label: 'Winding down' },
};

/**
 * Men-side home: read-only view of what the partner shares, plus phase-aware
 * support guidance. No editing of her data is possible from this side.
 */
export default function PartnerDashboardScreen() {
  const { themeColors, user, partnerLink, refreshPartnerLink } = useApp();
  const [snapshot, setSnapshot] = useState<SharedSnapshot | null>(null);
  const [code, setCode] = useState('');
  const [linking, setLinking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadSnapshot = useCallback(async () => {
    const snap = await PearsPartnerService.fetchSnapshot();
    setSnapshot(snap);
  }, []);

  useFocusEffect(useCallback(() => { loadSnapshot(); }, [loadSnapshot]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSnapshot();
    setRefreshing(false);
  };

  const linkNow = async () => {
    if (!isValidInviteCode(code)) {
      Alert.alert('Invalid code', 'The pairing code should look like xxxx-xxxx-xxxx. Ask your partner to generate one from Profile → Partner.');
      return;
    }
    setLinking(true);
    try {
      await PearsPartnerService.linkWithCode(code);
      await refreshPartnerLink();
      await loadSnapshot();
      setCode('');
    } catch (e: unknown) {
      Alert.alert('Pairing failed', e instanceof Error ? e.message : 'Could not reach the swarm.');
    } finally {
      setLinking(false);
    }
  };

  const linked = partnerLink?.linked;
  const phase = snapshot?.phase;
  const visual = phase ? PHASE_VISUALS[phase] : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={[styles.header, { backgroundColor: themeColors.card }]}>
        <Text style={styles.headerTitle}>
          Luna<Text style={{ color: themeColors.primary }}>Partner</Text>
        </Text>
        {linked && <Badge label="P2P SYNCED" color="#059669" bg="#ecfdf5" />}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.primary} />}
      >
        {!linked ? (
          /* ── Not linked yet ── */
          <>
            <Card style={{ alignItems: 'center', padding: 28 }}>
              <Text style={{ fontSize: 44 }}>🔗</Text>
              <Text style={styles.introTitle}>Link with your partner</Text>
              <Text style={styles.introDesc}>
                Ask her to generate a pairing code in LunaPredict (Profile → Partner). Your phones
                connect directly over encrypted Pears P2P — you'll see exactly what she chooses to share.
              </Text>
            </Card>
            <Card style={{ padding: 18 }}>
              <Text style={styles.fieldLabel}>Enter pairing code</Text>
              <TextInput
                style={styles.codeInput}
                placeholder="xxxx-xxxx-xxxx"
                placeholderTextColor="#94a3b8"
                value={code}
                onChangeText={setCode}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <PrimaryButton label={linking ? 'Pairing…' : 'Pair devices'} onPress={linkNow} loading={linking} disabled={!code.trim()} style={{ marginTop: 12 }} />
            </Card>
          </>
        ) : (
          /* ── Linked: her status ── */
          <>
            <Card style={{ padding: 24, alignItems: 'center' }}>
              <Text style={styles.sharerName}>{snapshot?.sharerName ?? partnerLink?.partnerName ?? 'Your partner'}</Text>
              {visual ? (
                <>
                  <View style={[styles.phaseCircle, { backgroundColor: visual.color + '15', borderColor: visual.color + '40' }]}>
                    <Text style={{ fontSize: 42 }}>{visual.emoji}</Text>
                  </View>
                  <Text style={[styles.phaseLabel, { color: visual.color }]}>{visual.label}</Text>
                  {snapshot?.cycleDay != null && (
                    <Text style={styles.phaseSub}>Cycle day {snapshot.cycleDay} · {snapshot.phaseLabel} phase</Text>
                  )}
                </>
              ) : (
                <>
                  <View style={[styles.phaseCircle, { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }]}>
                    <Text style={{ fontSize: 42 }}>🔒</Text>
                  </View>
                  <Text style={styles.phaseSub}>Phase not shared — she controls visibility from her app</Text>
                </>
              )}
              {snapshot?.pregnancyWeek != null && (
                <Badge label={`PREGNANCY · WEEK ${snapshot.pregnancyWeek}`} color="#7E22CE" bg="#FAF5FF" />
              )}
            </Card>

            {/* Key numbers */}
            {(snapshot?.daysUntilPeriod != null || snapshot?.inFertileWindow != null) && (
              <View style={styles.statsRow}>
                {snapshot?.daysUntilPeriod != null && (
                  <Card style={[styles.statCard, { marginBottom: 0 }]}>
                    <Text style={[styles.statValue, { color: '#F43F5E' }]}>{snapshot.daysUntilPeriod}d</Text>
                    <Text style={styles.statLabel}>To next period</Text>
                  </Card>
                )}
                {snapshot?.inFertileWindow != null && (
                  <Card style={[styles.statCard, { marginBottom: 0 }]}>
                    <Text style={[styles.statValue, { color: '#F59E0B' }]}>{snapshot.inFertileWindow ? 'Now' : 'Not yet'}</Text>
                    <Text style={styles.statLabel}>Fertile window</Text>
                  </Card>
                )}
              </View>
            )}

            {/* Mood / symptoms if shared */}
            {(snapshot?.recentMood || (snapshot?.recentSymptoms?.length ?? 0) > 0) && (
              <>
                <SectionLabel style={{ marginTop: 16 }}>How she's doing</SectionLabel>
                <Card>
                  {snapshot?.recentMood && (
                    <Text style={styles.moodLine}>🎭 Mood: <Text style={styles.moodValue}>{snapshot.recentMood}</Text>
                      {snapshot.recentEnergy ? <Text style={styles.moodLine}>  ·  ⚡ Energy: <Text style={styles.moodValue}>{snapshot.recentEnergy}</Text></Text> : null}
                    </Text>
                  )}
                  {(snapshot?.recentSymptoms?.length ?? 0) > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                      {snapshot!.recentSymptoms!.map(s => (
                        <View key={s} style={styles.symptomChip}>
                          <Text style={styles.symptomChipText}>{s.replace(/_/g, ' ')}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </Card>
              </>
            )}

            {/* Support tip */}
            <SectionLabel style={{ marginTop: 16 }}>How to support her today</SectionLabel>
            <Card style={{ borderLeftWidth: 4, borderLeftColor: themeColors.primary }}>
              <Text style={styles.tipText}>{partnerTip(phase)}</Text>
            </Card>

            <Text style={styles.syncNote}>
              {partnerLink?.lastSyncAt
                ? `Last synced ${new Date(partnerLink.lastSyncAt).toLocaleTimeString()} over Pears P2P · pull to refresh`
                : 'Pull to refresh'}
            </Text>
          </>
        )}

        {/* What men get for themselves */}
        <SectionLabel style={{ marginTop: 16 }}>For you, {user?.name}</SectionLabel>
        <Card>
          <Text style={styles.forYouTitle}>🧘 Your own wellness matters too</Text>
          <Text style={styles.forYouDesc}>
            Log your mood, energy and stress in the Check-In tab. Luna correlates how you're doing with
            what's happening in her cycle — better context, better support, fewer misunderstandings.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1e293b', letterSpacing: -0.5 },
  introTitle: { fontSize: 19, fontWeight: '800', color: '#1e293b', marginTop: 12, marginBottom: 8 },
  introDesc: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 10 },
  codeInput: {
    backgroundColor: '#f8fafc', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 17, color: '#334155', borderWidth: 1, borderColor: '#e2e8f0',
    textAlign: 'center', letterSpacing: 2,
  },
  sharerName: { fontSize: 15, fontWeight: '700', color: '#64748b', marginBottom: 14 },
  phaseCircle: {
    width: 110, height: 110, borderRadius: 55, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, marginBottom: 12,
  },
  phaseLabel: { fontSize: 20, fontWeight: '800' },
  phaseSub: { fontSize: 13, color: '#94a3b8', marginTop: 4, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 18 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 },
  moodLine: { fontSize: 14, color: '#475569' },
  moodValue: { fontWeight: '800', color: '#1e293b', textTransform: 'capitalize' },
  symptomChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, backgroundColor: '#f1f5f9' },
  symptomChipText: { fontSize: 12, color: '#64748b', fontWeight: '600', textTransform: 'capitalize' },
  tipText: { fontSize: 14, color: '#475569', lineHeight: 21 },
  syncNote: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 12 },
  forYouTitle: { fontSize: 14, fontWeight: '800', color: '#1e293b', marginBottom: 6 },
  forYouDesc: { fontSize: 13, color: '#64748b', lineHeight: 19 },
});
