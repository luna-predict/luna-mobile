import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { useApp } from '../context/AppContext';
import { PearsPartnerService } from '../services/PearsPartnerService';
import { SharingPreferences } from '../types';
import { Card, SectionLabel, PrimaryButton, Badge } from '../ui';

/**
 * Women-side partner management: mint a Pears pairing code, control exactly
 * what the linked partner can see, and revoke access at any time.
 */
export default function PartnerScreen() {
  const navigation = useNavigation();
  const { themeColors, user, updateUser, partnerLink, refreshPartnerLink, cycle } = useApp();
  const [generating, setGenerating] = useState(false);
  const [confirmName, setConfirmName] = useState('');

  useEffect(() => { refreshPartnerLink(); }, []);

  const link = partnerLink;
  const sharing = user?.sharing ?? { sharePhase: true, sharePredictions: true, shareMood: true, shareSymptoms: false };

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
    if (link?.inviteCode) {
      await Clipboard.setStringAsync(link.inviteCode);
      Alert.alert('Copied', 'Send this code to your partner. It pairs your devices directly — no server involved.');
    }
  };

  const confirmJoined = async () => {
    if (!confirmName.trim()) return;
    await PearsPartnerService.confirmPartnerJoined(confirmName.trim());
    await refreshPartnerLink();
    setConfirmName('');
  };

  const unlink = () => {
    Alert.alert(
      'Unlink partner?',
      `${link?.partnerName ?? 'Your partner'} will immediately lose access to everything you've shared. The pairing keys are destroyed on both sides.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink', style: 'destructive',
          onPress: async () => { await PearsPartnerService.unlink(); await refreshPartnerLink(); },
        },
      ],
    );
  };

  const toggleShare = (key: keyof SharingPreferences) => {
    updateUser({ sharing: { ...sharing, [key]: !sharing[key] } });
  };

  const SHARE_OPTIONS: { key: keyof SharingPreferences; emoji: string; label: string; desc: string }[] = [
    { key: 'sharePhase', emoji: '🌙', label: 'Cycle phase', desc: 'Current phase and cycle day' },
    { key: 'sharePredictions', emoji: '📅', label: 'Predictions', desc: 'Next period and fertile window dates' },
    { key: 'shareMood', emoji: '🎭', label: 'Mood & energy', desc: 'From your daily logs' },
    { key: 'shareSymptoms', emoji: '📋', label: 'Symptoms', desc: 'Symptom names only — never your notes' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={[styles.header, { backgroundColor: themeColors.card }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ fontSize: 22, color: '#64748b' }}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Partner <Text style={{ color: themeColors.primary }}>Sharing</Text></Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {!link?.linked && !link?.inviteCode && (
          /* ── Not linked, no invite yet ── */
          <>
            <Card style={{ alignItems: 'center', padding: 28 }}>
              <Text style={{ fontSize: 44 }}>🤝</Text>
              <Text style={styles.introTitle}>Bring your partner in</Text>
              <Text style={styles.introDesc}>
                Let your partner understand your cycle and support you better. They see only what you
                choose below — synced phone-to-phone over encrypted Pears P2P, no cloud in between.
              </Text>
            </Card>
            <PrimaryButton
              label={generating ? 'Creating pairing invite…' : '✨ Generate pairing code'}
              onPress={generate}
              loading={generating}
            />
          </>
        )}

        {!link?.linked && link?.inviteCode && (
          /* ── Invite pending ── */
          <>
            <Card style={{ alignItems: 'center', padding: 24 }}>
              <Badge label="WAITING FOR PARTNER" color="#b45309" bg="#fef3c7" />
              <Text style={[styles.codeText, { color: themeColors.primary }]}>{link.inviteCode}</Text>
              <Text style={styles.introDesc}>
                Your partner enters this code in their LunaPredict app (Partner mode). The invite is
                announced on the Hyperswarm DHT and pairs your devices directly.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, alignSelf: 'stretch' }}>
                <PrimaryButton label="⧉ Copy code" variant="outline" onPress={copyCode} style={{ flex: 1, paddingVertical: 12 }} />
                <PrimaryButton label="New code" variant="ghost" onPress={generate} style={{ flex: 1, paddingVertical: 12 }} />
              </View>
            </Card>

            <Card style={{ padding: 18 }}>
              <Text style={styles.fieldLabel}>Partner entered the code? Finish pairing:</Text>
              <TextInput
                style={styles.input}
                placeholder="Partner's name"
                placeholderTextColor="#94a3b8"
                value={confirmName}
                onChangeText={setConfirmName}
              />
              <PrimaryButton label="Confirm pairing" onPress={confirmJoined} disabled={!confirmName.trim()} style={{ marginTop: 12 }} />
            </Card>
          </>
        )}

        {link?.linked && (
          /* ── Linked ── */
          <Card style={{ padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.partnerAvatar, { backgroundColor: themeColors.primary + '15' }]}>
                <Text style={{ fontSize: 26 }}>💙</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.partnerName}>{link.partnerName ?? 'Your partner'}</Text>
                <Text style={styles.partnerMeta}>
                  Linked {link.linkedAt ? new Date(link.linkedAt).toLocaleDateString() : ''} · P2P encrypted
                </Text>
                {link.lastSyncAt && (
                  <Text style={styles.partnerMeta}>Last sync {new Date(link.lastSyncAt).toLocaleTimeString()}</Text>
                )}
              </View>
              <Badge label="CONNECTED" color="#059669" bg="#ecfdf5" />
            </View>
          </Card>
        )}

        {(link?.linked || link?.inviteCode) && (
          <>
            <SectionLabel style={{ marginTop: 12 }}>What your partner can see</SectionLabel>
            <Card>
              {SHARE_OPTIONS.map((opt, i) => (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => toggleShare(opt.key)}
                  style={[styles.shareRow, i > 0 && styles.rowBorder]}
                >
                  <Text style={{ fontSize: 22 }}>{opt.emoji}</Text>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.shareLabel}>{opt.label}</Text>
                    <Text style={styles.shareDesc}>{opt.desc}</Text>
                  </View>
                  <View style={[styles.toggle, sharing[opt.key] && { backgroundColor: themeColors.primary }]}>
                    <View style={[styles.toggleDot, sharing[opt.key] && styles.toggleDotOn]} />
                  </View>
                </TouchableOpacity>
              ))}
            </Card>

            {/* Preview of the partner's view */}
            <SectionLabel style={{ marginTop: 12 }}>Their view right now</SectionLabel>
            <Card style={{ backgroundColor: '#F6F9FF', borderColor: '#DBEAFE', borderWidth: 1 }}>
              <Text style={styles.previewTitle}>
                {sharing.sharePhase && cycle
                  ? `${user?.name} is on cycle day ${cycle.cycleDay} — ${cycle.phaseLabel} phase`
                  : `${user?.name}'s phase is hidden`}
              </Text>
              <Text style={styles.previewLine}>
                📅 {sharing.sharePredictions && cycle ? `Next period in ${cycle.daysUntilPeriod} days` : 'Predictions hidden'}
              </Text>
              <Text style={styles.previewLine}>
                🎭 {sharing.shareMood ? 'Latest mood & energy visible' : 'Mood hidden'}
              </Text>
              <Text style={styles.previewLine}>
                📋 {sharing.shareSymptoms ? 'Symptom names visible' : 'Symptoms hidden'}
              </Text>
              <Text style={styles.previewNote}>Notes and chat history are never shared.</Text>
            </Card>
          </>
        )}

        {link?.linked && (
          <PrimaryButton label="Unlink partner" variant="danger" onPress={unlink} style={{ marginTop: 8 }} />
        )}

        <Card style={{ marginTop: 16, backgroundColor: '#1e293b' }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff', marginBottom: 4 }}>🔒 How pairing works</Text>
          <Text style={{ fontSize: 12.5, color: '#94a3b8', lineHeight: 19 }}>
            The code creates a Pears BlindPairing invite. Both phones join a private Hyperswarm topic and
            talk directly over a Noise-encrypted channel — your data replicates device-to-device and is
            never stored on any server. Unlinking destroys the shared keys.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  introTitle: { fontSize: 19, fontWeight: '800', color: '#1e293b', marginTop: 12, marginBottom: 8 },
  introDesc: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  codeText: { fontSize: 26, fontWeight: '800', letterSpacing: 2, marginVertical: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 10 },
  input: {
    backgroundColor: '#f8fafc', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#334155', borderWidth: 1, borderColor: '#e2e8f0',
  },
  partnerAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  partnerName: { fontSize: 17, fontWeight: '800', color: '#1e293b' },
  partnerMeta: { fontSize: 11.5, color: '#94a3b8', marginTop: 2 },
  shareRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  rowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  shareLabel: { fontSize: 15, fontWeight: '700', color: '#334155' },
  shareDesc: { fontSize: 12, color: '#94a3b8', marginTop: 1 },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: '#e2e8f0', padding: 3, justifyContent: 'center' },
  toggleDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  toggleDotOn: { alignSelf: 'flex-end' },
  previewTitle: { fontSize: 14, fontWeight: '800', color: '#1e293b', marginBottom: 10 },
  previewLine: { fontSize: 13, color: '#475569', marginBottom: 6 },
  previewNote: { fontSize: 11.5, color: '#94a3b8', marginTop: 6, fontStyle: 'italic' },
});
