# Route: Check-In (partners, tab 2)

**File:** [MenCheckInScreen.tsx](../../../src/screens/men/MenCheckInScreen.tsx)

## Purpose
The partner's own daily wellness log (mood, energy, stress, notes). Private to his phone, never
shared, and used as context by the partner coach ("tips for my own stress").

## Flow
Open → prefill today's entry if present → pick chips / write notes → Save → history (last 7 days)
updates.

## Status today
- ✅ One entry per day, prefill, 7-day history, local only.
- ⚠️ Same date bug as the women's log: saved as a UTC instant, looked up by local day ([02](../02-data-and-storage.md#the-date-bug)).
- ⚠️ Partner coach doesn't use check-ins (the template only looks at the snapshot).
- Minor: blocking `Alert` after save; use a toast.

## Target
- `day` + `loggedAt` fields (migration v2).
- Partner coach FACTS include his own last-7-day stress and energy summary, clearly separate from her shared data.
- Optional: a simple weekly trend (stress days this week vs last).

## Acceptance
- Save at 01:00 in UTC+3 → appears under today, not yesterday.
- Ask the partner coach "tips for my own stress" after 3 high-stress days → the answer mentions the recent stress pattern.
