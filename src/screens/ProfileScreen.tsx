import React, { useState } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useMode, AppMode } from '../context/ModeContext';

const modes: { id: AppMode; label: string; emoji: string; desc: string; color: string }[] = [
  { id: 'period', label: 'Track My Cycle', emoji: '🩸', desc: 'Predict periods & symptoms', color: '#F43F5E' },
  { id: 'conceive', label: 'Get Pregnant', emoji: '👶', desc: 'Identify fertile days', color: '#14B8A6' },
  { id: 'pregnancy', label: 'Follow Pregnancy', emoji: '🤰', desc: 'Track baby growth', color: '#A855F7' },
  { id: 'perimenopause', label: 'Navigate Changes', emoji: '🌿', desc: 'Manage transition', color: '#8B5CF6' },
];

export default function ProfileScreen() {
  const { currentMode, setMode, themeColors } = useMode();
  const [isMainnet, setIsMainnet] = useState(false);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={[styles.header, { backgroundColor: themeColors.card }]}>
        <Text style={styles.headerTitle}>My <Text style={{ color: themeColors.primary }}>Profile</Text></Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* User Card */}
        <View style={[styles.card, { backgroundColor: themeColors.card }]}>
          <View style={[styles.avatar, { backgroundColor: themeColors.primary + '15' }]}>
            <Text style={{ fontSize: 36 }}>👤</Text>
          </View>
          <Text style={styles.userName}>Anonymous User</Text>
          <View style={styles.privacyBadge}>
            <Text style={{ fontSize: 12, color: '#059669', fontWeight: '700' }}>🔒 Local Data Encrypted</Text>
          </View>
          <Text style={styles.privacyNote}>Your data never leaves this device</Text>
        </View>

        {/* WDK Wallet */}
        <View style={styles.walletCard}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Text style={styles.walletLabel}>Compute Wallet (WDK)</Text>
              <View style={[styles.networkBadge, { backgroundColor: isMainnet ? '#ecfdf5' : '#fef3c7' }]}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: isMainnet ? '#059669' : '#b45309' }}>
                  {isMainnet ? 'MAINNET' : 'TESTNET'}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
              <Text style={styles.walletBalance}>5.00</Text>
              <Text style={styles.walletCurrency}>USDt</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setIsMainnet(!isMainnet)} style={styles.walletIcon}>
            <Text style={{ fontSize: 24 }}>🔁</Text>
          </TouchableOpacity>
        </View>

        {/* Mode Switcher */}
        <Text style={styles.sectionLabel}>Current Goal</Text>
        <View style={{ gap: 10 }}>
          {modes.map((mode) => {
            const isSelected = currentMode === mode.id;
            return (
              <TouchableOpacity
                key={mode.id}
                onPress={() => setMode(mode.id)}
                style={[
                  styles.modeRow,
                  isSelected && { borderColor: mode.color, backgroundColor: mode.color + '08' },
                ]}
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

        {/* Settings */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Settings</Text>
        <View style={[styles.card, { backgroundColor: themeColors.card }]}>
          <TouchableOpacity 
            style={styles.settingsRow}
            onPress={() => Alert.alert('Pair Desktop', 'Scan the QR code on your Luna Node desktop app to pair via Holepunch P2P for Tier 2 local delegation.')}
          >
            <Text style={styles.settingsText}>💻 Pair Desktop (Tier 2 Node)</Text>
            <Text style={styles.settingsArrow}>›</Text>
          </TouchableOpacity>
          {['Notifications', 'Export Data', 'About LunaPredict'].map((item, i) => (
            <TouchableOpacity key={item} style={[styles.settingsRow, styles.settingsBorder]}>
              <Text style={styles.settingsText}>{item}</Text>
              <Text style={styles.settingsArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Powered by QVAC */}
        <View style={styles.poweredBy}>
          <Text style={styles.poweredByText}>Powered by</Text>
          <Text style={[styles.poweredByBrand, { color: themeColors.primary }]}>QVAC Edge AI</Text>
          <Text style={styles.poweredByText}>• WDK Wallet</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  card: {
    borderRadius: 20, padding: 24, marginBottom: 16, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 16,
  },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  userName: { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
  privacyBadge: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, backgroundColor: '#ecfdf5',
  },
  privacyNote: { fontSize: 12, color: '#94a3b8', marginTop: 8 },
  walletCard: {
    backgroundColor: '#1e293b', borderRadius: 20, padding: 20, marginBottom: 24,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16,
  },
  networkBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginLeft: 4 },
  walletLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  walletBalance: { fontSize: 32, fontWeight: '800', color: '#34d399' },
  walletCurrency: { fontSize: 14, fontWeight: '700', color: 'rgba(52,211,153,0.7)', marginBottom: 4 },
  walletIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(52,211,153,0.15)', alignItems: 'center', justifyContent: 'center' },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: 12, marginLeft: 4,
  },
  modeRow: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20,
    borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#fff',
  },
  modeIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  modeLabel: { fontSize: 16, fontWeight: '700', color: '#334155' },
  modeDesc: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  settingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  settingsBorder: { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  settingsText: { fontSize: 15, fontWeight: '600', color: '#334155' },
  settingsArrow: { fontSize: 20, color: '#94a3b8' },
  poweredBy: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: 32, paddingBottom: 16 },
  poweredByText: { fontSize: 12, color: '#94a3b8' },
  poweredByBrand: { fontSize: 12, fontWeight: '700' },
});
