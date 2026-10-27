import { CyclePhase } from '../types';

/** Short, fixed copy per phase (human-written, not AI-generated). */
export function phaseInsight(phase: CyclePhase): string {
  switch (phase) {
    case 'menstrual': return 'Rest and nurture yourself';
    case 'follicular': return 'Energy is rising';
    case 'ovulatory': return 'Peak energy and fertility';
    case 'luteal': return 'Wind down and reflect';
  }
}

/** Supportive tip for a linked partner based on the sharer's phase. */
export function partnerTip(phase: CyclePhase | undefined): string {
  switch (phase) {
    case 'menstrual': return 'Cramps and low energy are common right now. A heating pad, her favourite snack, or taking a chore off her plate goes a long way.';
    case 'follicular': return 'Energy is climbing — a good window to plan something active or social together.';
    case 'ovulatory': return 'Peak-energy days. If you are trying to conceive, these are the most important days of the month.';
    case 'luteal': return 'PMS can surface — extra patience, comfort food and low-key evenings are appreciated.';
    default: return 'Link with your partner to see supportive, phase-aware tips here.';
  }
}
