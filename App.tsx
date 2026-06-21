import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ModeProvider } from './src/context/ModeContext';
import AppNavigator from './src/navigation/AppNavigator';
import { WdkManager } from './src/wallet/WdkManager';

const wdkManager = new WdkManager();

export default function App() {
  useEffect(() => {
    wdkManager.initializeWallet();
  }, []);

  return (
    <SafeAreaProvider>
      <ModeProvider>
        <AppNavigator />
        <StatusBar style="dark" />
      </ModeProvider>
    </SafeAreaProvider>
  );
}
