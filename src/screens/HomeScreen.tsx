import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Animated } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { LocalInference } from '../ai/LocalInference';
import { DelegatedInference } from '../ai/DelegatedInference';
import { WdkManager } from '../wallet/WdkManager';
import { Send, Droplet, Sparkles, Cpu, Network } from 'lucide-react-native';

const delegatedInference = new DelegatedInference();
const wdkManager = new WdkManager();
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function HomeScreen() {
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [useLocal, setUseLocal] = useState(true);

  // Mock Cycle Data matching original dashboard
  const cycleStatus = {
    cycleDay: 14,
    avgCycleLength: 28,
    phase: 'ovulatory',
    daysUntilPeriod: 14,
    daysUntilOvulation: 0,
    fertileWindow: true,
  };

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.02, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true })
      ])
    ).start();

    Animated.timing(progressAnim, {
      toValue: cycleStatus.cycleDay / cycleStatus.avgCycleLength,
      duration: 1500,
      useNativeDriver: true
    }).start();
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const newMessages = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    try {
      let responseText = '';
      if (useLocal) {
        await LocalInference.initializeModel();
        responseText = await LocalInference.generateInsight(newMessages);
      } else {
        responseText = await delegatedInference.runDelegatedInference(newMessages);
        await wdkManager.payForCompute(100, 'peer-123'); 
      }
      setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0]
  });

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header / Network Toggle */}
        <View className="px-6 py-4 flex-row justify-between items-center z-20">
          <Text className="text-2xl font-bold text-slate-800 tracking-tight">
            Luna<Text className="text-primary">Predict</Text>
          </Text>
          <TouchableOpacity 
            onPress={() => setUseLocal(!useLocal)}
            className={`p-2 rounded-full flex-row items-center gap-2 ${useLocal ? 'bg-primary/10' : 'bg-blue-500/10'}`}
          >
            {useLocal ? <Cpu size={16} color="#F43F5E" /> : <Network size={16} color="#3b82f6" />}
            <Text className={`text-xs font-bold ${useLocal ? 'text-primary' : 'text-blue-500'}`}>
              {useLocal ? 'Local AI' : 'P2P AI'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Hero Cycle Ring */}
        <View className="mx-4 mt-2 bg-card rounded-[2rem] p-6 border border-white/50" style={{ shadowColor: '#1F2687', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.07, shadowRadius: 32, elevation: 5 }}>
          <View className="flex-row justify-between items-start mb-4">
            <View>
              <Text className="text-lg font-bold text-slate-800">Today</Text>
              <Text className="text-xs text-mutedForeground uppercase tracking-widest mt-1">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
            </View>
            <View className="bg-amber-500/20 px-3 py-1.5 rounded-full shadow-sm">
              <Text className="text-amber-600 text-xs font-bold">✨ {cycleStatus.phase}</Text>
            </View>
          </View>

          <View className="items-center justify-center py-6">
            <Animated.View style={{ transform: [{ scale: pulseAnim }], alignItems: 'center', justifyContent: 'center' }}>
              {/* Outer Glow */}
              <View className="absolute w-[200px] h-[200px] rounded-full bg-amber-500/10" style={{ shadowColor: '#f59e0b', shadowOpacity: 0.3, shadowRadius: 40 }} />
              
              <Svg width="240" height="240" viewBox="0 0 240 240">
                <Defs>
                  <LinearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="#f59e0b" />
                    <Stop offset="100%" stopColor="#f59e0b" stopOpacity="0.6" />
                  </LinearGradient>
                </Defs>
                
                <Circle cx="120" cy="120" r={radius} stroke="rgba(14,14,17,0.05)" strokeWidth="12" fill="transparent" />
                <AnimatedCircle
                  cx="120"
                  cy="120"
                  r={radius}
                  stroke="url(#grad)"
                  strokeWidth="14"
                  fill="transparent"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  rotation="-90"
                  origin="120, 120"
                />
              </Svg>

              <View className="absolute items-center justify-center">
                <Text className="text-xs uppercase tracking-widest text-mutedForeground font-medium">Day</Text>
                <Text className="text-6xl font-bold text-amber-500 mt-[-4px]">{cycleStatus.cycleDay}</Text>
                <Text className="text-sm text-mutedForeground mt-[-2px]">of {cycleStatus.avgCycleLength} days</Text>
              </View>
            </Animated.View>
            
            <Text className="text-center text-mutedForeground mt-6 text-sm">Peak energy & fertility</Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View className="flex-row px-4 gap-3 mt-4">
          <View className="flex-1 bg-card border border-white/50 rounded-[1rem] p-4 flex-row items-center gap-3" style={{ shadowColor: '#1F2687', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 16 }}>
            <Droplet color="#f43f5e" size={24} />
            <View>
              <Text className="text-xl font-bold text-rose-500">{cycleStatus.daysUntilPeriod}</Text>
              <Text className="text-[10px] text-mutedForeground uppercase tracking-wider">Days to period</Text>
            </View>
          </View>
          <View className="flex-1 bg-card border border-white/50 rounded-[1rem] p-4 flex-row items-center gap-3" style={{ shadowColor: '#1F2687', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 16 }}>
            <Sparkles color="#f59e0b" size={24} />
            <View>
              <Text className="text-xl font-bold text-amber-500">High</Text>
              <Text className="text-[10px] text-mutedForeground uppercase tracking-wider">Fertility</Text>
            </View>
          </View>
        </View>

        {/* Chat Interface Integrated Below Dashboard */}
        {messages.length > 0 && (
          <View className="px-4 mt-8">
            <Text className="text-slate-500 font-bold uppercase tracking-wider text-xs mb-4 ml-2">Luna AI Coach</Text>
            {messages.filter(m => m.role !== 'system').map((msg, index) => (
              <View 
                key={index} 
                className={`mb-4 max-w-[85%] rounded-2xl p-4 shadow-sm ${
                  msg.role === 'user' 
                    ? 'self-end bg-primary rounded-tr-sm' 
                    : 'self-start bg-card rounded-tl-sm border border-white/50'
                }`}
              >
                <Text className={`text-base leading-6 ${msg.role === 'user' ? 'text-white' : 'text-slate-700'}`}>{msg.content}</Text>
              </View>
            ))}
            {isTyping && (
              <View className="self-start bg-card rounded-2xl p-4 rounded-tl-sm border border-white/50 shadow-sm">
                <ActivityIndicator color="#F43F5E" size="small" />
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Floating Input Field */}
      <View className="absolute bottom-6 left-4 right-4 flex-row items-center bg-card rounded-full p-2 border border-white/50" style={{ shadowColor: '#1F2687', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 30, elevation: 10 }}>
        <TextInput
          className="flex-1 text-slate-800 rounded-full px-4 py-3 mr-2 font-medium"
          placeholder="Ask Luna or log a symptom..."
          placeholderTextColor="#94a3b8"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity 
          onPress={sendMessage}
          disabled={!input.trim() || isTyping}
          className={`h-12 w-12 rounded-full items-center justify-center ${
            input.trim() && !isTyping ? 'bg-primary' : 'bg-slate-200'
          }`}
        >
          <Send size={20} color={input.trim() && !isTyping ? "white" : "#94a3b8"} className="ml-1" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
