import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Alert, Pressable, Linking, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import {
  Moon, ArrowUp, Square, Volume2, Trash2, Download, Languages, Phone, Cpu,
  History, Plus, Play, Pause, Copy, MessageSquare, Sparkles, Check,
} from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { AppMode, ChatMessage, ChatSession, CoachLanguage } from '../types';
import { Store } from '../storage/Store';
import { ask, CoachRun, CoachStage } from '../ai/coach/CoachService';
import { coachEngine } from '../ai/engine';
import { ModelManager } from '../services/ModelManager';
import { PearsPartnerService } from '../services/PearsPartnerService';
import { useModelRegistryVersion } from '../ai/useModels';
import { speak, pauseSpeaking, resumeSpeaking, stopSpeaking } from '../ai/voice/speak';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Banner, FlagBanner, IconButton, EmptyState, Sheet, FormattedMessage, space, type, radius } from '../ui';
import { MicButton } from '../ui/MicButton';
import { useToast } from '../ui/Toast';
import { formatDay } from '../domain';

const GREETING: Record<AppMode | 'partner', Record<CoachLanguage, string>> = {
  period: {
    en: "Hi, I'm Luna — your private cycle companion. Everything we discuss stays on this phone. What's on your mind?",
    sw: 'Habari, mimi ni Luna — msaidizi wako wa siri wa mzunguko wa hedhi. Tunachozungumza kinabaki kwenye simu hii. Nikusaidie nini?',
  },
  conceive: {
    en: "Hi, I'm Luna — your fertility guide. I can explain your fertile window, ovulation tests and temperature charts.",
    sw: 'Habari, mimi ni Luna — mwongozo wako wa uzazi. Naweza kueleza siku zako za rutuba na vipimo vya ovulesheni.',
  },
  pregnancy: {
    en: "Hello! I'm Luna. Ask me about this week of your pregnancy, symptoms, or when to call your midwife.",
    sw: 'Habari! Mimi ni Luna. Niulize kuhusu wiki hii ya ujauzito wako, dalili, au wakati wa kumpigia mkunga.',
  },
  perimenopause: {
    en: "Hi, I'm Luna. I'm here to help with hot flashes, sleep, mood and the changes of this transition.",
    sw: 'Habari, mimi ni Luna. Niko hapa kukusaidia na joto la ghafla, usingizi, hisia na mabadiliko haya.',
  },
  partner: {
    en: "Hey, I'm Luna. I help you understand and support your partner — I only see what she chooses to share.",
    sw: 'Habari, mimi ni Luna. Nakusaidia kumwelewa na kumsaidia mwenzako — naona tu kile anachochagua kushiriki.',
  },
};

const BASE_PROMPTS: Record<AppMode | 'partner', Record<CoachLanguage, string[]>> = {
  period: {
    en: ['Why am I so tired?', 'What helps with cramps?', 'When is my next period?', 'Why is my mood changing?'],
    sw: ['Kwa nini nimechoka sana?', 'Nini husaidia maumivu ya tumbo?', 'Hedhi yangu ijayo ni lini?'],
  },
  conceive: {
    en: ['When am I most fertile?', 'How do I read ovulation tests?', 'What is BBT tracking?', 'Tips to improve fertility'],
    sw: ['Siku zangu za rutuba ni lini?', 'Nasomaje kipimo cha ovulesheni?'],
  },
  pregnancy: {
    en: ["What's happening this week?", 'Safe exercises for me?', 'Foods to avoid?', 'When should I call my midwife?'],
    sw: ['Nini kinatokea wiki hii?', 'Vyakula gani niepuke?'],
  },
  perimenopause: {
    en: ['Managing hot flashes', 'Sleep better at night', 'Mood swing tips', 'Should I see a doctor?'],
    sw: ['Jinsi ya kudhibiti joto la ghafla', 'Kulala vizuri usiku'],
  },
  partner: {
    en: ['How can I support her today?', 'Why might she feel off?', 'Good time to plan a date?', 'Tips for my own stress'],
    sw: ['Nimsaidieje leo?', 'Vidokezo vya msongo wangu'],
  },
};

