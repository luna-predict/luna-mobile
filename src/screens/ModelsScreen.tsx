import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { ModelManager, MODEL_CATALOG, getDeviceCapability, formatBytes } from '../services/ModelManager';
import { ModelInfo, ModelRegistryEntry, ModelDownloadState } from '../types';
import { Card, SectionLabel, ProgressBar, Badge } from '../ui';

const CATEGORY_LABELS: Record<string, string> = {
  llm: '🧠 Language models',
  speech: '🎙️ Speech',
  translation: '🌍 Translation',
  vision: '👁️ Vision',
};

export default function ModelsScreen() {
  const navigation = useNavigation();
  const { themeColors } = useApp();
  const device = useMemo(() => getDeviceCapability(), []);
  const [registry, setRegistry] = useState<ModelRegistryEntry[]>([]);

  useEffect(() => {
    ModelManager.init().then(entries => setRegistry([...entries]));
    const unsub = ModelManager.subscribe(() => {
      ModelManager.init().then(entries => setRegistry([...entries]));
    });
    return unsub;
  }, []);

  const stateFor = (modelId: string): ModelDownloadState =>
    registry.find(e => e.modelId === modelId)?.state ?? { status: 'not_downloaded' };
  const isActive = (modelId: string): boolean =>
    registry.some(e => e.modelId === modelId && e.active && e.state.status === 'downloaded');

  const ramGB = device.totalRamBytes ? (device.totalRamBytes / (1024 ** 3)).toFixed(1) : null;

  const handleDownload = (model: ModelInfo) => {
    const canRun = device.totalRamBytes == null || device.totalRamBytes >= model.minRamBytes;
    if (!canRun) {
      Alert.alert(
        'Not enough RAM',
        `${model.name} needs ${formatBytes(model.minRamBytes)} RAM but this device has ${ramGB} GB. Use P2P delegation in the Coach to run it on a paired desktop instead.`,
      );
      return;
    }
    ModelManager.startDownload(model.id);
  };

  const handleDelete = (model: ModelInfo) => {
    Alert.alert('Remove model?', `${model.name} will be deleted from device storage. You can re-download it anytime.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => ModelManager.deleteModel(model.id) },
    ]);
  };

  const grouped = useMemo(() => {
    const groups: Record<string, ModelInfo[]> = {};
    for (const m of MODEL_CATALOG) (groups[m.category] ??= []).push(m);
    return groups;
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={[styles.header, { backgroundColor: themeColors.card }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ fontSize: 22, color: '#64748b' }}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI <Text style={{ color: themeColors.primary }}>Models</Text></Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {/* Device capability */}
        <Card style={{ padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 28 }}>📱</Text>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.deviceName}>{device.modelName}</Text>
              <Text style={styles.deviceSub}>{device.osName} {device.osVersion}{device.isPhysicalDevice ? '' : ' · simulator'}</Text>
            </View>
            <Badge label="QVAC READY" color="#059669" bg="#ecfdf5" />
          </View>
          <View style={styles.specRow}>
            <View style={styles.specItem}>
              <Text style={[styles.specValue, { color: themeColors.primary }]}>{ramGB ? `${ramGB} GB` : '—'}</Text>
              <Text style={styles.specLabel}>Device RAM</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={[styles.specValue, { color: themeColors.primary }]}>
                {MODEL_CATALOG.filter(m => device.runnableModelIds.includes(m.id)).length}/{MODEL_CATALOG.length}
              </Text>
              <Text style={styles.specLabel}>Models runnable</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={[styles.specValue, { color: themeColors.primary }]}>
                {registry.filter(e => e.state.status === 'downloaded').length}
              </Text>
              <Text style={styles.specLabel}>Downloaded</Text>
            </View>
          </View>
          {device.recommendedModelId && (
            <View style={[styles.recommendBanner, { backgroundColor: themeColors.primary + '10' }]}>
              <Text style={{ fontSize: 12, color: themeColors.primaryDark, fontWeight: '600' }}>
                💡 Recommended for this device: {MODEL_CATALOG.find(m => m.id === device.recommendedModelId)?.name}
              </Text>
            </View>
          )}
        </Card>

        {/* Catalog by category */}
        {Object.entries(grouped).map(([category, models]) => (
          <View key={category} style={{ marginTop: 12 }}>
            <SectionLabel>{CATEGORY_LABELS[category] ?? category}</SectionLabel>
            {models.map(model => {
              const state = stateFor(model.id);
              const active = isActive(model.id);
              const runnable = device.totalRamBytes == null || device.totalRamBytes >= model.minRamBytes;
              const recommended = device.recommendedModelId === model.id;
              return (
                <Card key={model.id} style={{ padding: 18 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text style={styles.modelName}>{model.name}</Text>
                        {active && <Badge label="ACTIVE" color="#059669" bg="#ecfdf5" />}
                        {recommended && !active && <Badge label="RECOMMENDED" color={themeColors.primaryDark} bg={themeColors.primary + '15'} />}
                        {!runnable && <Badge label="NEEDS P2P" color="#b45309" bg="#fef3c7" />}
                      </View>
                      <Text style={styles.modelMeta}>
                        {model.family} · {model.parameters} · {model.quantization}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.modelDesc}>{model.description}</Text>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {model.capabilities.map(cap => (
                      <View key={cap} style={styles.capChip}>
                        <Text style={styles.capChipText}>{cap}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.modelFooter}>
                    <Text style={styles.modelSize}>
                      {formatBytes(model.sizeBytes)} · needs {formatBytes(model.minRamBytes)} RAM
                    </Text>

                    {state.status === 'not_downloaded' && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: runnable ? themeColors.primary : '#f1f5f9' }]}
                        onPress={() => handleDownload(model)}
                      >
                        <Text style={[styles.actionBtnText, { color: runnable ? '#fff' : '#94a3b8' }]}>
                          {runnable ? '⬇ Download' : 'Too large'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {state.status === 'downloaded' && (
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {model.category === 'llm' && !active && (
                          <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: themeColors.primary }]}
                            onPress={() => ModelManager.setActive(model.id)}
                          >
                            <Text style={[styles.actionBtnText, { color: '#fff' }]}>Use for Coach</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: '#FEF2F2' }]}
                          onPress={() => handleDelete(model)}
                        >
                          <Text style={[styles.actionBtnText, { color: '#DC2626' }]}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {state.status === 'error' && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: themeColors.primary }]}
                        onPress={() => handleDownload(model)}
                      >
                        <Text style={[styles.actionBtnText, { color: '#fff' }]}>Retry</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {state.status === 'downloading' && (
                    <View style={{ marginTop: 12 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600' }}>
                          Downloading from QVAC registry… {Math.round(state.progress * 100)}%
                        </Text>
                        <TouchableOpacity onPress={() => ModelManager.cancelDownload(model.id)}>
                          <Text style={{ fontSize: 12, color: '#DC2626', fontWeight: '700' }}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                      <ProgressBar progress={state.progress} />
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
        ))}

        <Card style={{ backgroundColor: '#1e293b', padding: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 6 }}>🌐 Too big for your phone?</Text>
          <Text style={{ fontSize: 13, color: '#94a3b8', lineHeight: 19 }}>
            Models beyond your device's RAM can run on a paired desktop or the public compute network via
            P2P delegation — switch the Coach to P2P mode. Streams are end-to-end encrypted (Noise protocol)
            and public nodes are paid per token from your WDK wallet.
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
  deviceName: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  deviceSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  specRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingTop: 14 },
  specItem: { flex: 1, alignItems: 'center' },
  specValue: { fontSize: 18, fontWeight: '800' },
  specLabel: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  recommendBanner: { marginTop: 14, borderRadius: 12, padding: 10 },
  modelName: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  modelMeta: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  modelDesc: { fontSize: 13, color: '#64748b', lineHeight: 19, marginTop: 10 },
  capChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, backgroundColor: '#f1f5f9' },
  capChipText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  modelFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, flexWrap: 'wrap', gap: 8,
  },
  modelSize: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  actionBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 100 },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
});
