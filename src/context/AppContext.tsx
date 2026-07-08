import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { UserProfile, AppMode, SymptomLog, CycleStatus, PregnancyStatus, PartnerLink } from '../types';
import { Store } from '../storage/Store';
import { computeCycleStatus, computePregnancyStatus } from '../services/CycleEngine';
import { PearsPartnerService } from '../services/PearsPartnerService';
import { WdkService } from '../services/WdkService';
import { ModelManager } from '../services/ModelManager';

export interface ThemeColors {
  primary: string;
  primaryDark: string;
  background: string;
  card: string;
  text: string;
  subtext: string;
}

const WOMEN_THEMES: Record<AppMode, ThemeColors> = {
  period: { primary: '#F43F5E', primaryDark: '#BE123C', background: '#FFF7F8', card: '#ffffff', text: '#1e293b', subtext: '#94a3b8' },
  conceive: { primary: '#14B8A6', primaryDark: '#0F766E', background: '#F0FDFA', card: '#ffffff', text: '#1e293b', subtext: '#94a3b8' },
  pregnancy: { primary: '#A855F7', primaryDark: '#7E22CE', background: '#FAF5FF', card: '#ffffff', text: '#1e293b', subtext: '#94a3b8' },
  perimenopause: { primary: '#8B5CF6', primaryDark: '#6D28D9', background: '#F5F3FF', card: '#ffffff', text: '#1e293b', subtext: '#94a3b8' },
};

const MEN_THEME: ThemeColors = {
  primary: '#3B82F6', primaryDark: '#1D4ED8', background: '#F6F9FF', card: '#ffffff', text: '#1e293b', subtext: '#94a3b8',
};

interface AppContextProps {
  ready: boolean;                       // storage hydrated
  user: UserProfile | null;
  saveUser: (user: UserProfile) => Promise<void>;
  updateUser: (patch: Partial<UserProfile>) => Promise<void>;
  currentMode: AppMode;
  setMode: (mode: AppMode) => void;
  themeColors: ThemeColors;
  logs: SymptomLog[];
  saveLog: (log: SymptomLog) => Promise<void>;
  cycle: CycleStatus | null;
  pregnancy: PregnancyStatus | null;
  partnerLink: PartnerLink | null;
  refreshPartnerLink: () => Promise<void>;
  resetApp: () => Promise<void>;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [logs, setLogs] = useState<SymptomLog[]>([]);
  const [partnerLink, setPartnerLink] = useState<PartnerLink | null>(null);

  // Hydrate everything once at startup
  useEffect(() => {
    (async () => {
      await Store.migrate();
      const [storedUser, storedLogs, link] = await Promise.all([
        Store.getUser(),
        Store.getLogs(),
        PearsPartnerService.init(),
        WdkService.init(),
        ModelManager.init(),
      ]);
      setUser(storedUser);
      setLogs(storedLogs);
      setPartnerLink(link);
      setReady(true);
    })();
  }, []);

  const cycle = useMemo(
    () => (user && user.sex === 'female' && user.mode !== 'pregnancy'
      ? computeCycleStatus(user, logs)
      : null),
    [user, logs],
  );

  const pregnancy = useMemo(
    () => (user && user.mode === 'pregnancy' ? computePregnancyStatus(user) : null),
    [user],
  );

  // Publish the partner snapshot whenever shared data changes (women, linked only)
  useEffect(() => {
    if (user?.sex === 'female' && partnerLink?.linked && partnerLink.role === 'sharer') {
      const recentLog = logs.length > 0 ? logs[logs.length - 1] : null;
      PearsPartnerService.publishSnapshot(user, cycle, pregnancy, recentLog);
    }
  }, [user, logs, cycle, pregnancy, partnerLink?.linked]);

  const saveUser = useCallback(async (next: UserProfile) => {
    setUser(next);
    await Store.saveUser(next);
  }, []);

  const updateUser = useCallback(async (patch: Partial<UserProfile>) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      Store.saveUser(next);
      return next;
    });
  }, []);

  const setMode = useCallback((mode: AppMode) => {
    updateUser({ mode });
  }, [updateUser]);

  const saveLog = useCallback(async (log: SymptomLog) => {
    const updated = await Store.saveLog(log);
    setLogs(updated);
  }, []);

  const refreshPartnerLink = useCallback(async () => {
    setPartnerLink({ ...(PearsPartnerService.getLink() ?? await PearsPartnerService.init()) });
  }, []);

  const resetApp = useCallback(async () => {
    await Store.wipeAll();
    setUser(null);
    setLogs([]);
    setPartnerLink(null);
  }, []);

  const currentMode: AppMode = user?.mode ?? 'period';
  const themeColors = user?.sex === 'male' ? MEN_THEME : WOMEN_THEMES[currentMode];

  return (
    <AppContext.Provider value={{
      ready, user, saveUser, updateUser, currentMode, setMode, themeColors,
      logs, saveLog, cycle, pregnancy, partnerLink, refreshPartnerLink, resetApp,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};

/** Back-compat alias for screens written against the old ModeContext API */
export const useMode = useApp;
export type { AppMode };
