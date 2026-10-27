import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { CycleStatus, UserProfile } from '../types';
import { addDays, parseISODay } from '../domain';

/**
 * Local, on-device reminders (no push server). Rescheduled whenever predictions or
 * preferences change. Never asks for permission by itself — onboarding/profile do that.
 */

const CHANNEL_ID = 'reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensureChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export const Reminders = {
  /** Ask for notification permission. Returns true when granted. */
  async requestPermission(): Promise<boolean> {
    await ensureChannel();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  },

  async reschedule(user: UserProfile, cycle: CycleStatus | null): Promise<number> {
    const perm = await Notifications.getPermissionsAsync();
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!perm.granted) return 0;
    await ensureChannel();
    let count = 0;

    if (user.notifications.dailyCheckIn) {
      const [hour, minute] = (user.notifications.checkInTime ?? '20:00').split(':').map(Number);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: user.sex === 'male' ? 'Daily check-in' : 'How was today?',
          body: user.sex === 'male' ? 'Thirty seconds: mood, energy, stress.' : 'Log how you feel — it keeps your predictions sharp.',
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL_ID },
      });
      count++;
    }

    if (user.sex === 'female' && user.notifications.periodReminders && cycle && (cycle.status === 'on_track' || cycle.status === 'assumed')) {
      const when = parseISODay(addDays(cycle.nextPeriodRange.start, -1));
      when.setHours(9, 0, 0, 0);
      if (when.getTime() > Date.now()) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Period may start soon',
            body: `Luna expects your period between ${cycle.nextPeriodRange.start.slice(5)} and ${cycle.nextPeriodRange.end.slice(5)}.`,
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL_ID },
        });
        count++;
      }
    }
    return count;
  },

  async cancelAll(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },
};
