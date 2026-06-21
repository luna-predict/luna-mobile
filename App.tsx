import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import { WdkManager } from './src/wallet/WdkManager';

const wdkManager = new WdkManager();

export default function App() {
  useEffect(() => {
    // Initialize WDK on app start
    wdkManager.initializeWallet();
  }, []);

  return (
    <SafeAreaProvider>
      <HomeScreen />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
