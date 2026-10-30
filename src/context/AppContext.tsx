import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import {
  UserProfile, AppMode, SymptomLog, CycleStatus, PregnancyStatus, PeriStatus, PartnerLink,
  HealthFlag, LogDay,
} from '../types';
import { Store } from '../storage/Store';
import { SecureVault } from '../storage/SecureVault';
import {
  computeCycleStatus, computePregnancyStatus, computePeriStatus, computeFlags, todayDay, addDays,
} from '../domain';
import { PearsPartnerService } from '../services/PearsPartnerService';
import { WdkService } from '../services/WdkService';
import { ModelManager } from '../services/ModelManager';
import { Reminders } from '../services/Reminders';
import { ThemeColors, WOMEN_THEMES, PARTNER_THEME } from '../ui/theme';

export type { ThemeColors };

export type LogInput = Omit<SymptomLog, 'id' | 'date' | 'loggedAt'> & { id?: string };

interface AppContextProps {
  ready: boolean;
  today: LogDay;
  user: UserProfile | null;
  saveUser: (user: UserProfile) => Promise<void>;
  updateUser: (patch: Partial<UserProfile>) => Promise<void>;
  currentMode: AppMode;
  setMode: (mode: AppMode) => Promise<void>;
  themeColors: ThemeColors;
  logs: SymptomLog[];
  getLog: (day: LogDay, mode?: AppMode) => SymptomLog | null;
  saveLog: (log: LogInput) => Promise<void>;
  deleteLog: (day: LogDay, mode: AppMode) => Promise<void>;
  cycle: CycleStatus | null;
  pregnancy: PregnancyStatus | null;
  peri: PeriStatus | null;
  flags: HealthFlag[];
  dismissFlag: (id: string) => Promise<void>;
  partnerLink: PartnerLink | null;
  refreshPartnerLink: () => Promise<void>;
  resetApp: (opts?: { deleteModels?: boolean }) => Promise<void>;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState<LogDay>(todayDay());
  const [user, setUser] = useState<UserProfile | null>(null);
  const userRef = useRef<UserProfile | null>(null);
  const [logs, setLogs] = useState<SymptomLog[]>([]);
  const [partnerLink, setPartnerLink] = useState<PartnerLink | null>(null);
  const [dismissed, setDismissed] = useState<Record<string, LogDay>>({});

