import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { AppMode, ChatMessage, SharedSnapshot } from '../types';
import { LocalInference } from '../ai/LocalInference';
import { DelegatedInference, DelegationTarget } from '../ai/DelegatedInference';
import { LocalRagEngine } from '../ai/LocalRagEngine';
import { composePartnerReply } from '../ai/InsightComposer';
import { WdkService } from '../services/WdkService';
import { PearsPartnerService } from '../services/PearsPartnerService';
import { Store } from '../storage/Store';
import { RootStackParamList } from '../navigation/AppNavigator';

const MODE_CONFIG: Record<AppMode, { greeting: string; prompts: string[]; persona: string; icon: string }> = {
  period: {
    greeting: "Hi! I'm Luna, your private cycle companion 🌙\n\nEverything we discuss stays on your phone. How can I help?",
    prompts: ['Why am I so tired?', 'What helps with cramps?', 'When am I most fertile?', 'Why is my mood changing?'],
    persona: 'Cycle Coach',
    icon: '🌸',
  },
  conceive: {
    greeting: "Hey there! I'm Luna, your fertility guide 🥚✨\n\nWhat would you like to know?",
    prompts: ['Best time to conceive?', 'What is BBT tracking?', 'How to read OPK tests?', 'Tips to improve fertility'],
    persona: 'Fertility Guide',
    icon: '🥚',
  },
  pregnancy: {
    greeting: "Hello, mama! I'm Luna 🤰💕\n\nHow can I support you today?",
    prompts: ["What's happening this week?", 'Safe exercises for me?', 'Foods to avoid?', 'When to call my doctor?'],
    persona: 'Pregnancy Support',
    icon: '🤰',
  },
  perimenopause: {
    greeting: "Hi there! I'm Luna 🦋\n\nI'm here to support you through this transition. What's on your mind?",
    prompts: ['Managing hot flashes', 'Sleep better at night', 'Mood swing tips', 'Should I see a doctor?'],
    persona: 'Midlife Wellness',
    icon: '🦋',
  },
};

const MEN_CONFIG = {
  greeting: "Hey! I'm Luna 🤝\n\nI help you understand and support your partner — I only see what she shares. I've also got your back on your own wellness. What's up?",
  prompts: ['How can I support her today?', 'Why might she feel off?', 'Good time to plan a date?', 'Tips for my own stress'],
  persona: 'Partner Coach',
  icon: '🤝',
};

