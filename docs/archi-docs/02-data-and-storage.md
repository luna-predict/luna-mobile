# 2. Data & Storage

All data lives on the device. `Store` ([src/storage/Store.ts](../../src/storage/Store.ts)) is the
only module that touches AsyncStorage. QVAC model files live in the SDK's own cache directory, not
in AsyncStorage.

## 2.1 Storage keys

| Key | Type | Written by | Notes |
|---|---|---|---|
| `luna:schemaVersion` | number | `Store.migrate` | 1 today → **2** after the date migration |
| `luna:user` | `UserProfile` | Onboarding, Profile | |
| `luna:logs` | `SymptomLog[]` | Log screen | Sorted by day. One per day per mode |
| `luna:menCheckIns` | `MenCheckIn[]` | Check-In | One per day |
| `luna:wallet` | `WalletState` | WdkService | ⚠️ contains the mnemonic in plain text → move to SecureStore |
| `luna:partner` | `PartnerLink` | PearsPartnerService | |
| `luna:sharedSnapshot` | `SharedSnapshot` | PearsPartnerService | Published (woman) or last received (partner) |
| `luna:models` | `ModelRegistryEntry[]` | ModelManager | Mirrors what the QVAC cache holds |
| `luna:chatHistory` | `ChatMessage[]` | Coach | Last 100 messages |
| `luna:flagsDismissed` 🆕 | `Record<flagId, LogDay>` | Dashboard | So health flags don't nag daily |
| SecureStore `luna.wallet.mnemonic` 🆕 | string | WdkService | `expo-secure-store` (Android Keystore / iOS Keychain) |

## The date bug

**Today** ⚠️: [SymptomLoggerScreen.tsx:144](../../src/screens/SymptomLoggerScreen.tsx#L144) saves
`date: new Date().toISOString()`, which is a **UTC** timestamp. Everything else treats
`date.slice(0, 10)` as the user's **local** calendar day:

- `Store.saveLog` dedupes "one log per day" by the UTC day.
- `Store.getLogForDay(toISODay(new Date()))` looks up by the local day.
- `CycleEngine.parseISODay(log.date)` turns the UTC day into a local date.

Verified effect in Nairobi (UTC+3): a log saved at 01:30 on 27 Oct is stored as `2026-10-26`. The
Log screen then shows an empty form for the 27th, and saving again **overwrites the 26th's log**.
West of UTC, evening logs jump to tomorrow instead. Flow days shift by a day, which shifts cycle
starts.

**Fix: split "which day" from "when saved".**

```ts
type LogDay = string; // 'YYYY-MM-DD' in the user's local calendar, never parsed as UTC

interface SymptomLog {
  id: string;
  day: LogDay;          // 🆕 the calendar day this log describes (can be a past day)
  loggedAt: string;     // 🆕 ISO instant it was saved (audit only)
  periodStart?: boolean;// 🆕 explicit "my period started today"
  periodEnd?: boolean;  // 🆕 explicit "my period ended"
  // …existing fields; `date` kept read-only for one release, then removed
}
```

**Migration v1 → v2** (runs once in `Store.migrate`):

```ts
for (const log of logs) {
  // Old `date` is a full ISO instant ending in Z. new Date() gives the true instant,
  // and toISODay() turns it into the local day the user actually lived.
  log.day = log.day ?? toISODay(new Date(log.date));
  log.loggedAt = log.loggedAt ?? log.date;
}
// Re-dedupe by (day, mode) keeping the newest loggedAt, re-sort by day, write, set schemaVersion=2.
```

Same treatment for `MenCheckIn` (`day` + `loggedAt`).

## 2.2 Entities

### UserProfile
Seed data from onboarding, plus mode. Changes:
- 🆕 `pregnancy?: { lmp: LogDay; dueDate: LogDay; source: 'weeks' | 'lmp' | 'dueDate' | 'ultrasound'; endedAt?: LogDay; outcome?: 'birth' | 'loss' }`
  replaces the bare `dueDate`.
- 🆕 `reminders?: { checkInTime: 'HH:mm'; periodLeadDays: number }`
- `avgCycleLength` and `avgPeriodLength` stay as the **seed**. Learned values are always computed.

### SymptomLog
One per `(day, mode)`. Allowed field values:

| Field | Values | Used by |
|---|---|---|
| `flow` | `spotting` · `light` · `medium` · `heavy` · null | Period detection (spotting never starts a period) |
| `periodStart` / `periodEnd` 🆕 | boolean | Overrides inferred period boundaries |
| `bbt` | 34.0–42.0 °C | BBT thermal shift (conceive) |
| `cervicalMucus` | `dry` · `sticky` · `creamy` · `eggwhite` | Peak-day detection |
| `opkResult` | `positive` · `negative` | LH-surge ovulation estimate |
| `kicksCount` | int | Being replaced by kick sessions 🆕 |
| `kickSessions` 🆕 | `{ start: ISO; end: ISO; count: number }[]` | "10 movements in 2 h" check |
| `hotFlashCount` | int | Peri symptom trend |
| `sleepQuality` | `good` · `fair` · `poor` | Coach context, trends |
| `symptoms` | ids from the Log screen catalogue | Coach context, calendar |
| `notes` | free text | Coach context (never shared with a partner) |

### Derived (never stored)
`CycleStatus`, `PregnancyStatus`, `PeriStatus` 🆕 and `HealthFlag[]` 🆕 are computed in
`AppContext` from `user + logs + today`. See [03](03-tracking-algorithms.md).

## 2.3 Write paths

```mermaid
flowchart LR
  L[Log screen] -->|saveLog(day, fields)| C[AppContext]
  C --> S[Store.saveLog]
  S -->|dedupe by day+mode, sort| AS[(AsyncStorage)]
  S --> C2[setLogs]
  C2 --> D["useMemo: cycle / pregnancy / peri / flags"]
  D --> UI[Dashboard · Calendar · Coach context]
  D --> P[PearsPartnerService.publishSnapshot<br/>filtered by sharing prefs]
  D --> N[Notifications.reschedule 🆕]
```

## 2.4 Reset, export, privacy

**Delete all data** must clear storage **and** in-memory state:

```ts
async function resetApp() {
  await engine.unloadAll();                 // free RAM
  await ModelManager.reset({ deleteFiles: true }); // unloadModel({ clearStorage: true }) per model
  WdkService.reset(); PearsPartnerService.reset(); await SecureStore.deleteItemAsync('luna.wallet.mnemonic');
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Store.wipeAll();
  setUser(null); setLogs([]); setPartnerLink(null);
}
```

⚠️ Today only `Store.wipeAll()` runs, so the singletons keep serving the old wallet, partner link
and model registry until the app restarts ([AppContext.tsx:119](../../src/context/AppContext.tsx#L119)).
The UI should also offer to keep the downloaded model files (1.3 GB), because re-downloading is slow.

**Export** copies logs and check-ins as JSON to the clipboard today. Target: write a `.json` file and
open the share sheet (`expo-sharing`). Include `schemaVersion` so an import feature can come later.
Never include the mnemonic.

**What leaves the device:**

| Data | Leaves? | Condition |
|---|---|---|
| Logs, notes, chat | Never | — |
| Partner snapshot | To the paired partner only | Each field gated by `SharingPreferences`; notes never included |
| Model download | Inbound only | From Hugging Face over HTTPS, SHA-256 verified by the SDK |
| Export | Only where the user sends it | Explicit user action |
