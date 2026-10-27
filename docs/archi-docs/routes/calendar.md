# Route: Calendar (women, tab 2)

**File:** [CalendarScreen.tsx](../../../src/screens/CalendarScreen.tsx)

## Purpose
See the past (logged days, actual periods) and the future (predicted periods, fertile window,
ovulation) on one month grid, and **edit any day**.

## Reads
`logs`, `cycle.periodDates`, `cycle.fertileDates`, `cycle.ovulationDate`, `user.dueDate`.

## Day cell priority (highest first)
1. Logged bleeding (light / medium / heavy) → solid colour.
2. Logged spotting 🆕 → small droplet marker, **not** solid (today spotting renders as a full period day ⚠️).
3. Predicted period → translucent.
4. Ovulation → amber; style by evidence: dashed = predicted, solid = likely, solid + ✓ = confirmed 🆕.
5. Fertile window → light amber; peak days slightly darker 🆕.
6. Today → outline.
Any day with a log gets a dot.

## Status today
- ✅ Month navigation, legend, selected-day detail, real predictions for the current and next cycle.
- ⚠️ **Read-only.** Tapping a day shows details but there's no way to log or edit it. Users can't back-fill past periods, so the engine can't learn from history.
- ⚠️ Spotting is drawn as a period day.
- ⚠️ `logByDay` keys on `log.date.slice(0, 10)` (UTC day) → logs can appear on the wrong day ([02](../02-data-and-storage.md#the-date-bug)).
- ⚠️ `logByDay` keeps only one log per day across modes; the last one wins.
- Predictions only cover the current anchor and next cycle; past months show no predicted periods (fine), but a late cycle will show stale predictions until A4 lands.

## Target
1. Selected-day card gets **"Log this day" / "Edit log"** → `LogDay` route with `{ day }`. Future days: disabled.
2. Quick actions on the selected day: **Period started here**, **Period ended here** (explicit markers, [03 A1](../03-tracking-algorithms.md#a1-period-start-detection)).
3. Show the prediction range as a fading edge on predicted period days 🆕.
4. Pregnancy: mark trimester boundaries and the due date; days with kick sessions get a marker.
5. Peri: no predictions; show bleeding days and hot-flash intensity (dot size).

## Acceptance
- Back-fill: select a day 20 days ago → Log this day → medium flow + Period started → Dashboard confidence goes from "seed" to "learning" once a second start exists.
- Log spotting on cycle day 17 → shows a droplet marker only; predictions don't move (V4).
- In UTC+3, a log made at 01:00 appears on today's cell (V7).
