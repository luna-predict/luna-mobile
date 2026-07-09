import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { useApp } from '../context/AppContext';
import { AppMode } from '../types';
import { Store } from '../storage/Store';
import { WdkService } from '../services/WdkService';
import { ModelManager, MODEL_CATALOG } from '../services/ModelManager';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Card, SectionLabel, SettingsRow, Badge } from '../ui';

const modes: { id: AppMode; label: string; emoji: string; desc: string; color: string }[] = [
  { id: 'period', label: 'Track My Cycle', emoji: '🩸', desc: 'Predict periods & symptoms', color: '#F43F5E' },
  { id: 'conceive', label: 'Get Pregnant', emoji: '👶', desc: 'Identify fertile days', color: '#14B8A6' },
  { id: 'pregnancy', label: 'Follow Pregnancy', emoji: '🤰', desc: 'Track baby growth', color: '#A855F7' },
  { id: 'perimenopause', label: 'Navigate Changes', emoji: '🌿', desc: 'Manage transition', color: '#8B5CF6' },
];

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { currentMode, setMode, themeColors, user, updateUser, partnerLink, resetApp, logs } = useApp();
  const isMale = user?.sex === 'male';

  const [walletSummary, setWalletSummary] = useState<string>('Not set up');
  const [modelSummary, setModelSummary] = useState<string>('None downloaded');

  useEffect(() => {
    const refresh = () => {
      const w = WdkService.getState();
      setWalletSummary(w?.initialized ? `${w.balanceUsdt.toFixed(2)} USDt · ${w.network}` : 'Not set up');
      ModelManager.init().then(entries => {
        const downloaded = entries.filter(e => e.state.status === 'downloaded').length;
        const active = ModelManager.getActiveModel();
        setModelSummary(active ? active.name : downloaded > 0 ? `${downloaded} downloaded` : 'None downloaded');
      });
    };
    refresh();
    const unsubNav = navigation.addListener('focus', refresh);
    const unsubWdk = WdkService.subscribe(refresh);
    return () => { unsubNav(); unsubWdk(); };
  }, [navigation]);

  const toggleNotif = (key: keyof NonNullable<typeof user>['notifications']) => {
    if (!user) return;
    updateUser({ notifications: { ...user.notifications, [key]: !user.notifications[key] } });
  };

  const exportData = async () => {
    const [allLogs, checkIns] = await Promise.all([Store.getLogs(), Store.getMenCheckIns()]);
    const payload = JSON.stringify({
      exportedAt: new Date().toISOString(),
      user: { ...user, },
      logs: allLogs,
      menCheckIns: checkIns,
    }, null, 2);
    await Clipboard.setStringAsync(payload);
    Alert.alert('Exported 📋', `${allLogs.length + checkIns.length} entries copied to clipboard as JSON. Paste into any file to back up.`);
  };

  const confirmReset = () => {
    Alert.alert(
      'Delete all data?',
      'This wipes your profile, logs, wallet, models and partner link from this device. There is no cloud copy — this cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete everything', style: 'destructive', onPress: resetApp },
      ],
    );
  };

  const about = () => {
    Alert.alert(
      'LunaPredict',
      'Local-first women\'s health intelligence.\n\n• AI: QVAC MedPsy models, fully on-device\n• P2P: Pears (Holepunch) — Hyperswarm + Noise encryption\n• Payments: Tether WDK pay-per-token compute\n\nNo servers. No accounts. Your body, your data.',
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={[styles.header, { backgroundColor: themeColors.card }]}>
        <Text style={styles.headerTitle}>My <Text style={{ color: themeColors.primary }}>Profile</Text></Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* User card */}
        <Card style={{ alignItems: 'center', padding: 24 }}>
          <View style={[styles.avatar, { backgroundColor: themeColors.primary + '15' }]}>
            <Text style={{ fontSize: 36 }}>{isMale ? '🤝' : '🌙'}</Text>
          </View>
          <Text style={styles.userName}>{user?.name ?? 'Anonymous'}</Text>
          <Text style={styles.userMeta}>
            {isMale ? 'Partner mode' : 'Tracking since'} {user ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}
            {!isMale && logs.length > 0 ? ` · ${logs.length} logs` : ''}
          </Text>
          <View style={styles.privacyBadge}>
            <Text style={{ fontSize: 12, color: '#059669', fontWeight: '700' }}>🔒 All data on this device</Text>
          </View>
        </Card>

        {/* Goal switcher — women only */}
        {!isMale && (
          <>
            <SectionLabel>Current Goal</SectionLabel>
            <View style={{ gap: 10, marginBottom: 16 }}>
              {modes.map((mode) => {
                const isSelected = currentMode === mode.id;
                return (
                  <TouchableOpacity
                    key={mode.id}
                    onPress={() => setMode(mode.id)}
                    style={[styles.modeRow, isSelected && { borderColor: mode.color, backgroundColor: mode.color + '08' }]}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.modeIcon, { backgroundColor: mode.color + '20' }]}>
                      <Text style={{ fontSize: 24 }}>{mode.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modeLabel, isSelected && { color: mode.color }]}>{mode.label}</Text>
                      <Text style={styles.modeDesc}>{mode.desc}</Text>
                    </View>
                    {isSelected && (
                      <View style={[styles.radioOuter, { borderColor: mode.color }]}>
                        <View style={[styles.radioInner, { backgroundColor: mode.color }]} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Partner — women manage sharing here */}
        {!isMale && (
          <>
            <SectionLabel>Partner</SectionLabel>
            <Card>
              <TouchableOpacity style={styles.partnerRow} onPress={() => navigation.navigate('Partner')}>
                <Text style={{ fontSize: 24 }}>💙</Text>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.settingsText}>Partner sharing</Text>
                  <Text style={styles.settingsSub}>
                    {partnerLink?.linked
                      ? `Linked with ${partnerLink.partnerName ?? 'partner'} · P2P encrypted`
                      : partnerLink?.inviteCode
                        ? 'Invite pending — waiting for partner'
                        : 'Let your partner see what you choose'}
                  </Text>
                </View>
                {partnerLink?.linked
                  ? <Badge label="LINKED" color="#059669" bg="#ecfdf5" />
                  : <Text style={styles.settingsArrow}>›</Text>}
              </TouchableOpacity>
            </Card>
          </>
        )}

        {/* AI & Compute */}
        <SectionLabel>AI & Compute</SectionLabel>
        <Card>
          <SettingsRow first emoji="🧠" label="AI Models" value={modelSummary} onPress={() => navigation.navigate('Models')} />
          <SettingsRow emoji="👛" label="WDK Wallet" value={walletSummary} onPress={() => navigation.navigate('Wallet')} />
          <SettingsRow
            emoji="💻"
            label="Pair Desktop (Tier 2)"
            onPress={() => Alert.alert(
              'Pair your desktop',
              'Run the Luna Node desktop app on your computer and scan its QR code to pair over Holepunch P2P. Your phone can then delegate MedPsy-4B inference to it — private and free.',
            )}
          />
        </Card>

        {/* Notifications */}
        <SectionLabel style={{ marginTop: 12 }}>Notifications</SectionLabel>
        <Card>
          {([
            ['periodReminders', '🔔 Period reminders'],
            ['dailyCheckIn', '📝 Daily check-in nudge'],
            ['insights', '💡 Insights'],
          ] as const).map(([key, label], i) => (
            <TouchableOpacity key={key} onPress={() => toggleNotif(key)} style={[styles.notifRow, i > 0 && styles.rowBorder]}>
              <Text style={styles.settingsText}>{label}</Text>
              <View style={[styles.toggle, user?.notifications[key] && { backgroundColor: themeColors.primary }]}>
                <View style={[styles.toggleDot, user?.notifications[key] && styles.toggleDotOn]} />
              </View>
            </TouchableOpacity>
          ))}
        </Card>

        {/* Data */}
        <SectionLabel style={{ marginTop: 12 }}>Data</SectionLabel>
        <Card>
          <SettingsRow first emoji="📤" label="Export my data (JSON)" onPress={exportData} />
          <SettingsRow emoji="ℹ️" label="About LunaPredict" onPress={about} />
          <SettingsRow emoji="🗑" label="Delete all data" onPress={confirmReset} danger />
        </Card>

        {/* Powered by */}
        <View style={styles.poweredBy}>
          <Text style={styles.poweredByText}>Powered by</Text>
          <Text style={[styles.poweredByBrand, { color: themeColors.primary }]}>QVAC Edge AI</Text>
          <Text style={styles.poweredByText}>· Pears P2P · WDK</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  userName: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  userMeta: { fontSize: 12, color: '#94a3b8', marginTop: 4, marginBottom: 10 },
  privacyBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, backgroundColor: '#ecfdf5' },
  modeRow: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20,
    borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#fff',
  },
  modeIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  modeLabel: { fontSize: 16, fontWeight: '700', color: '#334155' },
  modeDesc: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  partnerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  settingsText: { fontSize: 15, fontWeight: '600', color: '#334155' },
  settingsSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  settingsArrow: { fontSize: 20, color: '#94a3b8' },
  notifRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: '#e2e8f0', padding: 3, justifyContent: 'center' },
  toggleDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  toggleDotOn: { alignSelf: 'flex-end' },
  poweredBy: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: 24, paddingBottom: 16 },
  poweredByText: { fontSize: 12, color: '#94a3b8' },
  poweredByBrand: { fontSize: 12, fontWeight: '700' },
});