const STAGE_TEXT: Record<CoachStage, string> = {
  translating_in: 'Translating your question…',
  loading: 'Loading the model into memory (first message only)…',
  thinking: 'Thinking',
  answering: '',
  translating_out: 'Translating the answer…',
};

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export default function AICoachScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const toast = useToast();
  const app = useApp();
  const { themeColors: t, currentMode, user, cycle, pregnancy, peri, logs, flags, today, updateUser } = app;
  const isPartner = user?.sex === 'male';
  const persona: AppMode | 'partner' = isPartner ? 'partner' : currentMode;
  const language: CoachLanguage = user?.language ?? 'en';
  useModelRegistryVersion();

  // Multi-chat sessions state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('default-session');
  const [showHistorySheet, setShowHistorySheet] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<CoachStage | null>(null);
  const [streamText, setStreamText] = useState('');
  const [thinkingSince, setThinkingSince] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [showOriginal, setShowOriginal] = useState<Record<string, boolean>>({});

  // Voice output playback state
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [isSpeakingPaused, setIsSpeakingPaused] = useState(false);

  const runRef = useRef<CoachRun | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const pendingText = useRef('');
  const flushTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastQuestionByVoice = useRef(false);

  const engineKind = coachEngine.kind();
  const activeModel = ModelManager.getActiveModel();
  const hasTranslator = !!ModelManager.getModelForRole('translator');
  const needsModel = engineKind === 'qvac' && !activeModel;

  const greeting = useCallback((): ChatMessage => ({
    id: 'greeting',
    role: 'assistant',
    content: GREETING[persona][language],
    status: 'done',
    language,
  }), [persona, language]);

  // Initial load of chat sessions
  useEffect(() => {
    Store.getChatSessions().then(loadedSessions => {
      if (loadedSessions.length > 0) {
        setSessions(loadedSessions);
        const current = loadedSessions[0];
        setActiveSessionId(current.id);
        setMessages(current.messages.length ? current.messages : [greeting()]);
      } else {
        const initialSession: ChatSession = {
          id: newId(),
          title: 'New conversation',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          mode: persona,
          language,
          messages: [greeting()],
        };
        setSessions([initialSession]);
        setActiveSessionId(initialSession.id);
        setMessages([greeting()]);
        Store.saveChatSession(initialSession);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mode or language change
  const personaKey = `${persona}:${language}`;
  const prevPersona = useRef(personaKey);
  useEffect(() => {
    if (prevPersona.current === personaKey) return;
    prevPersona.current = personaKey;
    runRef.current?.cancel();
    stopSpeaking();
    setSpeakingId(null);
    setIsSpeakingPaused(false);

    // Start fresh conversation for the new mode
    const newSession: ChatSession = {
      id: newId(),
      title: `${persona.charAt(0).toUpperCase() + persona.slice(1)} chat`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      mode: persona,
      language,
      messages: [greeting()],
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setMessages([greeting()]);
    Store.saveChatSession(newSession);
  }, [personaKey, greeting, persona, language]);

  // Thinking timer
  useEffect(() => {
    if (!thinkingSince) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [thinkingSince]);

  useEffect(() => () => { runRef.current?.cancel(); stopSpeaking(); }, []);

  // Save active messages into active session
  const persist = useCallback((msgs: ChatMessage[], newTitle?: string) => {
    setMessages(msgs);
    setSessions(prevSessions => {
      const existing = prevSessions.find(s => s.id === activeSessionId);
      const updated: ChatSession = {
        id: activeSessionId,
        title: newTitle ?? existing?.title ?? 'Conversation',
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        mode: persona,
        language,
        messages: msgs.filter(m => m.id !== 'greeting' || msgs.length === 1),
      };
      Store.saveChatSession(updated);
      return [updated, ...prevSessions.filter(s => s.id !== activeSessionId)];
    });
  }, [activeSessionId, persona, language]);

  // Start new chat thread
  const startNewChat = useCallback(() => {
    runRef.current?.cancel();
    stopSpeaking();
    setSpeakingId(null);
    setIsSpeakingPaused(false);

    const freshSession: ChatSession = {
      id: newId(),
      title: 'New conversation',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      mode: persona,
      language,
      messages: [greeting()],
    };
    setSessions(prev => [freshSession, ...prev]);
    setActiveSessionId(freshSession.id);
    setMessages([greeting()]);
    Store.saveChatSession(freshSession);
    setShowHistorySheet(false);
    toast.show('Started a new conversation');
  }, [persona, language, greeting, toast]);

  // Switch to past chat thread
  const selectSession = useCallback((session: ChatSession) => {
    if (session.id === activeSessionId) {
      setShowHistorySheet(false);
      return;
    }
    runRef.current?.cancel();
    stopSpeaking();
    setSpeakingId(null);
    setIsSpeakingPaused(false);

    setActiveSessionId(session.id);
    setMessages(session.messages.length ? session.messages : [greeting()]);
    setShowHistorySheet(false);
  }, [activeSessionId, greeting]);

  // Delete chat thread
  const deleteSession = useCallback((id: string) => {
    Alert.alert('Delete conversation?', 'This conversation will be permanently removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = await Store.deleteChatSession(id);
          setSessions(updated);
          if (activeSessionId === id) {
            if (updated.length > 0) {
              setActiveSessionId(updated[0].id);
              setMessages(updated[0].messages);
            } else {
              startNewChat();
            }
          }
          toast.show('Conversation deleted');
        },
      },
    ]);
  }, [activeSessionId, startNewChat, toast]);

  // ── Send message ──
  const send = useCallback(async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || busy || !user) return;
    stopSpeaking();
    setSpeakingId(null);
    setIsSpeakingPaused(false);

    const userMsg: ChatMessage = { id: newId(), role: 'user', content: text, timestamp: new Date().toISOString(), language };
    const history = messages.filter(m => m.id !== 'greeting');
    const base = [...messages, userMsg];

    // Auto-generate title from first user message if title is generic
    const isFirstUserTurn = history.filter(m => m.role === 'user').length === 0;
    const derivedTitle = isFirstUserTurn ? text.slice(0, 36) + (text.length > 36 ? '…' : '') : undefined;

    persist(base, derivedTitle);
    setInput('');
    setBusy(true);
    setStage(null);
    setStreamText('');
    pendingText.current = '';

    flushTimer.current = setInterval(() => setStreamText(pendingText.current), 50);

    const partnerData = isPartner
      ? { snapshot: await PearsPartnerService.fetchSnapshot(), checkIns: await Store.getMenCheckIns(), today }
      : undefined;

    const run = ask({
      question: text,
      language,
      history,
      flags,
      userName: user.name,
      woman: isPartner ? undefined : { user, today, cycle, pregnancy, peri, flags, logs },
      partner: partnerData,
    }, {
      onStage: s => {
        setStage(s);
        setThinkingSince(s === 'thinking' ? Date.now() : null);
      },
      onText: full => { pendingText.current = full; },
    });
    runRef.current = run;
    const reply = await run.done;
    runRef.current = null;
    if (flushTimer.current) clearInterval(flushTimer.current);
    setBusy(false);
    setStage(null);
    setThinkingSince(null);
    setStreamText('');

    const final = reply.status === 'stopped' && !reply.content.trim()
      ? { ...reply, content: pendingText.current || '(stopped)' }
      : reply;
    persist([...base, final]);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));

    if (lastQuestionByVoice.current && user.voiceOutput === 'system' && final.content && final.status !== 'error') {
      setSpeakingId(final.id ?? null);
      setIsSpeakingPaused(false);
      speak(final.content, final.language ?? 'en', () => {
        setSpeakingId(null);
        setIsSpeakingPaused(false);
      });
    }
    lastQuestionByVoice.current = false;
  }, [input, busy, user, messages, persist, isPartner, today, language, flags, cycle, pregnancy, peri, logs]);

  const stop = () => runRef.current?.cancel();

  // Voice output playback handlers
  const handleToggleSpeak = useCallback((item: ChatMessage, text: string) => {
    if (speakingId === item.id) {
      if (isSpeakingPaused) {
        resumeSpeaking();
        setIsSpeakingPaused(false);
      } else {
        pauseSpeaking();
        setIsSpeakingPaused(true);
      }
    } else {
      stopSpeaking();
      setSpeakingId(item.id ?? null);
      setIsSpeakingPaused(false);
      speak(text, item.language ?? 'en', () => {
        setSpeakingId(null);
        setIsSpeakingPaused(false);
      });
    }
  }, [speakingId, isSpeakingPaused]);

  const handleStopSpeak = useCallback(() => {
    stopSpeaking();
    setSpeakingId(null);
    setIsSpeakingPaused(false);
  }, []);

  const handleCopy = useCallback(async (content: string) => {
    await Clipboard.setStringAsync(content);
    toast.show('Copied to clipboard', 'info');
  }, [toast]);

  const toggleLanguage = async () => {
    const next: CoachLanguage = language === 'en' ? 'sw' : 'en';
    await updateUser({ language: next });
    if (next === 'sw' && engineKind === 'qvac' && !hasTranslator) {
      toast.show('Download the Kiswahili pack on AI Models to chat in Kiswahili', 'info');
    }
  };

  const onVoiceText = useCallback((text: string) => {
    lastQuestionByVoice.current = true;
    setInput(text);
  }, []);

  const subtitle = engineKind === 'demo'
    ? 'Demo mode · template answers'
    : activeModel ? `${activeModel.name} · on-device, offline` : 'No model downloaded';

  // Dynamic suggestions tailored to current cycle phase
  const suggestions = useMemo(() => {
    if (persona === 'period' && cycle && language === 'en') {
      if (cycle.phase === 'menstrual') return ['What helps with cramps?', 'Why am I so tired on my period?', 'Iron-rich foods for bleeding days'];
      if (cycle.phase === 'follicular') return ['Why do I feel so energetic?', 'Best workouts for follicular phase', 'Nutrition tips'];
      if (cycle.phase === 'ovulatory') return ['Am I ovulating now?', 'Signs of peak fertility', 'Ovulation spotting causes'];
      if (cycle.phase === 'luteal') return ['Why do I have sugar cravings?', 'Tips for PMS mood changes', 'Progesterone sleep tips'];
    }
    return BASE_PROMPTS[persona][language];
  }, [persona, cycle, language]);

  const showSuggestions = messages.filter(m => m.role === 'user').length === 0 && !busy;
  const urgent = flags.filter(f => f.severity === 'urgent');

  // Render individual message bubble
  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const mine = item.role === 'user';
    const emergency = item.status === 'emergency';
    const original = item.original && showOriginal[item.id ?? ''];
    const text = original ? item.original! : item.content;
    const isThisSpeaking = speakingId === item.id;

    return (
      <View
        style={[
          styles.bubble,
          mine
            ? [styles.mine, { backgroundColor: t.primaryStrong }]
            : [styles.theirs, { backgroundColor: emergency ? t.danger : t.card, borderColor: t.border }],
        ]}
      >
        {!mine && (
          <View style={styles.bubbleHead}>
            <Moon color={emergency ? '#FFFFFF' : t.primaryStrong} size={14} />
            <Text style={[styles.bubbleLabel, { color: emergency ? '#FFFFFF' : t.textMuted }]}>
              {emergency ? 'Safety' : `Luna · AI${item.engine === 'demo' ? ' (demo)' : ''}`}
            </Text>
          </View>
        )}

        {/* Rich markdown formatting for assistant, selectable text for user */}
        {mine ? (
          <Text selectable style={[styles.bubbleText, { color: '#FFFFFF' }]}>{text}</Text>
        ) : (
          <FormattedMessage content={text} color={emergency ? '#FFFFFF' : t.text} selectable />
        )}

        {emergency && (
          <Pressable onPress={() => Linking.openURL('tel:999')} accessibilityRole="button" accessibilityLabel="Call 999 now" style={styles.callBtn}>
            <Phone color={t.danger} size={18} />
            <Text style={{ color: t.danger, fontWeight: '800', fontSize: 16 }}>Call 999</Text>
          </Pressable>
        )}

        {!mine && !emergency && item.id !== 'greeting' && (
          <View style={styles.bubbleFoot}>
            {item.status === 'stopped' && <Text style={[styles.meta, { color: t.subtext }]}>Stopped</Text>}
            {item.status === 'cut_short' && <Text style={[styles.meta, { color: t.warning }]}>Cut short</Text>}
            {item.original && (
              <Pressable onPress={() => setShowOriginal(s => ({ ...s, [item.id!]: !s[item.id!] }))} accessibilityRole="button" hitSlop={8}>
                <Text style={[styles.meta, { color: t.primaryStrong, fontWeight: '700' }]}>
                  {original ? 'Show Kiswahili' : 'Machine-translated · Show English'}
                </Text>
              </Pressable>
            )}

            {/* Copy button */}
            {item.content && (
              <IconButton
                icon={Copy}
                size={16}
                label="Copy message"
                color={t.subtext}
                onPress={() => handleCopy(text)}
              />
            )}

            {/* TTS Audio Controls: Play, Pause, Resume, Stop */}
            {item.status !== 'error' && item.content && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <IconButton
                  icon={isThisSpeaking ? (isSpeakingPaused ? Play : Pause) : Volume2}
                  size={18}
                  label={isThisSpeaking ? (isSpeakingPaused ? 'Resume reading' : 'Pause reading') : 'Read aloud'}
                  color={isThisSpeaking ? t.primaryStrong : t.subtext}
                  onPress={() => handleToggleSpeak(item, text)}
                />
                {isThisSpeaking && (
                  <IconButton
                    icon={Square}
                    size={14}
                    label="Stop reading"
                    color={t.danger}
                    onPress={handleStopSpeak}
                  />
                )}
              </View>
            )}

            {item.tokensPerSecond ? <Text style={[styles.meta, { color: t.subtext }]}>{item.tokensPerSecond.toFixed(1)} tok/s</Text> : null}
          </View>
        )}
      </View>
    );
  };

  const streamingBubble = busy ? (
    <View style={[styles.bubble, styles.theirs, { backgroundColor: t.card, borderColor: t.border }]} accessibilityLiveRegion="polite">
      <View style={styles.bubbleHead}>
        <Moon color={t.primaryStrong} size={14} />
        <Text style={[styles.bubbleLabel, { color: t.textMuted }]}>Luna · AI</Text>
      </View>
      {streamText ? (
        <FormattedMessage content={streamText} color={t.text} selectable />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }} testID="coach-thinking">
          <ActivityIndicator color={t.primaryStrong} size="small" />
          <Text style={{ color: t.textMuted }}>
            {stage === 'thinking' && thinkingSince ? `Thinking… ${Math.max(1, Math.round((now - thinkingSince) / 1000))} s` : stage ? STAGE_TEXT[stage] || 'Writing…' : 'Starting…'}
          </Text>
        </View>
      )}
      {stage === 'translating_out' && streamText ? <Text style={[styles.meta, { color: t.subtext, marginTop: 4 }]}>Translating…</Text> : null}
    </View>
  ) : null;

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: t.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: t.card, borderBottomColor: t.border }]}>
        <View style={[styles.avatar, { backgroundColor: t.tint }]}><Moon color={t.primaryStrong} size={20} /></View>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={{ ...type.heading, color: t.text }}>Luna</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Cpu color={engineKind === 'demo' ? t.warning : t.success} size={12} />
            <Text style={{ fontSize: 12, color: engineKind === 'demo' ? t.warning : t.textMuted }} numberOfLines={1}>{subtitle}</Text>
          </View>
        </View>

        {/* History / Multi-chat button */}
        <IconButton
          icon={History}
          label="Past conversations"
          onPress={() => setShowHistorySheet(true)}
          color={t.text}
          size={20}
        />

        {/* Language switch */}
        <Pressable
          testID="coach-language"
          onPress={toggleLanguage}
          accessibilityRole="button"
          accessibilityLabel={`Reply language: ${language === 'en' ? 'English' : 'Kiswahili'}. Tap to switch`}
          style={[styles.langBtn, { backgroundColor: t.tint }]}
        >
          <Languages color={t.primaryStrong} size={16} />
          <Text style={{ ...type.label, color: t.primaryStrong }}>{language === 'en' ? 'EN' : 'SW'}</Text>
        </Pressable>

        {/* New Chat quick button */}
        <IconButton
          icon={Plus}
          label="New chat"
          onPress={startNewChat}
          color={t.primaryStrong}
          size={20}
        />
      </View>

      {engineKind === 'demo' && (
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
          <Banner severity="warn" title="Demo mode" body="You're in Expo Go, so answers come from templates. Install the LunaPredict build to run QVAC MedPsy on this phone." />
        </View>
      )}
      {language === 'sw' && engineKind === 'qvac' && !hasTranslator && (
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
          <Banner severity="info" title="Kiswahili pack needed" body="Download it once (641 MB) to chat in Kiswahili offline."
            actions={[{ label: 'Open AI Models', onPress: () => navigation.navigate('Models') }]} />
        </View>
      )}
      {urgent.length > 0 && (
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>{urgent.map(f => <FlagBanner key={f.id} flag={f} />)}</View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {needsModel ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState
              icon={Download}
              title="Download Luna's brain once"
              body="MedPsy 1.7B (1.3 GB) runs entirely on this phone — your questions never leave it, and it works offline. Wi-Fi recommended."
              action={{ label: 'Open AI Models', onPress: () => navigation.navigate('Models'), testID: 'coach-open-models' }}
            />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={m => m.id ?? m.timestamp ?? m.content.slice(0, 20)}
            renderItem={renderMessage}
            contentContainerStyle={{ padding: space.lg, paddingBottom: space.sm }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={
              <>
                {streamingBubble}
                {showSuggestions && (
                  <View style={styles.suggestions}>
                    {suggestions.map(p => (
                      <Pressable key={p} onPress={() => send(p)} accessibilityRole="button" style={[styles.suggestion, { backgroundColor: t.tint }]}>
                        <Text style={{ ...type.label, color: t.primaryStrong }}>{p}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            }
          />
        )}

        {/* Composer with rich Voice & Input Controls */}
        <View style={[styles.composer, { backgroundColor: t.card, borderTopColor: t.border }]}>
          <MicButton
            testID="coach-mic"
            language={language}
            onText={onVoiceText}
            onError={m => toast.show(m, 'error')}
            disabled={busy || needsModel}
          />
          <TextInput
            testID="coach-input"
            style={[styles.input, { backgroundColor: t.surface, color: t.text, borderColor: t.border }]}
            placeholder={language === 'sw' ? 'Muulize Luna chochote…' : 'Ask Luna anything…'}
            placeholderTextColor={t.subtext}
            value={input}
            onChangeText={v => { setInput(v); if (!v) lastQuestionByVoice.current = false; }}
            multiline
            maxLength={800}
            editable={!needsModel}
            accessibilityLabel="Message to Luna"
          />
          {busy ? (
            <Pressable testID="coach-stop" onPress={stop} accessibilityRole="button" accessibilityLabel="Stop generating" style={[styles.sendBtn, { backgroundColor: t.text }]}>
              <Square color="#FFFFFF" size={16} fill="#FFFFFF" />
            </Pressable>
          ) : (
            <Pressable
              testID="coach-send"
              onPress={() => send()}
              disabled={!input.trim() || needsModel}
              accessibilityRole="button"
              accessibilityLabel="Send"
              accessibilityState={{ disabled: !input.trim() || needsModel }}
              style={[styles.sendBtn, { backgroundColor: input.trim() && !needsModel ? t.primaryStrong : t.border }]}
            >
              <ArrowUp color={input.trim() && !needsModel ? '#FFFFFF' : t.subtext} size={22} />
            </Pressable>
          )}
        </View>
        <Text style={[styles.disclaimer, { color: t.subtext, backgroundColor: t.card }]}>
          AI guidance, not medical advice. In an emergency call 999 or 112.
        </Text>
      </KeyboardAvoidingView>

      {/* ── Chat History & Multi-Session Sheet ── */}
      <Sheet
        visible={showHistorySheet}
        title="Conversations"
        subtitle="Browse your chat history or start a fresh topic"
        onClose={() => setShowHistorySheet(false)}
      >
        <View style={{ gap: space.md, paddingVertical: space.sm }}>
          {/* New Chat Button */}
          <Pressable
            onPress={startNewChat}
            style={[styles.newChatBanner, { backgroundColor: t.tint, borderColor: t.primary }]}
          >
            <Plus color={t.primaryStrong} size={20} />
            <Text style={{ fontWeight: '700', fontSize: 16, color: t.primaryStrong }}>Start a new conversation</Text>
          </Pressable>

          {/* Past Sessions List */}
          <View style={{ gap: space.sm }}>
            {sessions.map(s => {
              const isSelected = s.id === activeSessionId;
              const dateStr = formatDay(s.updatedAt.slice(0, 10));
              const count = s.messages.filter(m => m.role === 'user').length;

              return (
                <View
                  key={s.id}
                  style={[
                    styles.sessionItem,
                    {
                      backgroundColor: isSelected ? t.surface : t.card,
                      borderColor: isSelected ? t.primaryStrong : t.border,
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                >
                  <Pressable
                    onPress={() => selectSession(s)}
                    style={{ flex: 1, paddingVertical: space.sm, paddingLeft: space.md }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <MessageSquare color={isSelected ? t.primaryStrong : t.textMuted} size={16} />
                      <Text style={{ fontWeight: '700', fontSize: 15, color: t.text }} numberOfLines={1}>
                        {s.title}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>
                      {dateStr} · {count} {count === 1 ? 'question' : 'questions'} · {s.mode}
                    </Text>
                  </Pressable>

                  {sessions.length > 1 && (
                    <IconButton
                      icon={Trash2}
                      label="Delete conversation"
                      color={t.textMuted}
                      size={18}
                      onPress={() => deleteSession(s.id)}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 64,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  langBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, minHeight: 36, borderRadius: radius.pill },
  bubble: { maxWidth: '88%', borderRadius: 20, padding: space.md + 2, marginBottom: space.md },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  theirs: { alignSelf: 'flex-start', borderBottomLeftRadius: 6, borderWidth: StyleSheet.hairlineWidth },
  bubbleHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  bubbleLabel: { fontSize: 12, fontWeight: '700' },
  bubbleText: { fontSize: 16, lineHeight: 23 },
  bubbleFoot: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm, marginTop: 6, marginBottom: -4 },
  meta: { fontSize: 12 },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.pill,
    minHeight: 48,
    marginTop: space.md,
  },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  suggestion: { paddingHorizontal: space.lg, minHeight: 40, justifyContent: 'center', borderRadius: radius.pill },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
    maxHeight: 120,
    minHeight: 44,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  disclaimer: { fontSize: 12, textAlign: 'center', paddingBottom: space.sm, paddingTop: 2 },
  newChatBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    paddingRight: space.xs,
  },
});
