import { AppMode, CycleStatus, SymptomLog } from '../types';

/**
 * Deterministic response composer standing in for MedPsy inference output.
 * Builds answers from the user's real question, mode, cycle state and logged
 * symptoms so the offline demo behaves like a grounded model. Production
 * replaces composeReply with @qvac/sdk completion() over the same prompt.
 */

interface ComposerContext {
  mode: AppMode;
  question: string;
  cycle: CycleStatus | null;
  recentLogs: SymptomLog[];
  depth: 'compact' | 'deep'; // 1.7B local vs 4B delegated
  userName?: string;
}

const TOPIC_ANSWERS: { match: RegExp; answer: (ctx: ComposerContext) => string }[] = [
  {
    match: /tired|fatigue|exhaust|energy|sleep/i,
    answer: (ctx) => {
      const phase = ctx.cycle?.phase;
      const logged = ctx.recentLogs.some(l => l.symptoms.includes('fatigue') || l.energy === 'low');
      let base = phase === 'luteal'
        ? `Fatigue in the luteal phase (you're on day ${ctx.cycle?.cycleDay}) is very common — progesterone rises after ovulation and has a natural sedative effect.`
        : phase === 'menstrual'
          ? 'Fatigue during your period is often linked to iron loss and prostaglandin activity.'
          : 'Tiredness can come from hormonal shifts, sleep quality, hydration, or iron levels.';
      if (logged) base += ' I can see low energy in your recent logs, so this fits your pattern.';
      base += ' Prioritize sleep, hydration, and iron-rich foods (leafy greens, legumes).';
      if (ctx.depth === 'deep') base += ' If fatigue persists across your whole cycle or worsens, a ferritin and thyroid panel with your doctor is a reasonable next step — persistent fatigue outside the luteal window is worth ruling out anemia and hypothyroidism.';
      return base;
    },
  },
  {
    match: /cramp|pain|ache|dysmenorrhea/i,
    answer: (ctx) => {
      let base = 'For cramps: heat on the lower abdomen, gentle movement, and magnesium-rich foods genuinely help. NSAIDs like ibuprofen work best taken at the first sign of cramping, not after pain peaks.';
      if (ctx.recentLogs.some(l => l.symptoms.includes('cramps'))) {
        base = `You've logged cramps recently. ${base}`;
      }
      if (ctx.depth === 'deep') base += ' If cramps regularly interfere with daily life or are worsening over months, that pattern can suggest endometriosis or fibroids — worth discussing with a gynecologist rather than just managing symptoms.';
      return base;
    },
  },
  {
    match: /fertile|ovulat|conceive|pregnant\b|trying/i,
    answer: (ctx) => {
      if (!ctx.cycle) return 'Your fertile window is typically the 5 days before ovulation plus ovulation day. Log your periods and I can predict yours precisely.';
      const c = ctx.cycle;
      let base = c.inFertileWindow
        ? `You're in your fertile window right now (cycle day ${c.cycleDay}). Ovulation is predicted around ${c.ovulationDate}.`
        : `Your next fertile window opens around ${c.fertileWindowStart}, with ovulation predicted near ${c.ovulationDate} — ${c.daysUntilOvulation} days away.`;
      base += ' The two days before ovulation carry the highest conception probability.';
      if (ctx.depth === 'deep') base += ` My prediction confidence is "${c.confidence}" — BBT logging each morning and OPK tests would tighten it. Sperm survive up to 5 days, so intercourse every 1–2 days across the window beats trying to time the exact day.`;
      return base;
    },
  },
  {
    match: /mood|irritab|angry|sad|depress|anxious|pms/i,
    answer: (ctx) => {
      const phase = ctx.cycle?.phase;
      let base = phase === 'luteal'
        ? `Mood shifts on day ${ctx.cycle?.cycleDay} line up with the luteal phase — estrogen and serotonin dip together after ovulation, which is why PMS mood symptoms cluster here.`
        : 'Mood changes across the cycle are driven by estrogen and progesterone swings affecting serotonin.';
      base += ' Regular meals, movement, and consistent sleep blunt the swings more than people expect.';
      if (ctx.depth === 'deep') base += ' If low mood in the week before your period is severe and lifts when bleeding starts, that pattern is worth screening for PMDD with a clinician — it is treatable.';
      return base;
    },
  },
  {
    match: /flow|heavy|bleed|spotting/i,
    answer: (ctx) => {
      let base = 'Flow varies cycle to cycle. Spotting mid-cycle can accompany ovulation; heavier first days are normal.';
      const flows = ctx.recentLogs.filter(l => l.flow).map(l => l.flow);
      if (flows.length) base = `Your recent logs show ${flows.join(', ')} flow. ${base}`;
      if (ctx.depth === 'deep') base += ' Soaking through a pad/tampon hourly for several hours, or clots larger than a grape, meets the clinical bar for menorrhagia — track it and bring the log to your doctor.';
      return base;
    },
  },
  {
    match: /hot flash|night sweat|perimenopause|menopause/i,
    answer: (ctx) => {
      let base = 'Hot flashes come from the hypothalamus becoming more sensitive to small temperature changes as estrogen declines. Common triggers: caffeine, alcohol, spicy food, warm rooms, and stress.';
      if (ctx.recentLogs.some(l => l.symptoms.includes('hot_flash') || l.symptoms.includes('night_sweats'))) {
        base = `I can see hot flashes in your recent logs. ${base} Logging when they hit helps us find your triggers.`;
      }
      if (ctx.depth === 'deep') base += ' If they disrupt sleep most nights, modern low-dose HRT has a much better safety profile than its reputation — a conversation with a menopause-informed clinician is worthwhile.';
      return base;
    },
  },
  {
    match: /baby|kick|trimester|due date|morning sickness|nausea/i,
    answer: (ctx) => {
      let base = 'In pregnancy, track patterns rather than single data points — kick counts, symptoms, and appointments.';
      if (ctx.mode === 'pregnancy') base = 'Morning sickness usually peaks around week 9–10 and eases into the second trimester. Small frequent meals, ginger, and vitamin B6 are first-line.';
      if (ctx.depth === 'deep') base += ' Reduced fetal movement after 28 weeks is always same-day worth checking with your provider — never wait it out.';
      return base;
    },
  },
  {
    match: /food|eat|diet|nutrition|craving/i,
    answer: (ctx) => {
      const phase = ctx.cycle?.phase;
      let base = phase === 'luteal'
        ? 'Cravings before your period are physiological — serotonin dips and your body reaches for quick carbs. Pairing carbs with protein steadies the crash.'
        : 'Cycle-aware nutrition: iron + vitamin C during your period, protein and complex carbs in the luteal phase.';
      if (ctx.depth === 'deep') base += ' Magnesium glycinate (200–400mg) in the luteal phase has decent evidence for both cravings and cramps.';
      return base;
    },
  },
];

