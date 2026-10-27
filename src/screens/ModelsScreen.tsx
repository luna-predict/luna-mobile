import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Network from 'expo-network';
import { Download, Pause, Play, X, Trash2, Check, Zap, Cpu, HardDrive, Smartphone, ShieldCheck } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { ModelInfo } from '../types';
import { ModelManager, MODEL_CATALOG, formatBytes, getDeviceCapability, FitVerdict } from '../services/ModelManager';
import { coachEngine } from '../ai/engine';
import { qvacUnavailableReason } from '../ai/qvac';
import { useModelRegistryVersion } from '../ai/useModels';
import { Card, SectionLabel, ProgressBar, Badge, Button, ScreenHeader, Banner, useToast, space, type } from '../ui';

const GB = 1024 ** 3;

export default function ModelsScreen() {
  const navigation = useNavigation();
  const toast = useToast();
  const { themeColors: t } = useApp();
  useModelRegistryVersion();
  const device = useMemo(() => getDeviceCapability(), []);
  const [fit, setFit] = useState<Record<string, FitVerdict>>({});
  const [warming, setWarming] = useState(false);
  const engineKind = coachEngine.kind();
  const reason = qvacUnavailableReason();

  useEffect(() => {
    if (engineKind !== 'qvac') return;
    (async () => {
      const out: Record<string, FitVerdict> = {};
      for (const m of MODEL_CATALOG) out[m.id] = await ModelManager.assessFit(m.id);
      setFit(out);
    })();
  }, [engineKind]);

  const tooLarge = (m: ModelInfo) =>
    fit[m.id] === 'likely-too-large' || (device.totalRamBytes != null && m.role === 'coach' && m.sizeBytes > device.totalRamBytes * 0.45);

  const download = async (m: ModelInfo) => {
    const free = getDeviceCapability().freeDiskBytes;
    if (free != null && free < m.sizeBytes * 1.2) {
      Alert.alert('Not enough storage', `${m.name} needs about ${formatBytes(m.sizeBytes * 1.2)} free. You have ${formatBytes(free)}.`);
      return;
    }
    const start = () => ModelManager.startDownload(m.id).then(() => {
      const s = ModelManager.stateFor(m.id);
      if (s.status === 'downloaded') toast.show(`${m.name} is ready`);
      if (s.status === 'error') toast.show(s.message, 'error');
    }).catch(e => toast.show(String(e?.message ?? e), 'error'));
    try {
      const net = await Network.getNetworkStateAsync();
      if (net.type === Network.NetworkStateType.CELLULAR) {
        Alert.alert('Use mobile data?', `${m.name} is ${formatBytes(m.sizeBytes)}. Wi-Fi is recommended.`, [
          { text: 'Wait for Wi-Fi', style: 'cancel' },
          { text: 'Download anyway', onPress: start },
        ]);
        return;
      }
      if (net.isInternetReachable === false) {
        toast.show('No internet connection right now', 'error');
        return;
      }
    } catch {
      // network state unavailable — try anyway
    }
    start();
  };

  const remove = (m: ModelInfo) => {
    Alert.alert(`Delete ${m.name}?`, `Frees ${formatBytes(m.sizeBytes)}. You can download it again any time.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await ModelManager.deleteModel(m.id); toast.show(`${m.name} deleted`, 'info'); } },
    ]);
  };

  const warmUp = async (m: ModelInfo) => {
    setWarming(true);
    const started = Date.now();
    try {
      await coachEngine.ensureLoaded(m.id);
      toast.show(`${m.name} loaded in ${((Date.now() - started) / 1000).toFixed(1)} s`);
    } catch (e) {
      toast.show(`Could not load: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setWarming(false);
    }
  };

  const renderModel = (m: ModelInfo) => {
    const state = ModelManager.stateFor(m.id);
    const active = ModelManager.getActiveModel()?.id === m.id;
    const isLlm = m.role === 'coach' || m.role === 'coach-light';
    const big = tooLarge(m);
    return (
      <Card key={m.id} style={active ? { borderColor: t.primaryStrong, borderWidth: 2 } : undefined}>
        <View style={styles.titleRow}>
          <Text style={{ ...type.heading, color: t.text, flex: 1 }}>{m.name}</Text>
          <Text style={{ ...type.label, color: t.textMuted }}>{formatBytes(m.sizeBytes)}</Text>
        </View>
        <View style={styles.badges}>
          {active && <Badge label="Luna uses this" color={t.success} bg={t.successTint} icon={Check} />}
          {m.medical && <Badge label="Medical model" color={t.primaryStrong} bg={t.tint} />}
          {fit[m.id] === 'likely-fits' && <Badge label="Fits this phone" color={t.success} bg={t.successTint} />}
          {big && <Badge label="Too large for this phone" color={t.warning} bg={t.warningTint} />}
        </View>
        <Text style={[styles.desc, { color: t.textMuted }]}>{m.description}</Text>

        {state.status === 'downloading' && (
          <View style={{ gap: space.sm, marginTop: space.md }}>
            <ProgressBar progress={state.progress} label={`${m.name} download progress`} />
            <Text style={{ fontSize: 13, color: t.textMuted }}>
              {Math.round(state.progress * 100)}% · {formatBytes(state.downloadedBytes ?? state.progress * m.sizeBytes)} of {formatBytes(state.totalBytes ?? m.sizeBytes)}
            </Text>
            <View style={styles.actions}>
              <Button label="Pause" variant="outline" compact icon={Pause} onPress={() => ModelManager.pauseDownload(m.id)} style={{ flex: 1 }} />
              <Button label="Cancel" variant="ghost" compact icon={X} onPress={() => ModelManager.cancelDownload(m.id)} style={{ flex: 1 }} />
            </View>
          </View>
        )}
        {state.status === 'paused' && (
          <View style={{ gap: space.sm, marginTop: space.md }}>
            <ProgressBar progress={state.progress} label={`${m.name} paused`} color={t.subtext} />
            <Text style={{ fontSize: 13, color: t.textMuted }}>Paused at {Math.round(state.progress * 100)}%</Text>
            <View style={styles.actions}>
              <Button label="Resume" compact icon={Play} onPress={() => download(m)} style={{ flex: 1 }} />
              <Button label="Discard" variant="ghost" compact icon={X} onPress={() => ModelManager.cancelDownload(m.id)} style={{ flex: 1 }} />
            </View>
          </View>
        )}
        {state.status === 'error' && (
          <View style={{ marginTop: space.md, gap: space.sm }}>
            <Text style={{ color: t.danger }}>{state.message}</Text>
            <Button label="Try again" compact icon={Download} onPress={() => download(m)} />
          </View>
        )}
        {state.status === 'not_downloaded' && (
          <Button
            testID={`download-${m.id}`}
            label={`Download · ${formatBytes(m.sizeBytes)}`}
            icon={Download}
            compact
            disabled={engineKind !== 'qvac' || big}
            onPress={() => download(m)}
            style={{ marginTop: space.md }}
          />
        )}
        {state.status === 'downloaded' && (
          <View style={[styles.actions, { marginTop: space.md }]}>
            {isLlm && !active && <Button label="Use for Luna" compact icon={Check} onPress={() => ModelManager.setActive(m.id)} style={{ flex: 1 }} />}
            {isLlm && active && (
              <Button label={coachEngine.isLoaded(m.id) ? 'Loaded' : 'Warm up'} variant="tonal" compact icon={Zap}
                loading={warming} disabled={coachEngine.isLoaded(m.id)} onPress={() => warmUp(m)} style={{ flex: 1 }} />
            )}
            <Button label="Delete" variant="danger" compact icon={Trash2} onPress={() => remove(m)} style={{ flex: 1 }} />
          </View>
        )}
      </Card>
    );
  };

  const stats = coachEngine.stats();

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: t.background }]}>
      <ScreenHeader title="AI" accent="models" subtitle="Runs on this phone with QVAC" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}>
        {engineKind === 'demo' && (
          <Banner severity="warn" title="On-device AI isn't available here" body={reason ?? 'Install the LunaPredict build to download models.'} />
        )}

        <Card>
          <View style={styles.deviceRow}><Smartphone color={t.textMuted} size={18} /><Text style={[styles.deviceText, { color: t.text }]}>{device.modelName}</Text></View>
          <View style={styles.deviceRow}><Cpu color={t.textMuted} size={18} /><Text style={[styles.deviceText, { color: t.text }]}>Memory: {device.totalRamBytes ? `${(device.totalRamBytes / GB).toFixed(1)} GB` : 'unknown'}</Text></View>
          <View style={styles.deviceRow}><HardDrive color={t.textMuted} size={18} /><Text style={[styles.deviceText, { color: t.text }]}>Free storage: {formatBytes(device.freeDiskBytes)}</Text></View>
          <View style={styles.deviceRow}><ShieldCheck color={t.success} size={18} /><Text style={[styles.deviceText, { color: t.text }]}>Models download once, then everything runs offline. Nothing you type or say leaves the phone.</Text></View>
        </Card>

        <SectionLabel style={{ marginTop: space.sm }}>Luna's brain</SectionLabel>
        {MODEL_CATALOG.filter(m => m.category === 'llm').map(renderModel)}

        <SectionLabel style={{ marginTop: space.sm }}>Language & voice</SectionLabel>
        {MODEL_CATALOG.filter(m => m.category !== 'llm').map(renderModel)}

        {engineKind === 'qvac' && (
          <>
            <SectionLabel style={{ marginTop: space.sm }}>Diagnostics</SectionLabel>
            <Card>
              <Text style={{ color: t.textMuted, lineHeight: 22 }}>
                {`Engine: QVAC SDK (on-device)\nLoaded now: ${stats.loadedModels.length ? stats.loadedModels.join(', ') : 'none'}\nLast load: ${stats.loadMs ? `${(stats.loadMs / 1000).toFixed(1)} s` : '—'}\nLast speed: ${stats.tokensPerSecond ? `${stats.tokensPerSecond.toFixed(1)} tokens/s` : '—'}\nTime to first word: ${stats.ttftMs ? `${(stats.ttftMs / 1000).toFixed(1)} s` : '—'}`}
              </Text>
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.sm },
  desc: { fontSize: 14, lineHeight: 20, marginTop: space.sm },
  actions: { flexDirection: 'row', gap: space.sm },
  deviceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: 6 },
  deviceText: { fontSize: 15, flex: 1, lineHeight: 21 },
});
