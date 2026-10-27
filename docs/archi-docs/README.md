# LunaPredict Mobile — Architecture & Flow Docs

These docs describe how LunaPredict **should** work end to end once the real QVAC SDK
replaces the simulated AI, and how each screen behaves today. Every doc marks the gap between
the two, so the docs double as a work list.

Audited against the code on **2026-10-27** (Expo SDK 57, React Native 0.86, `@qvac/sdk` 0.22.0 on npm).

## Status legend

| Mark | Meaning |
|---|---|
| ✅ | Works as designed today |
| ⚠️ | Bug, or behaviour that is wrong or misleading (has a fix in the plan) |
| 🧪 | Simulated: real UI and state, fake transport or fake AI |
| 🆕 | Doesn't exist yet; designed here |

## Read in this order

| # | Doc | What it answers |
|---|---|---|
| 1 | [System architecture](01-system-architecture.md) | Layers, runtime (JS thread + QVAC Bare worker), build modes, folder layout |
| 2 | [Data & storage](02-data-and-storage.md) | Every entity and storage key, the schema v2 migration, wipe/export, secrets |
| 3 | [Tracking algorithms](03-tracking-algorithms.md) | Period detection, cycle prediction, ovulation (calendar + BBT/OPK/mucus), pregnancy dating, perimenopause staging, health flags. Includes research sources and test vectors |
| 4 | [Local AI with QVAC](04-local-ai-qvac.md) | Model catalog, download/load lifecycle, prompt building, thinking handling, safety layer, Expo dev-build setup, P2P status |
| 5 | [Navigation & user flows](05-navigation-and-user-flows.md) | Route map, women's and partner journeys, gating rules |
| 6 | [Testing & end-to-end](06-testing-and-e2e.md) | Unit tests, component tests, on-phone checklist, Maestro flows |
| 7 | [Implementation plan](07-implementation-plan.md) | Phased work with acceptance criteria and go/no-go gates |
| 8 | [Voice & African languages](08-voice-and-languages.md) | Whisper + TranslatePsy-AfriSLM + TTS: Swahili voice chat, 19-language typed chat, voice logging, translation safety |
| 9 | [Build & test on your phone](09-build-and-test-on-phone.md) | EAS dev build, first run, 10-step phone test, troubleshooting |

## Implementation status (branch `feat/real-qvac-ai-and-ux`, 2026-10-27)

| Area | Status | Notes |
|---|---|---|
| Tracking engine (03 A1–A10) | ✅ Implemented + tested | V1–V12 pass in Jest |
| Storage v2 (local day, SecureStore) | ✅ Implemented + tested | Migration runs on first launch |
| QVAC engine, model downloads, coach pipeline | ✅ Implemented, types verified against `@qvac/sdk` 0.22 | **Needs the first phone build to confirm** (9.4) |
| Safety triage, prompt builder, translation guard | ✅ Implemented + tested | Swahili terms still need native-speaker review |
| Voice in (Whisper) / read-aloud (phone TTS) | ✅ Implemented | Chatterbox natural voice not added (phone TTS used) |
| UI/UX rebuild (all routes) | ✅ Implemented | Accessible tokens, 48 dp targets, labels, toasts, sheets |
| Local reminders | ✅ Implemented | Period-due + daily check-in |
| Partner sync over Pears | 🧪 Still simulated | Labelled "Demo data" in the app |
| Wallet / P2P compute tiers | 🧪 Labs only | Desktop/network tiers removed from the coach |
| Maestro flows | 🆕 Not yet | testIDs are in place |

## One doc per route

| Route | Who | Doc |
|---|---|---|
| Onboarding | Everyone (first run) | [routes/onboarding.md](routes/onboarding.md) |
| Dashboard (tab) | Women | [routes/dashboard.md](routes/dashboard.md) |
| Calendar (tab) | Women | [routes/calendar.md](routes/calendar.md) |
| Log (tab) | Women | [routes/log.md](routes/log.md) |
| Coach (tab) | Women + partners | [routes/coach.md](routes/coach.md) |
| Profile (tab) | Women + partners | [routes/profile.md](routes/profile.md) |
| Models (stack) | Everyone | [routes/models.md](routes/models.md) |
| Partner sharing (stack) | Women | [routes/partner-sharing.md](routes/partner-sharing.md) |
| Partner dashboard (tab) | Partners | [routes/partner-dashboard.md](routes/partner-dashboard.md) |
| Check-In (tab) | Partners | [routes/check-in.md](routes/check-in.md) |
| Wallet (stack) | Women | [routes/wallet.md](routes/wallet.md) |

## Top findings (details in the linked docs)

1. 🧪 **The coach runs no model.** Downloads are a timer and replies come from keyword templates
   ([04](04-local-ai-qvac.md)).
2. ⚠️ **Log dates are saved in UTC but read as local days.** In Nairobi (UTC+3), a log saved
   between 00:00 and 02:59 lands on yesterday and can overwrite yesterday's log
   ([02](02-data-and-storage.md#the-date-bug)).
3. ⚠️ **One spotting entry can rewrite the whole prediction.** Verified: spotting on cycle day 17
   moved a user from "period in 6 days" to "day 7, period in 19 days"
   ([03](03-tracking-algorithms.md#a1-period-start-detection)).
4. ⚠️ **A late period is never shown.** The engine silently assumes a new cycle started. A user 40
   days late is told "day 13, ovulating" ([03](03-tracking-algorithms.md#a4-late-period-and-missed-logs)).
   For someone trying to conceive, that hides the most important signal.
5. ⚠️ **You can only log today.** There's no way to back-fill a past period, so predictions can't
   learn from history ([routes/log.md](routes/log.md)).
6. ⚠️ **BBT, ovulation tests and cervical mucus are collected but never used** for ovulation
   ([03](03-tracking-algorithms.md#a6-ovulation-detection-from-bbt-opk-and-mucus-conceive-mode)).
7. ⚠️ **Perimenopause is predicted like a regular 28-day cycle**, even after 6 months without a period.
8. ⚠️ **Notification preferences are collected, but no notifications exist.**
9. ⚠️ **"Delete all data" leaves the wallet, partner link and models in memory** until restart.
10. ⚠️ **The wallet recovery phrase is stored in plain AsyncStorage**, and it isn't a valid BIP39 phrase.