function fallbackAnswer(ctx: ComposerContext): string {
  const c = ctx.cycle;
  const logCount = ctx.recentLogs.length;
  let base = c
    ? `Here's where you are: cycle day ${c.cycleDay} of ${c.cycleLength}, ${c.phaseLabel.toLowerCase()} phase. Next period predicted ${c.nextPeriodDate} (${c.daysUntilPeriod} days).`
    : 'I can give you much sharper answers once you log a few days — symptoms, mood, and flow all feed my predictions.';
  if (logCount > 0) base += ` I'm drawing on your last ${logCount} log${logCount > 1 ? 's' : ''} for context.`;
  base += ' Ask me about symptoms, fertility, mood, nutrition, or anything you\'re noticing in your body.';
  return base;
}

export function composeReply(ctx: ComposerContext): string {
  const topic = TOPIC_ANSWERS.find(t => t.match.test(ctx.question));
  const core = topic ? topic.answer(ctx) : fallbackAnswer(ctx);
  const disclaimer = ctx.depth === 'deep'
    ? '\n\nI\'m an on-device AI, not a doctor — for diagnosis or treatment, please consult a clinician.'
    : '';
  return core + disclaimer;
}

/** Partner-side coach: supportive answers for the linked partner (men side). */
export function composePartnerReply(question: string, phase: string | undefined, sharerName: string): string {
  if (/gift|surprise|nice|help|support/i.test(question)) {
    switch (phase) {
      case 'menstrual': return `Right now ${sharerName} is on her period — comfort wins: her favorite snacks, a heating pad, taking dinner off her plate, and not needing anything from her tonight.`;
      case 'luteal': return `${sharerName} is in her luteal phase — PMS territory. Low-key support beats grand gestures: patience, snacks, and flexibility with plans.`;
      case 'ovulatory': return `${sharerName} is at peak energy right now — a great few days to plan a date night or something active together.`;
      default: return `${sharerName}'s energy is rising in this phase — good timing for shared plans, adventures, or tackling things together.`;
    }
  }
  if (/why|mood|angry|irritab|upset|distant/i.test(question)) {
    return phase === 'luteal' || phase === 'menstrual'
      ? `Hormone shifts in the ${phase} phase genuinely affect mood and energy — it isn't about you. The move: don't try to fix it, just be steady, warm, and useful.`
      : 'Mood shifts have many causes beyond the cycle — the best first step is asking how she\'s doing and actually listening.';
  }
  if (/period|cycle|phase|when/i.test(question)) {
    return phase
      ? `Based on what ${sharerName} shares with you, she's in her ${phase} phase. Check the Partner dashboard for her predicted dates.`
      : `${sharerName} hasn't shared cycle details yet — she controls exactly what you can see from her Partner settings.`;
  }
  return `I'm your companion for understanding and supporting ${sharerName}. Ask me what her current phase means, how to help with symptoms, or good timing for plans. I only see what she chooses to share.`;
}
