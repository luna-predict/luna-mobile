import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from './src/context/AppContext';
import AppNavigator from './src/navigation/AppNavigator';
import { ToastProvider } from './src/ui/Toast';

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <ToastProvider>
          <AppNavigator />
          <StatusBar style="dark" />
        </ToastProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}
