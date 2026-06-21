import React, { createContext, useContext, useState, useEffect } from 'react';

export type AppMode = 'period' | 'conceive' | 'pregnancy' | 'perimenopause';

interface ModeContextProps {
  currentMode: AppMode;
  setMode: (mode: AppMode) => void;
  themeColors: {
    primary: string;
    background: string;
    card: string;
  };
}

const ModeContext = createContext<ModeContextProps | undefined>(undefined);

export const ModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentMode, setCurrentMode] = useState<AppMode>('period');

  // Define colors based on the tailwind configuration
  const getThemeColors = (mode: AppMode) => {
    switch (mode) {
      case 'conceive':
        return { primary: '#14B8A6', background: '#F0FDFA', card: '#ffffff' };
      case 'pregnancy':
        return { primary: '#A855F7', background: '#FAF5FF', card: '#ffffff' };
      case 'perimenopause':
        return { primary: '#8B5CF6', background: '#F5F3FF', card: '#ffffff' };
      case 'period':
      default:
        return { primary: '#F43F5E', background: '#f8fafc', card: '#ffffff' };
    }
  };

  const themeColors = getThemeColors(currentMode);

  return (
    <ModeContext.Provider value={{ currentMode, setMode: setCurrentMode, themeColors }}>
      {children}
    </ModeContext.Provider>
  );
};

export const useMode = () => {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
};
