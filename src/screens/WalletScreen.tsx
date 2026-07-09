import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { useApp } from '../context/AppContext';
import { WdkService } from '../services/WdkService';
import { WalletState } from '../types';
import { Card, SectionLabel, PrimaryButton, Badge } from '../ui';

export default function WalletScreen() {
  const navigation = useNavigation();
  const { themeColors } = useApp();
  const [wallet, setWallet] = useState<WalletState | null>(WdkService.getState());
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPhrase, setImportPhrase] = useState('');
  const [seedRevealed, setSeedRevealed] = useState(false);

  useEffect(() => {
    WdkService.init().then(setWallet);
    const unsub = WdkService.subscribe(s => setWallet({ ...s }));
    return unsub;
  }, []);

  const createWallet = async () => {
    setCreating(true);
    try {
      const s = await WdkService.createWallet('testnet');
      setWallet({ ...s });
      Alert.alert(
        'Wallet created 🎉',
        'Your non-custodial WDK wallet is ready with 5.00 testnet USDt. Back up your recovery phrase from Settings below — it is the ONLY way to restore this wallet.',
      );
    } finally {
      setCreating(false);
    }
  };

  const doImport = async () => {
    try {
      const s = await WdkService.importWallet(importPhrase, 'testnet');
      setWallet({ ...s });
      setImporting(false);
      setImportPhrase('');
      Alert.alert('Wallet restored', 'Your wallet has been imported from the recovery phrase.');
    } catch (e: unknown) {
      Alert.alert('Import failed', e instanceof Error ? e.message : 'Invalid phrase');
    }
  };

  const revealSeed = () => {
    Alert.alert(
      '⚠️ Reveal recovery phrase?',
      'Anyone who sees these 12 words can take your funds. Make sure nobody is watching your screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'I understand — reveal', style: 'destructive', onPress: () => setSeedRevealed(true) },
      ],
    );
  };

  const copySeed = async () => {
    if (wallet?.mnemonic) {
      await Clipboard.setStringAsync(wallet.mnemonic);
      Alert.alert('Copied', 'Recovery phrase copied. Paste it somewhere safe, then clear your clipboard.');
    }
  };

  const copyAddress = async () => {
    if (wallet?.address) {
      await Clipboard.setStringAsync(wallet.address);
      Alert.alert('Copied', 'Wallet address copied to clipboard.');
    }
  };

  const switchNetwork = () => {
    if (!wallet) return;
    const next = wallet.network === 'testnet' ? 'mainnet' : 'testnet';
    if (next === 'mainnet') {
      Alert.alert(
        'Switch to Mainnet?',
        'Mainnet uses real USDt for pay-per-token compute. Testnet is recommended for the hackathon demo.',
        [
          { text: 'Stay on Testnet', style: 'cancel' },
          { text: 'Switch', onPress: () => WdkService.switchNetwork(next) },
        ],
      );
    } else {
      WdkService.switchNetwork(next);
    }
  };

  const resetWallet = () => {
    Alert.alert(
      'Forget wallet on this device?',
      'Your recovery phrase is the ONLY way to restore access. If you haven\'t backed it up, funds are lost forever.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget wallet', style: 'destructive',
          onPress: async () => { await WdkService.resetWallet(); setWallet(null); setSeedRevealed(false); },
        },
      ],
    );
  };

  const isMainnet = wallet?.network === 'mainnet';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={[styles.header, { backgroundColor: themeColors.card }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ fontSize: 22, color: '#64748b' }}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>WDK <Text style={{ color: themeColors.primary }}>Wallet</Text></Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {!wallet?.initialized ? (
          /* ── Connect flow ── */
          <>
            <Card style={{ alignItems: 'center', padding: 28 }}>
              <Text style={{ fontSize: 44 }}>👛</Text>
              <Text style={styles.connectTitle}>Set up your compute wallet</Text>
              <Text style={styles.connectDesc}>
                A non-custodial Tether WDK wallet pays for P2P inference by the token —
                no accounts, no cards, keys generated and held on this device only.
              </Text>
            </Card>

            {!importing ? (
              <>
                <PrimaryButton label={creating ? 'Generating keys…' : '✨ Create new wallet'} onPress={createWallet} loading={creating} />
                <TouchableOpacity onPress={() => setImporting(true)} style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <Text style={{ color: themeColors.primary, fontWeight: '700' }}>I have a recovery phrase</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Card style={{ padding: 18 }}>
                <Text style={styles.fieldLabel}>Enter your 12-word recovery phrase</Text>
                <TextInput
                  style={styles.phraseInput}
                  placeholder="word1 word2 word3 …"
                  placeholderTextColor="#94a3b8"
                  value={importPhrase}
                  onChangeText={setImportPhrase}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <PrimaryButton label="Restore wallet" onPress={doImport} disabled={importPhrase.trim().split(/\s+/).length !== 12} style={{ marginTop: 12 }} />
                <TouchableOpacity onPress={() => setImporting(false)} style={{ alignItems: 'center', paddingVertical: 12 }}>
                  <Text style={{ color: '#94a3b8', fontWeight: '600' }}>Back</Text>
                </TouchableOpacity>
              </Card>
            )}
          </>
        ) : (
          /* ── Wallet dashboard ── */
          <>
            <View style={styles.balanceCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.balanceLabel}>BALANCE</Text>
                <Badge
                  label={isMainnet ? 'MAINNET' : 'TESTNET'}
                  color={isMainnet ? '#059669' : '#b45309'}
                  bg={isMainnet ? '#ecfdf5' : '#fef3c7'}
                />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 6 }}>
                <Text style={styles.balanceValue}>{wallet.balanceUsdt.toFixed(4)}</Text>
                <Text style={styles.balanceCurrency}>USDt</Text>
              </View>
              <TouchableOpacity onPress={copyAddress}>
                <Text style={styles.addressText}>
                  {wallet.address?.slice(0, 10)}…{wallet.address?.slice(-6)}  ⧉
                </Text>
              </TouchableOpacity>
              <View style={styles.balanceFooter}>
                <View>
                  <Text style={styles.spentLabel}>Spent on compute</Text>
                  <Text style={styles.spentValue}>{wallet.totalSpentUsdt.toFixed(4)} USDt</Text>
                </View>
                <TouchableOpacity
                  style={styles.topupBtn}
                  onPress={() => WdkService.topUp(5)}
                >
                  <Text style={{ color: '#34d399', fontWeight: '800', fontSize: 13 }}>
                    {isMainnet ? '+ Deposit' : '+ 5.00 Faucet'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Settings */}
            <SectionLabel style={{ marginTop: 8 }}>Settings</SectionLabel>
            <Card>
              <TouchableOpacity style={styles.row} onPress={switchNetwork}>
                <Text style={styles.rowText}>🔁  Network</Text>
                <Text style={styles.rowValue}>{isMainnet ? 'Mainnet' : 'Testnet'} ›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.row, styles.rowBorder]} onPress={revealSeed}>
                <Text style={styles.rowText}>🔑  Reveal recovery phrase</Text>
                <Text style={styles.rowValue}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.row, styles.rowBorder]} onPress={resetWallet}>
                <Text style={[styles.rowText, { color: '#DC2626' }]}>🗑  Forget wallet on this device</Text>
              </TouchableOpacity>
            </Card>

            {/* Seed reveal */}
            {seedRevealed && wallet.mnemonic && (
              <Card style={{ borderColor: '#FCA5A5', borderWidth: 1.5, padding: 18 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#DC2626' }}>🔑 RECOVERY PHRASE</Text>
                  <TouchableOpacity onPress={() => setSeedRevealed(false)}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748b' }}>Hide</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.seedGrid}>
                  {wallet.mnemonic.split(' ').map((word, i) => (
                    <View key={i} style={styles.seedWord}>
                      <Text style={styles.seedIndex}>{i + 1}</Text>
                      <Text style={styles.seedText}>{word}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                  <PrimaryButton label="Copy phrase" variant="outline" onPress={copySeed} style={{ flex: 1, paddingVertical: 12 }} />
                </View>
                <Text style={styles.seedWarning}>
                  Write these words down in order and store them offline. Anyone with this phrase controls your funds.
                </Text>
              </Card>
            )}

            {/* Pay-per-token explainer */}
            <Card style={{ backgroundColor: themeColors.primary + '0A', borderColor: themeColors.primary + '25' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: themeColors.primaryDark, marginBottom: 4 }}>
                ⚡ How pay-per-token works
              </Text>
              <Text style={{ fontSize: 12.5, color: '#64748b', lineHeight: 19 }}>
                When the Coach uses the public compute network, your wallet streams 0.0001 USDt per generated
                token to the node over a WDK state channel — settled every 10 tokens. Local inference and your
                own paired desktop are always free.
              </Text>
            </Card>

            {/* Transactions */}
            <SectionLabel style={{ marginTop: 8 }}>Activity</SectionLabel>
            {wallet.txHistory.length === 0 ? (
              <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
                <Text style={{ fontSize: 28, marginBottom: 6 }}>🧾</Text>
                <Text style={{ color: '#64748b', fontWeight: '600' }}>No activity yet</Text>
                <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>P2P inference payments will appear here</Text>
              </Card>
            ) : (
              <Card style={{ paddingVertical: 6 }}>
                {wallet.txHistory.slice(0, 15).map((tx, i) => (
                  <View key={tx.id + i} style={[styles.txRow, i > 0 && styles.rowBorder]}>
                    <Text style={{ fontSize: 20 }}>{tx.type === 'topup' ? '⬇️' : '⚡'}</Text>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.txMemo}>{tx.memo}</Text>
                      <Text style={styles.txDate}>{new Date(tx.date).toLocaleString()}</Text>
                    </View>
                    <Text style={[styles.txAmount, { color: tx.type === 'topup' ? '#059669' : '#DC2626' }]}>
                      {tx.type === 'topup' ? '+' : '−'}{tx.amountUsdt.toFixed(4)}
                    </Text>
                  </View>
                ))}
              </Card>
            )}
          </>
        )}
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
  connectTitle: { fontSize: 19, fontWeight: '800', color: '#1e293b', marginTop: 12, marginBottom: 8 },
  connectDesc: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 },
  phraseInput: {
    backgroundColor: '#f8fafc', borderRadius: 14, padding: 14, minHeight: 80, fontSize: 14,
    borderWidth: 1, borderColor: '#e2e8f0', color: '#334155', textAlignVertical: 'top',
  },
  balanceCard: {
    backgroundColor: '#1e293b', borderRadius: 24, padding: 22, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 6,
  },
  balanceLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '700', letterSpacing: 1.5 },
  balanceValue: { fontSize: 40, fontWeight: '800', color: '#34d399' },
  balanceCurrency: { fontSize: 15, fontWeight: '700', color: 'rgba(52,211,153,0.7)', marginBottom: 6 },
  addressText: { fontSize: 12, color: '#64748b', marginTop: 6, fontWeight: '600' },
  balanceFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  spentLabel: { fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  spentValue: { fontSize: 14, color: '#e2e8f0', fontWeight: '700', marginTop: 2 },
  topupBtn: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 100, backgroundColor: 'rgba(52,211,153,0.12)',
    borderWidth: 1, borderColor: 'rgba(52,211,153,0.3)',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  rowText: { fontSize: 15, fontWeight: '600', color: '#334155' },
  rowValue: { fontSize: 14, color: '#94a3b8', fontWeight: '600' },
  seedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  seedWord: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8, width: '31%', borderWidth: 1, borderColor: '#e2e8f0',
  },
  seedIndex: { fontSize: 10, color: '#94a3b8', fontWeight: '700', marginRight: 6, minWidth: 14 },
  seedText: { fontSize: 13, color: '#1e293b', fontWeight: '700' },
  seedWarning: { fontSize: 11.5, color: '#DC2626', marginTop: 12, lineHeight: 16 },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  txMemo: { fontSize: 13, fontWeight: '600', color: '#334155' },
  txDate: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: '800' },
});
