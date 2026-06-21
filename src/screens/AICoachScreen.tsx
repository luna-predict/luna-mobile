import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { useMode } from '../context/ModeContext';
import { LocalInference } from '../ai/LocalInference';
import { DelegatedInference } from '../ai/DelegatedInference';
import { WdkManager } from '../wallet/WdkManager';
import { Send, Cpu, Network, Wallet } from 'lucide-react-native';

const delegatedInference = new DelegatedInference();
const wdkManager = new WdkManager();

export default function AICoachScreen() {
  const { themeColors } = useMode();
  const [messages, setMessages] = useState<{role: string, content: string}[]>([
    { role: 'system', content: 'You are Luna, a highly intelligent and private health coach.' },
    { role: 'assistant', content: "Hi! I'm Luna. How can I support your health journey today?" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [useLocal, setUseLocal] = useState(true);

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      {/* Header */}
      <View className="px-6 py-4 flex-row justify-between items-center z-20 border-b border-slate-200/50" style={{ backgroundColor: themeColors.card }}>
        <Text className="text-xl font-bold text-slate-800 tracking-tight">
          Luna <Text style={{ color: themeColors.primary }}>AI Coach</Text>
        </Text>
        <View className="flex-row gap-3">
          <TouchableOpacity 
            onPress={() => setUseLocal(!useLocal)}
            className={`p-2 rounded-full flex-row items-center gap-2 ${useLocal ? 'bg-slate-100' : 'bg-blue-500/10'}`}
          >
            {useLocal ? <Cpu size={16} color={themeColors.primary} /> : <Network size={16} color="#3b82f6" />}
          </TouchableOpacity>
          <TouchableOpacity className="p-2 rounded-full bg-slate-100 flex-row items-center gap-2">
            <Wallet size={16} color="#10b981" />
            <Text className="text-xs font-bold text-emerald-600">5.00</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: 20 }}>
        {messages.filter(m => m.role !== 'system').map((msg, index) => (
          <View 
            key={index} 
            className={`mb-4 max-w-[85%] rounded-2xl p-4 shadow-sm ${
              msg.role === 'user' 
                ? 'self-end rounded-tr-sm' 
                : 'self-start rounded-tl-sm border border-slate-200/50'
            }`}
            style={{ backgroundColor: msg.role === 'user' ? themeColors.primary : themeColors.card }}
          >
            <Text className={`text-base leading-6 ${msg.role === 'user' ? 'text-white' : 'text-slate-700'}`}>
              {msg.content}
            </Text>
          </View>
        ))}
        {isTyping && (
          <View className="self-start rounded-2xl p-4 rounded-tl-sm border border-slate-200/50 shadow-sm" style={{ backgroundColor: themeColors.card }}>
            <ActivityIndicator color={themeColors.primary} size="small" />
          </View>
        )}
      </ScrollView>

      {/* Input Field */}
      <View className="px-4 py-4 border-t border-slate-200/50 flex-row items-center" style={{ backgroundColor: themeColors.card }}>
        <TextInput
          className="flex-1 text-slate-800 rounded-full px-5 py-3.5 mr-3 border border-slate-200 bg-slate-50"
          placeholder="Ask Luna anything..."
          placeholderTextColor="#94a3b8"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity 
          onPress={sendMessage}
          disabled={!input.trim() || isTyping}
          className={`h-12 w-12 rounded-full items-center justify-center`}
          style={{ backgroundColor: input.trim() && !isTyping ? themeColors.primary : '#e2e8f0' }}
        >
          <Send size={20} color={input.trim() && !isTyping ? "white" : "#94a3b8"} className="ml-1" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