  useEffect(() => {
    (async () => {
      try {
        await Store.migrate().catch(e => console.warn('[Store.migrate] failed:', e));
        const [storedUser, storedLogs, link, , , dismissedFlags] = await Promise.all([
          Store.getUser().catch(() => null),
          Store.getLogs().catch(() => []),
          PearsPartnerService.init().catch(e => { console.warn('[PearsPartnerService.init] failed:', e); return null; }),
          WdkService.init().catch(e => { console.warn('[WdkService.init] failed:', e); return null; }),
          ModelManager.init().catch(e => { console.warn('[ModelManager.init] failed:', e); return []; }),
          Store.getDismissedFlags().catch(() => ({})),
        ]);
        userRef.current = storedUser;
        setUser(storedUser);
        setLogs(storedLogs ?? []);
        setPartnerLink(link);
        setDismissed(dismissedFlags ?? {});
      } catch (err) {
        console.error('[AppContext] Failed to initialize state:', err);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // "Today" rolls over at midnight and when the app returns to the foreground
  useEffect(() => {
    const tick = () => setToday(prev => (prev === todayDay() ? prev : todayDay()));
    const sub = AppState.addEventListener('change', s => { if (s === 'active') tick(); });
    const interval = setInterval(tick, 60_000);
    return () => { sub.remove(); clearInterval(interval); };
  }, []);

  const now = useMemo(() => {
    const [y, m, d] = today.split('-').map(Number);
    const n = new Date();
    return new Date(y, m - 1, d, n.getHours(), n.getMinutes());
  }, [today]);

  const isWoman = user?.sex === 'female';
  const cycle = useMemo(
    () => (user && isWoman && (user.mode === 'period' || user.mode === 'conceive') ? computeCycleStatus(user, logs, now) : null),
    [user, isWoman, logs, now],
  );
  const pregnancy = useMemo(
    () => (user && isWoman && user.mode === 'pregnancy' ? computePregnancyStatus(user, now) : null),
    [user, isWoman, now],
  );
  const peri = useMemo(
    () => (user && isWoman && user.mode === 'perimenopause' ? computePeriStatus(user, logs, now) : null),
    [user, isWoman, logs, now],
  );
  const flags = useMemo(() => {
    if (!user || !isWoman) return [];
    return computeFlags({ user, logs, cycle, pregnancy, peri, now })
      .filter(f => f.severity !== 'info' || !dismissed[f.id] || dismissed[f.id] < addDays(today, -30));
  }, [user, isWoman, logs, cycle, pregnancy, peri, now, dismissed, today]);

  // Publish the partner snapshot whenever shared data changes (women, linked only)
  useEffect(() => {
    if (user?.sex === 'female' && partnerLink?.linked && partnerLink.role === 'sharer') {
      PearsPartnerService.publishSnapshot(user, cycle, pregnancy, logs, today);
    }
  }, [user, logs, cycle, pregnancy, partnerLink?.linked, partnerLink?.role, today]);

  // Keep local reminders in step with predictions and preferences
  useEffect(() => {
    if (ready && user) Reminders.reschedule(user, cycle).catch(() => {});
  }, [ready, user, cycle?.nextPeriodRange.start, cycle?.status]);

  const saveUser = useCallback(async (next: UserProfile) => {
    userRef.current = next;
    setUser(next);
    await Store.saveUser(next);
  }, []);

  const updateUser = useCallback(async (patch: Partial<UserProfile>) => {
    const prev = userRef.current;
    if (!prev) return;
    const next = { ...prev, ...patch };
    userRef.current = next;
    setUser(next);
    await Store.saveUser(next);
  }, []);

  const setMode = useCallback((mode: AppMode) => updateUser({ mode }), [updateUser]);

  const getLog = useCallback(
    (day: LogDay, mode?: AppMode) => logs.find(l => l.day === day && (!mode || l.mode === mode)) ?? null,
    [logs],
  );

  const saveLog = useCallback(async (input: LogInput) => {
    const log: SymptomLog = {
      ...input,
      id: input.id ?? `${input.day}-${input.mode}-${Date.now().toString(36)}`,
      date: input.day,
      loggedAt: new Date().toISOString(),
    };
    setLogs(await Store.saveLog(log));
  }, []);

  const deleteLog = useCallback(async (day: LogDay, mode: AppMode) => {
    setLogs(await Store.deleteLog(day, mode));
  }, []);

  const dismissFlag = useCallback(async (id: string) => {
    const next = { ...dismissed, [id]: today };
    setDismissed(next);
    await Store.saveDismissedFlags(next);
  }, [dismissed, today]);

  const refreshPartnerLink = useCallback(async () => {
    setPartnerLink({ ...(PearsPartnerService.getLink() ?? await PearsPartnerService.init()) });
  }, []);

  const resetApp = useCallback(async (opts: { deleteModels?: boolean } = {}) => {
    const { coachEngine } = await import('../ai/engine');
    await coachEngine.unloadAll().catch(() => {});
    await ModelManager.reset({ deleteFiles: !!opts.deleteModels });
    WdkService.reset();
    PearsPartnerService.reset();
    await SecureVault.clear();
    await Reminders.cancelAll().catch(() => {});
    await Store.wipeAll();
    if (!opts.deleteModels) await ModelManager.persist();
    userRef.current = null;
    setUser(null);
    setLogs([]);
    setPartnerLink(null);
    setDismissed({});
  }, []);

  const currentMode: AppMode = user?.mode ?? 'period';
  const themeColors = user?.sex === 'male' ? PARTNER_THEME : WOMEN_THEMES[currentMode];

  return (
    <AppContext.Provider value={{
      ready, today, user, saveUser, updateUser, currentMode, setMode, themeColors,
      logs, getLog, saveLog, deleteLog, cycle, pregnancy, peri, flags, dismissFlag,
      partnerLink, refreshPartnerLink, resetApp,
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
