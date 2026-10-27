import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { createBottomTabNavigator, BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer, NavigatorScreenParams } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, CalendarDays, PlusCircle, User, MessageCircle, HeartHandshake, ClipboardCheck, Moon } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { LogDay } from '../types';

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

export type WomenTabParamList = {
  Today: undefined;
  Calendar: undefined;
  Log: { day?: LogDay; periodStart?: boolean } | undefined;
  Coach: undefined;
  Profile: undefined;
};

export type MenTabParamList = {
  Partner: undefined;
  'Check-In': undefined;
  Coach: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<WomenTabParamList> | NavigatorScreenParams<MenTabParamList> | undefined;
  Models: undefined;
  Wallet: undefined;
  Partner: undefined;
  LogDay: { day: LogDay; periodStart?: boolean };
};

const WomenTab = createBottomTabNavigator<WomenTabParamList>();
const MenTab = createBottomTabNavigator<MenTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function tabOptions(active: string, card: string, border: string, bottomInset: number): BottomTabNavigationOptions {
  return {
    headerShown: false,
    tabBarHideOnKeyboard: true,
    tabBarActiveTintColor: active,
    tabBarInactiveTintColor: '#64748B',
    tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
    tabBarStyle: {
      backgroundColor: card,
      borderTopColor: border,
      height: 64 + bottomInset,
      paddingBottom: 8 + bottomInset,
      paddingTop: 8,
    },
  };
}

function WomenTabs() {
  const { themeColors: t } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <WomenTab.Navigator screenOptions={tabOptions(t.primaryStrong, t.card, t.border, insets.bottom)}>
      <WomenTab.Screen name="Today" component={DashboardScreen}
        options={{ tabBarIcon: ({ color, size }) => <Home color={color} size={size} />, tabBarButtonTestID: 'tab-today' }} />
      <WomenTab.Screen name="Calendar" component={CalendarScreen}
        options={{ tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} />, tabBarButtonTestID: 'tab-calendar' }} />
      <WomenTab.Screen name="Log" component={SymptomLoggerScreen}
        options={{
          tabBarIcon: () => <PlusCircle color={t.primaryStrong} size={34} />,
          tabBarLabel: 'Log',
          tabBarAccessibilityLabel: 'Log today',
          tabBarButtonTestID: 'tab-log',
        }} />
      <WomenTab.Screen name="Coach" component={AICoachScreen}
        options={{ tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />, tabBarLabel: 'Luna', tabBarButtonTestID: 'tab-coach' }} />
      <WomenTab.Screen name="Profile" component={ProfileScreen}
        options={{ tabBarIcon: ({ color, size }) => <User color={color} size={size} />, tabBarButtonTestID: 'tab-profile' }} />
    </WomenTab.Navigator>
  );
}

function MenTabs() {
  const { themeColors: t } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <MenTab.Navigator screenOptions={tabOptions(t.primaryStrong, t.card, t.border, insets.bottom)}>
      <MenTab.Screen name="Partner" component={PartnerDashboardScreen}
        options={{ tabBarIcon: ({ color, size }) => <HeartHandshake color={color} size={size} />, tabBarButtonTestID: 'tab-partner' }} />
      <MenTab.Screen name="Check-In" component={MenCheckInScreen}
        options={{ tabBarIcon: ({ color, size }) => <ClipboardCheck color={color} size={size} />, tabBarButtonTestID: 'tab-checkin' }} />
      <MenTab.Screen name="Coach" component={AICoachScreen}
        options={{ tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />, tabBarLabel: 'Luna', tabBarButtonTestID: 'tab-coach' }} />
      <MenTab.Screen name="Profile" component={ProfileScreen}
        options={{ tabBarIcon: ({ color, size }) => <User color={color} size={size} />, tabBarButtonTestID: 'tab-profile' }} />
    </MenTab.Navigator>
  );
}

function Splash() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF7F8' }} accessibilityLabel="LunaPredict is loading">
      <Moon color="#BE123C" size={48} />
      <Text style={{ fontSize: 22, fontWeight: '800', color: '#0F172A', marginTop: 12 }}>LunaPredict</Text>
      <ActivityIndicator color="#BE123C" style={{ marginTop: 16 }} />
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
          <Stack.Screen name="LogDay" component={SymptomLoggerScreen} options={{ animation: 'slide_from_bottom' }} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
