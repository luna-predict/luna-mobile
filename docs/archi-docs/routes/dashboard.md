# Route: Dashboard (women, tab 1)

**File:** [DashboardScreen.tsx](../../../src/screens/DashboardScreen.tsx)

## Purpose
Answer "where am I today and what's next?" at a glance, and route to the next action (log, ask
Luna, or "did your period start?").

## Reads
`cycle` / `pregnancy` / `peri` 🆕 status and `flags` 🆕 from AppContext; the last 3 logs.

## Layout by mode

| Block | Period / Conceive | Pregnancy | Perimenopause (target) |
|---|---|---|---|
| Ring | cycle day / cycle length | week / 40 | days since last period (no max) |
| Badge | phase | trimester | stage (STRAW+10) |
| Stat 1 | days to period (+ range) | days to due date | cycle variability (spread) |
| Stat 2 | days to ovulation / "Fertility high" | due date | hot flashes, 7-day average |
| Banner 🆕 | late period / flags | urgent flags | flags |
| Insight | rotating tip per mode | same | same |
| Recent logs | last 3 | last 3 | last 3 |

## Status today
- ✅ Ring, phase and stats come from the real engine; confidence note shown when not established.
- ⚠️ All engine issues show up here: no late state (V2/V3), spotting corruption (V4), peri countdown (V6). See [03](../03-tracking-algorithms.md#test-vectors).
- ⚠️ No prediction range; a seed guess looks as precise as a learned one.
- ⚠️ Pregnancy mode with no due date (reached via a Profile switch) shows "Day 1 of 28" and "—".
- ⚠️ Recent logs use `parseISODay(log.date)`, which inherits the UTC date bug ([02](../02-data-and-storage.md#the-date-bug)). `todayLogged` works around it with two comparisons; remove that once `day` exists.
- ⚠️ "🔒 ON-DEVICE" pill and "your on-device AI coach" copy are untrue while the coach is the demo engine.
- Minor: "Today's Insight" is a static tip list, not personal. Fine, but don't call it an insight from the AI.

## Target behaviour
1. **Late banner** (A4): "Period 4 days late · [It started] [Not yet]". "It started" opens LogDay with `periodStart` preset. Conceive mode adds the pregnancy-test hint.
2. **Range** under "Days to period": "Nov 18 · likely Nov 16–20".
3. **Flags strip** (A10): urgent flags are red, can't be dismissed, and include a "what to do" line; info flags can be dismissed for 30 days.
4. **Conceive extras**: today's fertility level (low / high / peak) and ovulation evidence ("confirmed by BBT").
5. **Peri layout** as in the table.
6. Pull-to-refresh isn't needed (state is local), but recompute when the app returns to the foreground after midnight (`AppState` + day change).

## Acceptance
- V1 → "Day 15", "14 days to period", range "Nov 7–13", badge "From onboarding".
- V3 → late banner, "Day 35"; tap "It started" → day 1, banner gone.
- Pregnancy at 41w 0d → "41w 0d", the `post_dates` flag shows.
- Leave the app open past midnight → the day increments on return.
