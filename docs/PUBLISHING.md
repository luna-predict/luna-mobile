# Publishing Luna to the App Stores

Luna sits in an unusually tricky spot for store review: it's a **reproductive/health-data app** (extra scrutiny on both stores) *and* it has a **non-custodial crypto wallet** built in (extra scrutiny on both stores, for different reasons). Neither alone is a blocker — plenty of period trackers and plenty of wallets ship fine — but the *combination*, plus Luna's P2P payment model, needs a real plan, not just "hit submit." This doc is that plan.

The short version: **Android first.** Google Play's path is more forgiving for a project at this stage; Apple's is more forgiving on health data but genuinely restrictive on how a wallet is allowed to unlock app functionality — which is close to what Luna's pay-per-token delegation does today. Read the "The crypto problem" section before doing anything else on iOS.

---

## 1. Why this app is harder than average to publish

### 1a. It's a health app
- Both stores classify menstrual/fertility/pregnancy tracking as **sensitive health data** and require extra declarations (Google's Health apps form + Data Safety section; Apple's health-app privacy rules and, as of March 2026, a **medical device status disclosure** for any app categorized Health & Fitness/Medical *or* that references medical/treatment information in the age-rating questionnaire — Luna's AI Coach almost certainly triggers the latter). [Source](https://9to5mac.com/2026/03/26/new-app-store-policy-requires-medical-device-disclosures-for-some-health-apps/)
- Good news: Luna's actual architecture — no server, no cloud storage, on-device AI — is a genuine strength here, not just marketing copy. Most period-tracker store rejections and post-*Dobbs* controversy (Flo, others) were about **where data goes**, which is the one problem Luna doesn't have. Say this explicitly in review notes (see §5).

### 1b. It has a crypto wallet
- **Google Play**: as of October 29, 2025, any app with wallet functionality must complete the **Financial Features declaration** in Play Console. In 15 jurisdictions (all EU member states, UK, Canada, Japan, South Korea, Switzerland, and others) a software wallet additionally needs actual regulatory licensing/registration to stay listed. [Source](https://support.google.com/googleplay/android-developer/answer/16329703)
- **Apple**: wallet apps are allowed under Guideline 3.1.5(b) — **but only for developers enrolled as an Organization account** (not Individual), and critically: *"Apps may not use their own mechanisms to unlock content or functionality, such as... cryptocurrencies and cryptocurrency wallets."* [Source](https://developer.apple.com/forums/thread/719799)

### 1c. The crypto problem, specifically
Luna's Tier 3 delegated inference spends WDK tokens to unlock access to a bigger AI model on the public compute network. Read literally, that's "using a cryptocurrency wallet to unlock functionality" — the exact pattern Apple's guideline calls out. This is the single biggest open risk for an iOS submission and needs a decision before you submit, not after a rejection. Options, roughly ranked by how much they cost you:

| Option | What it means | Tradeoff |
|---|---|---|
| **Ship iOS without Tier 3** | Local AI (QVAC) and Tier 2 (your own paired desktop) work fully; the public-network paid tier is Android-only, or web-only via the landing page's future account portal | Cleanest compliance path. Loses the "pay-per-token" story on iOS, but that's arguably your least-differentiating tier anyway — local AI and Partner Mode are the real pitch |
| **Argue it's a marketplace, not unlocked content** | Frame Tier 3 as facilitating payment to independent third-party compute node operators for a real-world service (compute), not unlocking in-app content — closer to how ride-share apps handle payment | Legally plausible but not guaranteed; Apple reviewers interpret this guideline inconsistently. Expect back-and-forth in review, possibly a rejection-then-appeal cycle |
| **Full compliance** | Enroll as an Apple Developer *Organization* (not Individual — needs a D-U-N-S number and a real legal entity), and structure Tier 3 so it clearly doesn't gate any app feature | Most defensible, most setup work, assumes you're incorporating anyway |

**Recommendation for a first submission:** ship iOS with Tier 3 disabled (feature-flag it off in the iOS build), keep Android full-featured. Revisit once there's a legal entity behind the project.

### 1d. Encryption export compliance (both stores, easy to miss)
Luna uses the Noise protocol (via Pears) for P2P encryption and standard crypto for the wallet. Both stores ask about encryption at submission:
- **Apple**: set `ios.infoPlist.ITSAppUsesNonExemptEncryption` in `app.json`. Standard encryption used for authentication/data protection (which is what Noise + the wallet's key handling amount to) usually qualifies for the **exempt** self-classification — but confirm against the current [export compliance guidance](https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations) before submitting; getting this wrong just adds a review question, it doesn't sink the app.
- **Google Play**: no separate declaration needed for standard TLS/Noise-class encryption, but note it in the Data Safety form's security practices section anyway.

---

## 2. Prerequisites checklist (do these before either store)

- [ ] **Privacy policy**, hosted at a real, public, non-geofenced URL (no PDF) — required by both stores, and doubly required for health apps. This should live on the landing page (`luna-landing`) at something like `/privacy`, since "no server, no data collection" is genuinely easy to write honestly here.
- [ ] **Terms of use** — not strictly required by Apple unless you use auto-renewing subscriptions (you don't, currently), but Google increasingly expects one for financial-feature apps.
- [ ] **Support URL / support email** — required by both stores. Can just be a `mailto:` or a page on the landing site.
- [ ] **App icon** at required resolutions (Expo/EAS handles most of the resizing from your existing `assets/icon.png`, but verify against each store's exact spec).
- [ ] **Screenshots** per required device sizes — you already have the shot list in `luna-landing/ASSETS.md`; the same captures mostly cover store listing requirements, just at different exact dimensions.
- [ ] **Store description copy, keywords, category** — draw directly from `pitch/SUBMISSION.md` and the landing page's `content.ts`; don't write this from scratch.
- [ ] **Age rating questionnaire answers decided in advance** — specifically how you answer the medical/treatment-information and sexual-content-adjacent questions (period/fertility topics), since this is what now triggers Apple's medical device disclosure requirement. Decide the honest answer, then write the disclosure to match.
- [ ] **Google Service Account key** (JSON) for EAS Submit to Android — generated in Google Cloud Console, linked to your Play Console account.
- [ ] **Apple Developer Program enrollment** — Individual is fine *unless* you keep the wallet in the iOS build, in which case it must be Organization (see §1c).

---

## 3. Building and submitting via EAS

You already have `eas.json` configured with a `preview` profile (APK, for direct install — see the main README) and a `production` profile (AAB, for Play Store). Add iOS and submit profiles:

```jsonc
// eas.json — add alongside the existing "preview"/"production" build profiles
{
  "build": {
    "production": {
      "autoIncrement": true,
      "android": { "buildType": "app-bundle" },
      "ios": { "autoIncrement": true }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      },
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "your-app-store-connect-app-id"
      }
    }
  }
}
```

Then:

```bash
# Android — build the AAB, then submit to Play Console's internal testing track
eas build --platform android --profile production
eas submit --platform android --profile production

# iOS — build the .ipa, then submit to App Store Connect / TestFlight
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

`eas submit` uploads the binary and puts it in the respective console for you to finish store-listing metadata and press "submit for review" — it doesn't skip human review on either platform. [Source](https://docs.expo.dev/submit/introduction/)

---

## 4. Google Play — specific steps

1. **Create the app** in [Play Console](https://play.google.com/console) ($25 one-time registration fee, verify current pricing).
2. **Complete the Health apps declaration form** — required specifically because Luna tracks menstrual/fertility/pregnancy data. [Source](https://support.google.com/googleplay/android-developer/answer/16679511)
3. **Complete the Data Safety section** — for Luna this is a genuinely easy form to fill out honestly: no data collected, nothing shared with third parties, everything stored on-device, P2P sync is end-to-end encrypted device-to-device. Lead with this in your listing, it's a real differentiator against Flo/Clue-style competitors.
4. **Complete the Financial Features declaration** — declare the WDK wallet as a software wallet. Review the [15-jurisdiction licensing list](https://support.google.com/googleplay/android-developer/answer/16329703); if you're not licensed in those regions, either exclude them from your app's country availability or disable the wallet feature for those regions via a remote config flag.
5. **Set `minSdkVersion`** appropriately — Expo SDK 57 / RN 0.85 requires a reasonably modern Android baseline; confirm the exact minimum in `app.json` once you run `expo prebuild`, and note it in your store listing's device compatibility.
6. **Internal testing track first.** Upload the AAB to "Internal testing," add yourself and a few testers by email, verify the install/update flow works, *then* promote to Production. This is also where you catch Data Safety form mismatches before a real review.
7. **Submit for review.** Google's review is typically faster than Apple's (often under 24–48 hours for straightforward apps, longer for apps with financial-features or health declarations attached — budget a week to be safe).

---

## 5. Apple App Store — specific steps

1. **Enroll in the Apple Developer Program** ($99/year, verify current pricing) — as an **Organization** if shipping the wallet on iOS (see §1c), Individual if you disable Tier 3 for the iOS build.
2. **Create the app** in [App Store Connect](https://appstoreconnect.apple.com).
3. **Fill the Age Rating questionnaire carefully.** Answer honestly about medical/treatment information references (the Coach) and mature/health-adjacent themes (fertility, pregnancy). This determines whether the new medical device disclosure requirement applies.
4. **If it applies: state medical device status clearly** — Luna is *not* an FDA-regulated medical device; it's a wellness/tracking tool with an informational AI coach, not a diagnostic tool. Say so explicitly, and make sure in-app copy (the Coach's disclaimers, already present in the mobile app's coach screens) backs that up.
5. **Set `ITSAppUsesNonExemptEncryption`** in `app.json`'s `ios.infoPlist` per §1d.
6. **TestFlight first.** Upload the build, add internal testers, verify the full onboarding → tracking → Coach → Partner Mode flow on a real device before external review. TestFlight builds also expire after 90 days, so don't sit on one too long before submitting for real review.
7. **Write review notes explicitly addressing the wallet.** In App Store Connect's "Notes for Review" field, proactively explain: what the wallet is for (paying independent compute nodes, not unlocking app content), that it's non-custodial (user holds their own keys), and — if you took the recommended path — that Tier 3 is disabled in this build entirely. Reviewers reject far more often when they have to *guess* what a crypto feature does than when it's explained upfront.
8. **Submit for review.** Apple's review is typically 24–48 hours but can run longer for apps flagged for financial or health features — budget 1–2 weeks for a first submission, since first-time health+crypto apps are more likely to get a clarifying-question round trip before approval.

---

## 6. Road to there — phased roadmap

| Phase | What | Depends on |
|---|---|---|
| **0. Foundations** | Privacy policy page, terms page, support contact, decide the iOS Tier 3 question, decide Apple account type | Nothing — do this first |
| **1. Android internal testing** | `eas build` production AAB, Play Console internal track, Health apps + Data Safety + Financial Features forms filled | Phase 0 |
| **2. Android production** | Promote internal → production track after internal testers confirm the app works end-to-end | Phase 1 clean |
| **3. iOS TestFlight** | `eas build` production IPA (Tier 3 disabled unless Organization account), App Store Connect setup, age rating questionnaire | Phase 0, Apple account enrolled |
| **4. iOS production** | Submit for review with explicit reviewer notes on the wallet; iterate on any clarifying questions | Phase 3 clean |
| **5. Post-launch** | Monitor both stores' crypto-policy pages for the 15-jurisdiction licensing deadlines (rolling through mid-2026) in case Luna's country availability needs to change | Ongoing |

Realistic timeline from "ready to start Phase 0" to "live on both stores": **2–4 weeks**, mostly gated by Apple's review round-trips on the health/crypto questions rather than any technical work.

---

## 7. Sources

- [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple Guideline 3.1.5(b) discussion — Apple Developer Forums](https://developer.apple.com/forums/thread/719799)
- [Apple medical device disclosure requirement (March 2026)](https://9to5mac.com/2026/03/26/new-app-store-policy-requires-medical-device-disclosures-for-some-health-apps/)
- [Apple encryption export compliance](https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations)
- [Google Play cryptocurrency exchanges and software wallets policy](https://support.google.com/googleplay/android-developer/answer/16329703)
- [Google Play Health Content and Services](https://support.google.com/googleplay/android-developer/answer/16679511)
- [Google Play Data Safety section](https://support.google.com/googleplay/android-developer/answer/10787469)
- [EAS Submit — Expo documentation](https://docs.expo.dev/submit/introduction/)
- [Configure EAS Submit with eas.json](https://docs.expo.dev/submit/eas-json/)
