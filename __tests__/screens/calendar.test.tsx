import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { AppProvider } from '../../src/context/AppContext';
import CalendarScreen from '../../src/screens/CalendarScreen';
import { UserProfile, SymptomLog } from '../../src/types';
import { addDays, todayDay } from '../../src/domain';
import { PearsPartnerService } from '../../src/services/PearsPartnerService';
import { WdkService } from '../../src/services/WdkService';

jest.setTimeout(30000);

const today = todayDay();

function makeUser(over: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u-cal', name: 'Zari', birthYear: 1996, sex: 'female', mode: 'period', onboardingComplete: true,
    createdAt: new Date().toISOString(), avgCycleLength: 28, avgPeriodLength: 5,
    notifications: { periodReminders: true, dailyCheckIn: true, insights: false },
    sharing: { sharePhase: true, sharePredictions: true, shareMood: true, shareSymptoms: false },
    language: 'en', ...over,
  };
}

async function seed(user: UserProfile, logs: SymptomLog[] = []) {
  PearsPartnerService.reset();
  WdkService.reset();
  await AsyncStorage.clear();
  await AsyncStorage.setItem('luna:schemaVersion', '2');
  await AsyncStorage.setItem('luna:user', JSON.stringify(user));
  await AsyncStorage.setItem('luna:logs', JSON.stringify(logs));
}

async function renderCalendar() {
  await render(
    <NavigationContainer>
      <AppProvider>
        <CalendarScreen />
      </AppProvider>
    </NavigationContainer>
  );
}

describe('CalendarScreen interactive tests across 4 modes', () => {
  test('Mode 1 (Period): renders cycle calendar, navigates day, quick flow sets flow', async () => {
    const pastStart = addDays(today, -10);
    await seed(makeUser({ lastPeriodStart: pastStart }), [
      { id: pastStart, day: pastStart, date: pastStart, loggedAt: `${pastStart}T08:00:00Z`, symptoms: [], mood: null, energy: null, flow: 'medium', notes: '', mode: 'period', periodStart: true },
    ]);

    await renderCalendar();

    // Screen header
    expect(await screen.findByText(/Cycle Calendar/)).toBeTruthy();

    // Select today
    const calCell = await screen.findByTestId(`cal-${today}`);
    expect(calCell).toBeTruthy();
    fireEvent.press(calCell);

    // Day inspector shows Log this day button and quick flow selector
    expect(await screen.findByTestId('cal-log-day')).toBeTruthy();
    expect(screen.getByTestId('cal-period-start')).toBeTruthy();
    expect(screen.getByText('Quick flow')).toBeTruthy();

    // Quick set flow to Light
    const lightBtn = screen.getByLabelText('Set flow to Light 🩸');
    fireEvent.press(lightBtn);

    // Verify badge updates with light flow
    await waitFor(() => {
      expect(screen.getByText('Period · light')).toBeTruthy();
    });
  });

  test('Mode 2 (Conceive): displays fertility context, conception chances and OPK quick action', async () => {
    const pastStart = addDays(today, -12);
    await seed(makeUser({ mode: 'conceive', lastPeriodStart: pastStart }));

    await renderCalendar();

    expect(await screen.findByText(/Fertility & Ovulation/)).toBeTruthy();
    expect(screen.getAllByText('Peak fertility').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Ovulation test (OPK)')).toBeTruthy();

    // Quick toggle OPK positive
    const opkBtn = screen.getByText('OPK Positive');
    fireEvent.press(opkBtn);

    await waitFor(() => {
      expect(screen.getByText('✓ OPK Positive')).toBeTruthy();
    });
  });

  test('Mode 3 (Pregnancy): shows gestational week, milestone badges, and baby size', async () => {
    const lmp = addDays(today, -140); // 20 weeks pregnant
    const dueDate = addDays(lmp, 280);
    await seed(makeUser({
      mode: 'pregnancy',
      pregnancy: { lmp, dueDate, source: 'lmp' },
    }));

    await renderCalendar();

    expect(await screen.findByText(/Pregnancy Calendar/)).toBeTruthy();
    expect(screen.getByText(/Week 20/)).toBeTruthy();
    expect(screen.getByText('Due date')).toBeTruthy();

    // Tap today
    fireEvent.press(screen.getByTestId(`cal-${today}`));
    expect(await screen.findByText(/Trimester 2/)).toBeTruthy();
    expect(screen.getByText(/Baby is about the size of/)).toBeTruthy();
  });

  test('Mode 4 (Perimenopause): shows perimenopause legend and hot flash adjustment', async () => {
    const lastBleed = addDays(today, -45);
    await seed(makeUser({ mode: 'perimenopause', lastPeriodStart: lastBleed }));

    await renderCalendar();

    expect(await screen.findByText(/Cycle & Symptoms/)).toBeTruthy();
    expect(screen.getByText('Hot flash')).toBeTruthy();
    expect(screen.getByText('Poor sleep')).toBeTruthy();

    // Select today
    fireEvent.press(screen.getByTestId(`cal-${today}`));
    expect(await screen.findByText('Hot flashes')).toBeTruthy();

    // Stepper + button
    const plusBtn = screen.getByText('+');
    fireEvent.press(plusBtn);

    await waitFor(() => {
      expect(screen.getByText('1')).toBeTruthy();
    });
  });
});
