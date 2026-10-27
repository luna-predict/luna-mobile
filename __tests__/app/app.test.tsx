import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from '../../App';
import { addDays, todayDay } from '../../src/domain';
import { UserProfile, SymptomLog } from '../../src/types';
import { PearsPartnerService } from '../../src/services/PearsPartnerService';
import { WdkService } from '../../src/services/WdkService';

/**
 * Whole-app smoke tests: real screens, context, domain and coach pipeline (demo engine).
 * Native-only pieces are mocked in jest.setup.js.
 */

jest.setTimeout(30000);

const today = todayDay();

function woman(over: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u', name: 'Amani', birthYear: 1995, sex: 'female', mode: 'period', onboardingComplete: true,
    createdAt: new Date().toISOString(), avgCycleLength: 28, avgPeriodLength: 5,
    notifications: { periodReminders: true, dailyCheckIn: true, insights: false },
    sharing: { sharePhase: true, sharePredictions: true, shareMood: true, shareSymptoms: false },
    language: 'en', ...over,
  };
}

function flowLog(day: string): SymptomLog {
  return { id: day, day, date: day, loggedAt: `${day}T08:00:00Z`, symptoms: [], mood: null, energy: null, flow: 'medium', notes: '', mode: 'period' };
}

async function seed(user: UserProfile | null, logs: SymptomLog[] = []) {
  PearsPartnerService.reset();
  WdkService.reset();
  await AsyncStorage.clear();
  await AsyncStorage.setItem('luna:schemaVersion', '2');
  if (user) await AsyncStorage.setItem('luna:user', JSON.stringify(user));
  await AsyncStorage.setItem('luna:logs', JSON.stringify(logs));
}

describe('LunaPredict app', () => {
  test('onboarding → dashboard for a cycle tracker', async () => {
    await seed(null);
    await render(<App />);
    await fireEvent.changeText(await screen.findByTestId('onboarding-name'), 'Wanjiru');
    await fireEvent.press(screen.getByTestId('onboarding-continue'));
    await fireEvent.press(await screen.findByTestId('who-female'));
    await fireEvent.press(screen.getByTestId('onboarding-continue'));
    await fireEvent.press(await screen.findByTestId('goal-period'));
    await fireEvent.press(screen.getByTestId('onboarding-continue')); // goal
    await fireEvent.press(await screen.findByTestId('onboarding-continue')); // cycle
    await fireEvent.press(await screen.findByTestId('onboarding-continue')); // last period (14 days ago)
    await fireEvent.press(await screen.findByText('Regular'));
    await fireEvent.press(screen.getByTestId('onboarding-continue'));
    await fireEvent.press(await screen.findByTestId('onboarding-continue')); // reminders
    await fireEvent.press(await screen.findByTestId('consent-check'));
    await fireEvent.press(screen.getByTestId('onboarding-finish'));
    expect(await screen.findByText(/Good (morning|afternoon|evening), Wanjiru/)).toBeTruthy();
    expect(screen.getByTestId('dashboard-ring-value').props.children).toBe(15);
  });

  test('a late period shows the late banner, and every tab renders', async () => {
    const starts = [112, 84, 56, 34].map(n => addDays(today, -n)); // 28-day cycles, last start 34 days ago → 6 days late
    await seed(woman(), starts.map(flowLog));
    await render(<App />);
    expect(await screen.findByText('Period 6 days late')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('tab-calendar'));
    expect(await screen.findByText('Learned')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('tab-log'));
    expect(await screen.findByTestId('log-save')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('tab-profile'));
    expect(await screen.findByText('Your goal')).toBeTruthy();
  });

  test('logging today updates the dashboard', async () => {
    await seed(woman({ lastPeriodStart: addDays(today, -10) }));
    await render(<App />);
    await fireEvent.press(await screen.findByTestId('tab-log'));
    await fireEvent.press(await screen.findByTestId('mood-good'));
    await fireEvent.press(screen.getByTestId('symptom-fatigue'));
    await fireEvent.press(screen.getByTestId('log-save'));
    await fireEvent.press(screen.getByTestId('tab-today'));
    expect(await screen.findByText('Logged today')).toBeTruthy();
  });

  test('coach answers in demo mode, and emergencies get the safety card', async () => {
    await seed(woman({ lastPeriodStart: addDays(today, -20) }));
    await render(<App />);
    await fireEvent.press(await screen.findByTestId('tab-coach'));
    expect(await screen.findByText('Demo mode')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('coach-input'), 'Why am I so tired?');
    await fireEvent.press(screen.getByTestId('coach-send'));
    await waitFor(() => expect(screen.getAllByText(/luteal|progesterone|tired|Tiredness/i).length).toBeGreaterThan(1), { timeout: 15000 });

    await fireEvent.changeText(screen.getByTestId('coach-input'), 'I have chest pain');
    await fireEvent.press(screen.getByTestId('coach-send'));
    expect(await screen.findByText(/This could be an emergency/)).toBeTruthy();
    expect(screen.getByText('Call 999')).toBeTruthy();
  });

  test('partner sees the link screen and can reach check-in', async () => {
    await seed(woman({ sex: 'male', name: 'Otieno' }));
    await render(<App />);
    expect(await screen.findByText('Link with your partner')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('tab-checkin'));
    expect(await screen.findByText('Save check-in')).toBeTruthy();
  });
});
