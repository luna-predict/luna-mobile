import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useMode, AppMode } from '../context/ModeContext';
import { LocalInference } from '../ai/LocalInference';
import { DelegatedInference } from '../ai/DelegatedInference';
import { WdkManager } from '../wallet/WdkManager';
import { LocalRagEngine } from '../ai/LocalRagEngine';

// Mode-specific config
const MODE_CONFIG: Record<AppMode, {
  greeting: string;
  prompts: string[];
  persona: string;
  icon: string;
}> = {
  period: {
    greeting: "Hi! I'm Luna, your private cycle companion 🌙\n\nHow can I help you today?",
    prompts: ['Why am I so tired?', 'What helps with cramps?', 'When am I most fertile?', 'Why is my mood changing?'],
    persona: 'Period Tracking (MedPsy-1.7B)',
    icon: '🌸',
  },
  conceive: {
    greeting: "Hey there! I'm Luna, your fertility guide 🥚✨\n\nWhat would you like to know?",
    prompts: ['Best time to conceive?', 'What is BBT tracking?', 'How to read OPK tests?', 'Tips to improve fertility'],
    persona: 'Fertility Guide (MedPsy-1.7B)',
    icon: '🥚',
  },
  pregnancy: {
    greeting: "Hello, mama! I'm Luna 🤰💕\n\nHow can I support you?",
    prompts: ["What's happening this week?", 'Safe exercises for me?', 'Foods to avoid?', 'When to call my doctor?'],
    persona: 'Pregnancy Support (MedPsy-1.7B)',
    icon: '🤰',
  },
  perimenopause: {
    greeting: "Hi there! I'm Luna 🦋\n\nI'm here to support you through this transition. What's on your mind?",
    prompts: ['Managing hot flashes', 'Sleep better at night', 'Mood swing tips', 'Should I see a doctor?'],
    persona: 'Midlife Wellness (MedPsy-1.7B)',
    icon: '🦋',
  },
};

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export default function AICoachScreen() {
  const { themeColors, currentMode } = useMode();
  const config = MODE_CONFIG[currentMode];

  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: config.greeting },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [inferenceTier, setInferenceTier] = useState<'local' | 'p2p'>('local');
  
  // Wallet state
  const [wdkBalance, setWdkBalance] = useState("5.0000");
  const wdkManagerRef = useRef<WdkManager | null>(null);
  const delegatedRef = useRef<DelegatedInference | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  // Initialize Wallet and Handlers
  useEffect(() => {
    const manager = new WdkManager((balance) => {
      setWdkBalance(balance.toFixed(4));
    });
    manager.initializeWallet();
    wdkManagerRef.current = manager;
    delegatedRef.current = new DelegatedInference();
  }, []);

  // Reset greeting when mode changes
  useEffect(() => {
    const newConfig = MODE_CONFIG[currentMode];
    setMessages([
      { role: 'assistant', content: newConfig.greeting },
    ]);
  }, [currentMode]);

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg) return;
    
    const newMessages: Message[] = [...messages, { role: 'user', content: msg }];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    try {
      // 1. Execute Local RAG - embed symptom history
      const userContext = await LocalRagEngine.retrieveRelevantLogs(msg);
      const systemPrompt: Message = {
        role: 'system', 
        content: `You are Luna, an intelligent health assistant based on MedPsy models. ${userContext}`
      };
      const contextHistory = [systemPrompt, ...newMessages];

      // 2. Route Inference
      if (inferenceTier === 'local') {
        // TIER 1: Local MedPsy-1.7B
        await LocalInference.initializeModel();
        const responseText = await LocalInference.generateInsight(contextHistory);
        setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
        setIsTyping(false);
      } else {
        // TIER 3: P2P Delegated MedPsy-4B + WDK Streaming
        // We push an empty assistant message that we will stream into
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
        setIsTyping(false); // Hide the spinner since we are streaming text

        await delegatedRef.current?.runDelegatedInference(
          contextHistory,
          wdkManagerRef.current!,
          (streamedText) => {
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1].content = streamedText;
              return updated;
            });
          }
        );
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error connecting to the QVAC engine.' }]);
      setIsTyping(false);
    }
  };

  const visibleMessages = messages.filter(m => m.role !== 'system');
  const showSuggestions = visibleMessages.length <= 2;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.card }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[styles.avatarSmall, { backgroundColor: themeColors.primary + '15' }]}>
            <Text style={{ fontSize: 16 }}>{config.icon}</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Luna AI</Text>
            <Text style={[styles.headerSub, { color: themeColors.primary }]}>{inferenceTier === 'local' ? config.persona : 'Network (MedPsy-4B)'}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => setInferenceTier(inferenceTier === 'local' ? 'p2p' : 'local')}
            style={[styles.modeBtn, { backgroundColor: inferenceTier === 'local' ? themeColors.primary + '15' : '#dbeafe' }]}
          >
            <Text style={[styles.modeBtnText, { color: inferenceTier === 'local' ? themeColors.primary : '#3b82f6' }]}>
              {inferenceTier === 'local' ? '🖥️ Local' : '🌐 P2P'}
            </Text>
          </TouchableOpacity>
          <View style={styles.walletBtn}>
            <Text style={styles.walletText}>💰 {wdkBalance}</Text>
          </View>
        </View>
      </View>

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
                  <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: '600' }}>Luna</Text>
                </View>
              )}
              <Text style={[styles.bubbleText, msg.role === 'user' ? { color: '#fff' } : { color: '#334155' }]}>
                {msg.content}
              </Text>
            </View>
          ))}

          {isTyping && (
            <View style={[styles.aiBubble, styles.bubble, { backgroundColor: themeColors.card }]}>
              <ActivityIndicator color={themeColors.primary} size="small" />
            </View>
          )}

          {/* Suggestion pills */}
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
            placeholder="Ask Luna anything..."
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
  walletBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: '#ecfdf5', width: 70, alignItems: 'center' },
  walletText: { fontSize: 11, fontWeight: '700', color: '#059669' },
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