export default function AICoachScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { themeColors, currentMode, user, cycle, logs } = useApp();
  const isMale = user?.sex === 'male';
  const config = isMale ? MEN_CONFIG : MODE_CONFIG[currentMode];

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [tier, setTier] = useState<'local' | 'p2p'>('local');
  const [p2pTarget, setP2pTarget] = useState<DelegationTarget>('desktop');
  const [showTierSheet, setShowTierSheet] = useState(false);
  const [localModelName, setLocalModelName] = useState<string | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [wdkBalance, setWdkBalance] = useState<string | null>(null);

  const delegatedRef = useRef<DelegatedInference | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Hydrate chat + wallet + model availability
  useEffect(() => {
    delegatedRef.current = new DelegatedInference();
    Store.getChatHistory().then(history => {
      setMessages(history.length > 0 ? history : [{ role: 'assistant', content: config.greeting }]);
    });
    WdkService.init().then(s => setWdkBalance(s ? s.balanceUsdt.toFixed(4) : null));
    const unsub = WdkService.subscribe(s => setWdkBalance(s.balanceUsdt.toFixed(4)));
    LocalInference.isAvailable().then(ok => setLocalModelName(ok ? LocalInference.getActiveModelName() : null));
    return unsub;
  }, []);

  // Refresh model availability when returning from the Models screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      LocalInference.isAvailable().then(ok => setLocalModelName(ok ? LocalInference.getActiveModelName() : null));
    });
    return unsubscribe;
  }, [navigation]);

  // Reset greeting when women switch modes (fresh persona, keep nothing stale)
  const prevModeRef = useRef(currentMode);
  useEffect(() => {
    if (!isMale && prevModeRef.current !== currentMode) {
      prevModeRef.current = currentMode;
      const fresh: ChatMessage[] = [{ role: 'assistant', content: MODE_CONFIG[currentMode].greeting }];
      setMessages(fresh);
      Store.saveChatHistory(fresh);
    }
  }, [currentMode, isMale]);

  const persist = useCallback((msgs: ChatMessage[]) => {
    setMessages(msgs);
    Store.saveChatHistory(msgs);
  }, []);

  const streamIntoLastMessage = (partial: string) => {
    setMessages(prev => {
      const updated = [...prev];
      updated[updated.length - 1] = { ...updated[updated.length - 1], content: partial };
      return updated;
    });
  };

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isTyping) return;

    const base: ChatMessage[] = [...messages, { role: 'user', content: msg, timestamp: new Date().toISOString() }];
    persist(base);
    setInput('');
    setIsTyping(true);

    try {
      // ── Men side: partner coach, always instant + local ──
      if (isMale) {
        const snap: SharedSnapshot | null = await PearsPartnerService.fetchSnapshot();
        await new Promise(r => setTimeout(r, 900));
        const reply = composePartnerReply(msg, snap?.phase, snap?.sharerName ?? 'your partner');
        setIsTyping(false);
        persist([...base, { role: 'assistant', content: reply, tier: 'local', timestamp: new Date().toISOString() }]);
        return;
      }

      // ── Women side ──
      const relevantLogs = await LocalRagEngine.retrieveRelevantLogs(msg);

      if (tier === 'local') {
        const available = await LocalInference.isAvailable();
        if (!available) {
          setIsTyping(false);
          Alert.alert(
            'No local model yet',
            'Download MedPsy 1.7B from the Models page to chat fully offline — or switch the Coach to P2P mode.',
            [
              { text: 'Use P2P instead', onPress: () => setTier('p2p') },
              { text: 'Open Models', onPress: () => navigation.navigate('Models') },
            ],
          );
          persist(base.slice(0, -1)); // put the message back in the input
          setInput(msg);
          return;
        }
        setModelLoading(true);
        await LocalInference.initializeModel();
        setModelLoading(false);
        setIsTyping(false);
        persist([...base, { role: 'assistant', content: '', tier: 'local', timestamp: new Date().toISOString() }]);
        const reply = await LocalInference.generateInsight({
          question: msg,
          mode: currentMode,
          cycle,
          recentLogs: relevantLogs,
          onToken: streamIntoLastMessage,
        });
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: reply };
          Store.saveChatHistory(updated);
          return updated;
        });
      } else {
        // P2P — public network needs a funded wallet
        if (p2pTarget === 'network') {
          const wallet = WdkService.getState();
          if (!wallet?.initialized) {
            setIsTyping(false);
            Alert.alert(
              'Wallet needed',
              'Public compute nodes are paid per token. Set up your WDK wallet first, or delegate to your own paired desktop for free.',
              [
                { text: 'Use my desktop', onPress: () => setP2pTarget('desktop') },
                { text: 'Open Wallet', onPress: () => navigation.navigate('Wallet') },
              ],
            );
            persist(base.slice(0, -1));
            setInput(msg);
            return;
          }
        }
        setIsTyping(false);
        persist([...base, { role: 'assistant', content: '', tier: 'p2p', timestamp: new Date().toISOString() }]);
        const reply = await delegatedRef.current!.runDelegatedInference({
          question: msg,
          mode: currentMode,
          cycle,
          recentLogs: relevantLogs,
          target: p2pTarget,
          onToken: streamIntoLastMessage,
        });
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: reply };
          Store.saveChatHistory(updated);
          return updated;
        });
      }
    } catch (e) {
      console.error('[Coach] inference failed', e);
      setIsTyping(false);
      setModelLoading(false);
      persist([...base, { role: 'assistant', content: 'Sorry, I hit a snag running inference. Please try again.', timestamp: new Date().toISOString() }]);
    }
  };

  const clearChat = () => {
    Alert.alert('Clear conversation?', 'Chat history is stored only on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: () => persist([{ role: 'assistant', content: config.greeting }]),
      },
    ]);
  };

  const tierLabel = tier === 'local'
    ? `🖥️ ${localModelName ?? 'Local'}`
    : p2pTarget === 'desktop' ? '💻 My Desktop' : '🌐 Network';
  const tierSub = isMale
    ? MEN_CONFIG.persona
    : tier === 'local'
      ? `${config.persona} · ${localModelName ?? 'no model downloaded'}`
      : p2pTarget === 'desktop'
        ? `${config.persona} · MedPsy-4B on your desktop (free)`
        : `${config.persona} · MedPsy-4B public node (pay-per-token)`;

  const visibleMessages = messages.filter(m => m.role !== 'system');
  const showSuggestions = visibleMessages.length <= 2 && !isTyping;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.card }]}>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }} onLongPress={clearChat}>
          <View style={[styles.avatarSmall, { backgroundColor: themeColors.primary + '15' }]}>
            <Text style={{ fontSize: 16 }}>{config.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Luna AI</Text>
            <Text style={[styles.headerSub, { color: themeColors.primary }]} numberOfLines={1}>{tierSub}</Text>
          </View>
        </TouchableOpacity>
        {!isMale && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => setShowTierSheet(s => !s)}
              style={[styles.modeBtn, { backgroundColor: tier === 'local' ? themeColors.primary + '15' : '#dbeafe' }]}
            >
              <Text style={[styles.modeBtnText, { color: tier === 'local' ? themeColors.primary : '#3b82f6' }]}>
                {tierLabel} ▾
              </Text>
            </TouchableOpacity>
            {wdkBalance !== null && (
              <TouchableOpacity style={styles.walletBtn} onPress={() => navigation.navigate('Wallet')}>
                <Text style={styles.walletText}>💰 {wdkBalance}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Tier picker sheet */}
      {showTierSheet && !isMale && (
        <View style={[styles.tierSheet, { backgroundColor: themeColors.card }]}>
          {[
            {
              key: 'local', title: '🖥️ On-device', active: tier === 'local',
              desc: localModelName ? `${localModelName} · 100% private, offline` : 'Download a model first (Models page)',
              onPress: () => { setTier('local'); setShowTierSheet(false); },
            },
            {
              key: 'desktop', title: '💻 My desktop (Tier 2)', active: tier === 'p2p' && p2pTarget === 'desktop',
              desc: 'MedPsy-4B on your paired computer · free, private',
              onPress: () => { setTier('p2p'); setP2pTarget('desktop'); setShowTierSheet(false); },
            },
            {
              key: 'network', title: '🌐 Public network (Tier 3)', active: tier === 'p2p' && p2pTarget === 'network',
              desc: 'Anonymized prompt · 0.0001 USDt per token via WDK',
              onPress: () => { setTier('p2p'); setP2pTarget('network'); setShowTierSheet(false); },
            },
          ].map(opt => (
            <TouchableOpacity
              key={opt.key}
              onPress={opt.onPress}
              style={[styles.tierOption, opt.active && { backgroundColor: themeColors.primary + '0C', borderColor: themeColors.primary }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.tierTitle, opt.active && { color: themeColors.primary }]}>{opt.title}</Text>
                <Text style={styles.tierDesc}>{opt.desc}</Text>
              </View>
              {opt.active && <Text style={{ color: themeColors.primary, fontWeight: '800' }}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
        >
          {visibleMessages.map((msg, i) => (
            <View
              key={i}
              style={[
                styles.bubble,
                msg.role === 'user'
                  ? [styles.userBubble, { backgroundColor: themeColors.primary }]
                  : [styles.aiBubble, { backgroundColor: themeColors.card }],
              ]}
            >
              {msg.role === 'assistant' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <View style={[styles.avatarTiny, { backgroundColor: themeColors.primary + '20' }]}>
                    <Text style={{ fontSize: 10 }}>🌙</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: '600' }}>
                    Luna{msg.tier === 'p2p' ? ' · P2P' : ''}
                  </Text>
                </View>
              )}
              <Text style={[styles.bubbleText, msg.role === 'user' ? { color: '#fff' } : { color: '#334155' }]}>
                {msg.content || '…'}
              </Text>
            </View>
          ))}

          {(isTyping || modelLoading) && (
            <View style={[styles.aiBubble, styles.bubble, { backgroundColor: themeColors.card, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
              <ActivityIndicator color={themeColors.primary} size="small" />
              {modelLoading && <Text style={{ fontSize: 12, color: '#94a3b8' }}>Loading {localModelName} into RAM…</Text>}
            </View>
          )}

          {showSuggestions && (
            <View style={styles.suggestRow}>
              {config.prompts.map(p => (
                <TouchableOpacity key={p} onPress={() => sendMessage(p)} style={[styles.suggestPill, { backgroundColor: themeColors.primary + '12' }]}>
                  <Text style={[styles.suggestText, { color: themeColors.primary }]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Input */}
        <View style={[styles.inputBar, { backgroundColor: themeColors.card }]}>
          <TextInput
            style={styles.input}
            placeholder="Ask Luna anything…"
            placeholderTextColor="#94a3b8"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => sendMessage()}
            returnKeyType="send"
          />
          <TouchableOpacity
            onPress={() => sendMessage()}
            disabled={!input.trim() || isTyping}
            style={[styles.sendBtn, { backgroundColor: input.trim() && !isTyping ? themeColors.primary : '#e2e8f0' }]}
          >
            <Text style={{ color: input.trim() && !isTyping ? '#fff' : '#94a3b8', fontSize: 18 }}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  avatarSmall: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  headerSub: { fontSize: 10, fontWeight: '600' },
  modeBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  modeBtnText: { fontSize: 11, fontWeight: '700' },
  walletBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' },
  walletText: { fontSize: 11, fontWeight: '700', color: '#059669' },
  tierSheet: {
    paddingHorizontal: 12, paddingVertical: 10, gap: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  tierOption: {
    flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#e2e8f0',
  },
  tierTitle: { fontSize: 13.5, fontWeight: '800', color: '#334155' },
  tierDesc: { fontSize: 11.5, color: '#94a3b8', marginTop: 2 },
  bubble: { maxWidth: '85%', borderRadius: 20, padding: 14, marginBottom: 12 },
  userBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  aiBubble: {
    alignSelf: 'flex-start', borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8,
  },
  avatarTiny: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  suggestPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100 },
  suggestText: { fontSize: 13, fontWeight: '600' },
  inputBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)',
  },
  input: {
    flex: 1, backgroundColor: '#f8fafc', borderRadius: 100, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 15, color: '#334155', marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0',
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
