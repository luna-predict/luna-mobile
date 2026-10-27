import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Alert, Pressable, Linking, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { Moon, ArrowUp, Square, Volume2, Trash2, Download, Languages, Phone, Cpu } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { AppMode, ChatMessage, CoachLanguage } from '../types';
import { Store } from '../storage/Store';
import { ask, CoachRun, CoachStage } from '../ai/coach/CoachService';
import { coachEngine } from '../ai/engine';
import { ModelManager } from '../services/ModelManager';
import { PearsPartnerService } from '../services/PearsPartnerService';
import { useModelRegistryVersion } from '../ai/useModels';
import { speak, stopSpeaking } from '../ai/voice/speak';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Banner, FlagBanner, IconButton, EmptyState, space, type, radius } from '../ui';
import { MicButton } from '../ui/MicButton';
import { useToast } from '../ui/Toast';

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

const PROMPTS: Record<AppMode | 'partner', Record<CoachLanguage, string[]>> = {
  period: { en: ['Why am I so tired?', 'What helps with cramps?', 'When is my next period?', 'Why is my mood changing?'], sw: ['Kwa nini nimechoka sana?', 'Nini husaidia maumivu ya tumbo?', 'Hedhi yangu ijayo ni lini?'] },
  conceive: { en: ['When am I most fertile?', 'How do I read ovulation tests?', 'What is BBT tracking?', 'Tips to improve fertility'], sw: ['Siku zangu za rutuba ni lini?', 'Nasomaje kipimo cha ovulesheni?'] },
  pregnancy: { en: ["What's happening this week?", 'Safe exercises for me?', 'Foods to avoid?', 'When should I call my midwife?'], sw: ['Nini kinatokea wiki hii?', 'Vyakula gani niepuke?'] },
  perimenopause: { en: ['Managing hot flashes', 'Sleep better at night', 'Mood swing tips', 'Should I see a doctor?'], sw: ['Jinsi ya kudhibiti joto la ghafla', 'Kulala vizuri usiku'] },
  partner: { en: ['How can I support her today?', 'Why might she feel off?', 'Good time to plan a date?', 'Tips for my own stress'], sw: ['Nimsaidieje leo?', 'Vidokezo vya msongo wangu'] },
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

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<CoachStage | null>(null);
  const [streamText, setStreamText] = useState('');
  const [thinkingSince, setThinkingSince] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [showOriginal, setShowOriginal] = useState<Record<string, boolean>>({});
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const runRef = useRef<CoachRun | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const pendingText = useRef('');
  const flushTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastQuestionByVoice = useRef(false);

  const engineKind = coachEngine.kind();
  const activeModel = ModelManager.getActiveModel();
  const hasTranslator = !!ModelManager.getModelForRole('translator');
  const needsModel = engineKind === 'qvac' && !activeModel;

  const greeting = useCallback((): ChatMessage => (
    { id: 'greeting', role: 'assistant', content: GREETING[persona][language], status: 'done', language }
  ), [persona, language]);

  // Hydrate chat
  useEffect(() => {
    Store.getChatHistory().then(h => setMessages(h.length ? h.map(m => ({ ...m, id: m.id ?? newId() })) : [greeting()]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New persona when the goal or language changes (stop anything in flight)
  const personaKey = `${persona}:${language}`;
  const prevPersona = useRef(personaKey);
  useEffect(() => {
    if (prevPersona.current === personaKey) return;
    prevPersona.current = personaKey;
    runRef.current?.cancel();
    stopSpeaking();
    const fresh = [greeting()];
    setMessages(fresh);
    Store.saveChatHistory(fresh);
  }, [personaKey, greeting]);

  // Elapsed-time ticker while thinking
  useEffect(() => {
    if (!thinkingSince) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [thinkingSince]);

  useEffect(() => () => { runRef.current?.cancel(); stopSpeaking(); }, []);

  const persist = useCallback((msgs: ChatMessage[]) => {
    setMessages(msgs);
    Store.saveChatHistory(msgs.filter(m => m.id !== 'greeting' || msgs.length === 1));
  }, []);

  const send = useCallback(async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || busy || !user) return;
    stopSpeaking();
    const userMsg: ChatMessage = { id: newId(), role: 'user', content: text, timestamp: new Date().toISOString(), language };
    const history = messages.filter(m => m.id !== 'greeting');
    const base = [...messages, userMsg];
    persist(base);
    setInput('');
    setBusy(true);
    setStage(null);
    setStreamText('');
    pendingText.current = '';

    // Throttle streaming re-renders to ~20/s
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
      speak(final.content, final.language ?? 'en', () => setSpeakingId(null));
    }
    lastQuestionByVoice.current = false;
  }, [input, busy, user, messages, persist, isPartner, today, language, flags, cycle, pregnancy, peri, logs]);

  const stop = () => runRef.current?.cancel();

  const clearChat = () => {
    Alert.alert('Clear conversation?', 'Your chat is stored only on this phone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => persist([greeting()]) },
    ]);
  };

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
  const showSuggestions = messages.filter(m => m.role === 'user').length === 0 && !busy;
  const urgent = flags.filter(f => f.severity === 'urgent');

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const mine = item.role === 'user';
    const emergency = item.status === 'emergency';
    const original = item.original && showOriginal[item.id ?? ''];
    const text = original ? item.original! : item.content;
    return (
      <View style={[styles.bubble, mine ? [styles.mine, { backgroundColor: t.primaryStrong }] : [styles.theirs, { backgroundColor: emergency ? t.danger : t.card, borderColor: t.border }]]}>
        {!mine && (
          <View style={styles.bubbleHead}>
            <Moon color={emergency ? '#FFFFFF' : t.primaryStrong} size={14} />
            <Text style={[styles.bubbleLabel, { color: emergency ? '#FFFFFF' : t.textMuted }]}>
              {emergency ? 'Safety' : `Luna · AI${item.engine === 'demo' ? ' (demo)' : ''}`}
            </Text>
          </View>
        )}
        <Text selectable style={[styles.bubbleText, { color: mine || emergency ? '#FFFFFF' : t.text }]}>{text}</Text>
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
                <Text style={[styles.meta, { color: t.primaryStrong, fontWeight: '700' }]}>{original ? 'Show Kiswahili' : 'Machine-translated · Show English'}</Text>
              </Pressable>
            )}
            {item.status !== 'error' && item.content ? (
              <IconButton
                icon={Volume2}
                size={18}
                label={speakingId === item.id ? 'Stop reading' : 'Read aloud'}
                color={speakingId === item.id ? t.primaryStrong : t.subtext}
                onPress={() => {
                  if (speakingId === item.id) { stopSpeaking(); setSpeakingId(null); return; }
                  setSpeakingId(item.id ?? null);
                  speak(text, original ? 'en' : item.language ?? 'en', () => setSpeakingId(null));
                }}
              />
            ) : null}
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
        <Text style={[styles.bubbleText, { color: t.text }]}>{streamText}</Text>
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
        <IconButton icon={Trash2} label="Clear conversation" onPress={clearChat} color={t.textMuted} size={20} />
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

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
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
                    {PROMPTS[persona][language].map(p => (
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

        {/* Composer */}
        <View style={[styles.composer, { backgroundColor: t.card, borderTopColor: t.border }]}>
          <MicButton testID="coach-mic" language={language} onText={onVoiceText} onError={m => toast.show(m, 'error')} disabled={busy || needsModel} />
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
        <Text style={[styles.disclaimer, { color: t.subtext, backgroundColor: t.card }]}>AI guidance, not medical advice. In an emergency call 999 or 112.</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 64 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  langBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, minHeight: 40, borderRadius: radius.pill },
  bubble: { maxWidth: '88%', borderRadius: 20, padding: space.md + 2, marginBottom: space.md },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  theirs: { alignSelf: 'flex-start', borderBottomLeftRadius: 6, borderWidth: StyleSheet.hairlineWidth },
  bubbleHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  bubbleLabel: { fontSize: 12, fontWeight: '700' },
  bubbleText: { fontSize: 16, lineHeight: 23 },
  bubbleFoot: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm, marginTop: 4, marginBottom: -8 },
  meta: { fontSize: 12 },
  callBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, backgroundColor: '#FFFFFF', borderRadius: radius.pill, minHeight: 48, marginTop: space.md },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  suggestion: { paddingHorizontal: space.lg, minHeight: 40, justifyContent: 'center', borderRadius: radius.pill },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.xs, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, borderRadius: 22, borderWidth: 1, paddingHorizontal: space.lg, paddingTop: 12, paddingBottom: 12, fontSize: 16, maxHeight: 120, minHeight: 44 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  disclaimer: { fontSize: 12, textAlign: 'center', paddingBottom: space.sm, paddingTop: 2 },
});
