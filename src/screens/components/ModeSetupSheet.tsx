import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useApp } from '../../context/AppContext';
import { AppMode } from '../../types';
import { Sheet, Stepper, Segmented, Button, space, type } from '../../ui';
import { addDays, formatDay, lmpFromWeeks, todayDay } from '../../domain';

/**
 * Asks only what a goal change really needs (05 §5.6):
 * → pregnancy: weeks pregnant / last period / due date · leaving pregnancy: how it ended
 * → perimenopause: last period · period ↔ conceive: nothing.
 */
export const ModeSetupSheet: React.FC<{ target: AppMode | null; onClose: () => void; onDone: (msg: string) => void }> = ({ target, onClose, onDone }) => {
  const { user, updateUser, themeColors: t, today } = useApp();
  const leavingPregnancy = user?.mode === 'pregnancy' && target !== 'pregnancy';
  const [source, setSource] = useState<'weeks' | 'lmp' | 'dueDate'>('weeks');
  const [weeks, setWeeks] = useState(8);
  const [daysAgo, setDaysAgo] = useState(28);
  const [weeksUntilDue, setWeeksUntilDue] = useState(30);
  const [months, setMonths] = useState(2);
  const [outcome, setOutcome] = useState<'birth' | 'loss'>('birth');
  const [endedDaysAgo, setEndedDaysAgo] = useState(0);

  useEffect(() => { setSource('weeks'); }, [target]);
  if (!target || !user) return null;

  const save = async () => {
    if (target === 'pregnancy') {
      const lmp = source === 'weeks' ? lmpFromWeeks(weeks, 0)
        : source === 'lmp' ? addDays(today, -daysAgo)
        : addDays(addDays(today, weeksUntilDue * 7), -280);
      const dueDate = addDays(lmp, 280);
      await updateUser({ mode: 'pregnancy', pregnancy: { lmp, dueDate, source }, dueDate });
      onDone(`Pregnancy mode on · due ${formatDay(dueDate, { month: 'long', day: 'numeric', year: 'numeric' })}`);
    } else if (leavingPregnancy) {
      const endedAt = addDays(today, -endedDaysAgo);
      await updateUser({
        mode: target,
        pregnancy: user.pregnancy ? { ...user.pregnancy, endedAt, outcome } : undefined,
        lastPeriodStart: undefined,
        ...(target === 'perimenopause' ? { lastPeriodStart: addDays(today, -months * 30) } : {}),
      });
      onDone(outcome === 'birth' ? 'Congratulations. Log your first period when it returns.' : 'We are so sorry. Take all the time you need.');
    } else if (target === 'perimenopause') {
      await updateUser({ mode: target, lastPeriodStart: addDays(today, -months * 30) });
      onDone('Perimenopause mode on');
    } else {
      await updateUser({ mode: target });
      onDone(target === 'conceive' ? 'Trying to conceive — fertility signs are now in your log' : 'Cycle tracking on');
    }
    onClose();
  };

  const title = target === 'pregnancy' ? 'Pregnancy details'
    : leavingPregnancy ? 'Your pregnancy has ended'
    : target === 'perimenopause' ? 'Your last period' : 'Switch goal';

  return (
    <Sheet visible={!!target} title={title} onClose={onClose}
      subtitle={target === 'pregnancy' ? 'Use whichever you know — Luna works out the rest.' : undefined}>
      <View style={{ gap: space.lg, paddingBottom: space.lg }}>
        {target === 'pregnancy' && (
          <>
            <Segmented
              value={source}
              onChange={v => setSource(v as typeof source)}
              options={[{ value: 'weeks', label: 'Weeks' }, { value: 'lmp', label: 'Last period' }, { value: 'dueDate', label: 'Due date' }]}
            />
            {source === 'weeks' && <Stepper label="Weeks pregnant" value={weeks} onChange={setWeeks} min={1} max={42} suffix="weeks pregnant" />}
            {source === 'lmp' && (
              <>
                <Stepper label="Last period started, days ago" value={daysAgo} onChange={setDaysAgo} min={7} max={300} suffix="days ago" />
                <Text style={{ textAlign: 'center', color: t.textMuted }}>{formatDay(addDays(today, -daysAgo), { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
              </>
            )}
            {source === 'dueDate' && (
              <>
                <Stepper label="Weeks until due date" value={weeksUntilDue} onChange={setWeeksUntilDue} min={0} max={40} suffix="weeks to go" />
                <Text style={{ textAlign: 'center', color: t.textMuted }}>Due {formatDay(addDays(today, weeksUntilDue * 7), { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
              </>
            )}
          </>
        )}
        {leavingPregnancy && (
          <>
            <Segmented value={outcome} onChange={v => setOutcome(v as 'birth' | 'loss')}
              options={[{ value: 'birth', label: 'Baby was born' }, { value: 'loss', label: 'Pregnancy loss' }]} />
            <Stepper label="Days ago" value={endedDaysAgo} onChange={setEndedDaysAgo} min={0} max={365} suffix="days ago" />
            <Text style={{ color: t.textMuted, fontSize: 14, lineHeight: 20 }}>
              Periods often take a while to return and can be irregular at first. Luna will start from scratch and learn again.
            </Text>
          </>
        )}
        {target === 'perimenopause' && (
          <Stepper label="Months since your last period" value={months} onChange={setMonths} min={0} max={24} suffix="months ago" />
        )}
        <Button label="Save" onPress={save} testID="mode-setup-save" />
        <Pressable onPress={onClose} accessibilityRole="button" style={{ alignItems: 'center', minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ ...type.label, color: t.textMuted }}>Cancel</Text>
        </Pressable>
      </View>
    </Sheet>
  );
};

export function needsSetup(from: AppMode, to: AppMode): boolean {
  return to === 'pregnancy' || to === 'perimenopause' || from === 'pregnancy';
}

export { todayDay };
