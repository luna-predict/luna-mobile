import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { useMode } from '../context/ModeContext';
import { Home, Calendar as CalendarIcon, PlusCircle, User, MessageCircle } from 'lucide-react-native';

// Screen Imports
import DashboardScreen from '../screens/DashboardScreen';
import CalendarScreen from '../screens/CalendarScreen';
import SymptomLoggerScreen from '../screens/SymptomLoggerScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AICoachScreen from '../screens/AICoachScreen';

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  const { themeColors } = useMode();

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: themeColors.primary,
          tabBarInactiveTintColor: '#94a3b8',
          tabBarStyle: {
            backgroundColor: themeColors.card,
            borderTopColor: 'rgba(0,0,0,0.05)',
            elevation: 10,
            shadowOpacity: 0.1,
            shadowRadius: 20,
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
          },
        }}
      >
        <Tab.Screen 
          name="Dashboard" 
          component={DashboardScreen} 
          options={{
            tabBarIcon: ({ color, size }) => <Home color={color} size={size} />
          }}
        />
        <Tab.Screen 
          name="Calendar" 
          component={CalendarScreen} 
          options={{
            tabBarIcon: ({ color, size }) => <CalendarIcon color={color} size={size} />
          }}
        />
        <Tab.Screen 
          name="Log" 
          component={SymptomLoggerScreen} 
          options={{
            tabBarIcon: ({ color }) => (
              <PlusCircle color={themeColors.primary} size={32} style={{ marginBottom: 4 }} />
            ),
            tabBarLabel: () => null,
          }}
        />
        <Tab.Screen 
          name="Coach" 
          component={AICoachScreen} 
          options={{
            tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />
          }}
        />
        <Tab.Screen 
          name="Profile" 
          component={ProfileScreen} 
          options={{
            tabBarIcon: ({ color, size }) => <User color={color} size={size} />
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
