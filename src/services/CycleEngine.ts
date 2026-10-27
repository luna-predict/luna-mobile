/**
 * Back-compat entry point. The tracking maths now lives in src/domain
 * (see docs/archi-docs/03-tracking-algorithms.md).
 */
export {
  toISODay, parseISODay, addDays, daysBetween, formatDay,
  computeCycleStatus, computePregnancyStatus, computePeriStatus, computeFlags,
  phaseInsight, partnerTip, fertilityLevel, dayOf,
} from '../domain';
