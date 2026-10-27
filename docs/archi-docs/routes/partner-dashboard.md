# Route: Partner dashboard (partners, tab 1)

**File:** [PartnerDashboardScreen.tsx](../../../src/screens/men/PartnerDashboardScreen.tsx)

## Purpose
Show the partner what she chose to share, plus a concrete "how to support her today" tip.

## Reads
`PartnerLink` and the latest `SharedSnapshot` (fetched on focus and on pull-to-refresh).

## Layout
- Not linked → code entry + "Pair devices".
- Linked → name, phase card (or 🔒 "not shared"), stats (days to period, fertile window) if
  shared, mood/energy/symptoms if shared, a support tip for the phase (`partnerTip`), and a
  "Your own wellness" card linking to Check-In.
- Footer: last updated time **of the snapshot** (not of the fetch).

## Status today
- ✅ Renders each field only if present, shows lock states, pull to refresh.
- 🧪 **On a second phone, the data is invented.** `fetchSnapshot` builds a "deterministic demo snapshot" from the pairing topic hash when no local snapshot exists ([PearsPartnerService.ts:166](../../../src/services/PearsPartnerService.ts#L166)). Real data only appears when both roles run on the **same** device.
- ⚠️ "P2P SYNCED" badge on invented data.
- ⚠️ `lastSyncAt` is set to "now" on every fetch, so "updated just now" shows even for stale data.

## Target
- Until real sync: a clear **"Demo data — real sync coming soon"** banner whenever the snapshot is synthetic (add `synthetic: true` to the snapshot type).
- After real sync: show snapshot `updatedAt` ("Updated 2 h ago"), and an offline state ("Can't reach her phone; showing data from yesterday").
- Stale guard: hide mood/symptoms older than 2 days.

## Acceptance
- Two phones, before Pears: partner dashboard shows the Demo banner, and the badge doesn't say "synced".
- After Pears: values match phone A's Dashboard (phase, days to period) within one sync.
