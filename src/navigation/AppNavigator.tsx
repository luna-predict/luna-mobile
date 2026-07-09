import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import {
  Home, Calendar as CalendarIcon, PlusCircle, User, MessageCircle, HeartHandshake, ClipboardCheck,
} from 'lucide-react-native';

import OnboardingScreen from '../screens/OnboardingScreen';
import DashboardScreen from '../screens/DashboardScreen';
import CalendarScreen from '../screens/CalendarScreen';
import SymptomLoggerScreen from '../screens/SymptomLoggerScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AICoachScreen from '../screens/AICoachScreen';
import ModelsScreen from '../screens/ModelsScreen';
import WalletScreen from '../screens/WalletScreen';
import PartnerScreen from '../screens/PartnerScreen';
import PartnerDashboardScreen from '../screens/men/PartnerDashboardScreen';
import MenCheckInScreen from '../screens/men/MenCheckInScreen';

export type RootStackParamList = {
  Tabs: undefined;
  Models: undefined;
  Wallet: undefined;
  Partner: undefined;
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

function WomenTabs() {
  const { themeColors } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator screenOptions={tabScreenOptions(themeColors.primary, themeColors.card, insets.bottom)}>
      <Tab.Screen name="Dashboard" component={DashboardScreen}
        options={{ tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tab.Screen name="Calendar" component={CalendarScreen}
        options={{ tabBarIcon: ({ color, size }) => <CalendarIcon color={color} size={size} /> }} />
      <Tab.Screen name="Log" component={SymptomLoggerScreen}
        options={{
          tabBarIcon: () => <PlusCircle color={themeColors.primary} size={32} style={{ marginBottom: 4 }} />,
          tabBarLabel: () => null,
        }} />
      <Tab.Screen name="Coach" component={AICoachScreen}
        options={{ tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} /> }} />
      <Tab.Screen name="Profile" component={ProfileScreen}
        options={{ tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tab.Navigator>
  );
}

function MenTabs() {
  const { themeColors } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator screenOptions={tabScreenOptions(themeColors.primary, themeColors.card, insets.bottom)}>
      <Tab.Screen name="Partner" component={PartnerDashboardScreen}
        options={{ tabBarIcon: ({ color, size }) => <HeartHandshake color={color} size={size} /> }} />
      <Tab.Screen name="Check-In" component={MenCheckInScreen}
        options={{ tabBarIcon: ({ color, size }) => <ClipboardCheck color={color} size={size} /> }} />
      <Tab.Screen name="Coach" component={AICoachScreen}
        options={{ tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} /> }} />
      <Tab.Screen name="Profile" component={ProfileScreen}
        options={{ tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tab.Navigator>
  );
}

function tabScreenOptions(active: string, card: string, bottomInset: number) {
  return {
    headerShown: false,
    tabBarActiveTintColor: active,
    tabBarInactiveTintColor: '#94a3b8',
    tabBarStyle: {
      backgroundColor: card,
      borderTopColor: 'rgba(0,0,0,0.05)',
      elevation: 10,
      shadowOpacity: 0.1,
      shadowRadius: 20,
      height: 60 + bottomInset,
      paddingBottom: 8 + bottomInset,
      paddingTop: 8,
    },
  };
}

function Splash() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF7F8' }}>
      <Text style={{ fontSize: 52 }}>🌙</Text>
      <Text style={{ fontSize: 20, fontWeight: '800', color: '#1e293b', marginTop: 12 }}>LunaPredict</Text>
      <ActivityIndicator color="#F43F5E" style={{ marginTop: 16 }} />
    </View>
  );
}

export default function AppNavigator() {
  const { ready, user } = useApp();

  return (
    <NavigationContainer>
      {!ready ? (
        <Splash />
      ) : !user?.onboardingComplete ? (
        <OnboardingScreen />
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Tabs" component={user.sex === 'male' ? MenTabs : WomenTabs} />
          <Stack.Screen name="Models" component={ModelsScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="Wallet" component={WalletScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="Partner" component={PartnerScreen} options={{ animation: 'slide_from_right' }} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
