# 9. Build and Test on Your Phone

The real on-device AI (QVAC) needs native code, so it runs in an **installed LunaPredict build**,
not in Expo Go. Expo Go still works for UI testing, with the coach in labelled **Demo mode**.

## 9.1 One-time setup (Windows is fine — builds run in the cloud)

```powershell
npm install -g eas-cli
eas login                      # your Expo account (the project is already linked in app.json)
```

The phone must be a **real Android phone** (QVAC/llama.cpp doesn't run on emulators), Android 10+
(minSdk 29), 64-bit (arm64). Allow "install unknown apps" for your browser or file manager.

## 9.2 Build the development APK (recommended for testing)

```powershell
cd lunapredict-mobile
npm run build:dev              # = eas build --profile development --platform android
```

- The first build takes ~20–40 min on EAS. During prebuild the QVAC plugin bundles the worker and
  adds the native QVAC packages (`installMissingPrebuilds`), so the build needs network access (EAS has it).
- When it finishes, EAS shows a QR code / link. Open it on the phone and install the APK.
- Then on your computer: `npx expo start --dev-client` and open the app on the phone. JS changes
  hot-reload; you only rebuild when native packages change.

For a shareable build without the dev menu: `npm run build:apk` (preview profile).

## 9.3 First run on the phone

1. Onboard (pick English or Kiswahili).
2. Profile → AI models → **Download MedPsy 1.7B (1.28 GB)** on Wi-Fi. The header should say
   "Runs on this phone with QVAC" and models show "Fits this phone".
3. Tap **Warm up** to load it into memory (the Diagnostics card shows the load time).
4. Optional: download **Kiswahili pack** (641 MB) and **Voice input** (252 MB).

## 9.4 What to test (short list — full checklist in [06 §6.4](06-testing-and-e2e.md#64-on-phone-end-to-end-checklist))

| # | Do | Expect |
|---|---|---|
| 1 | Airplane mode ON → Luna tab → "Why am I so tired?" | "Thinking…" then a streamed answer that mentions your logged data. Header: "MedPsy 1.7B · on-device, offline" |
| 2 | Ask "When is my next period?" | Same date/range as the Today screen |
| 3 | Ask "I have chest pain" | Red Safety card with **Call 999**, no AI answer |
| 4 | Tap **Stop** mid-answer | Stops within ~1 s, bubble marked "Stopped" |
| 5 | Language → SW, ask "Kwa nini nimechoka sana?" | Answer in Kiswahili with "Machine-translated · Show English" |
| 6 | Mic → speak a question | Text appears in the box; send it |
| 7 | Log → mic → "light flow and cramps, low energy" | Form pre-filled; nothing saved until you tap Save |
| 8 | Calendar → a day 2 weeks ago → **Period started** | Today screen recomputes; badge moves from "From onboarding" to "Learning" |
| 9 | Models → Download → kill the app at ~30% → reopen | Shows "Paused", **Resume** continues |
| 10 | Profile → Delete all data (keep models) → onboard again | No old wallet/partner; MedPsy still downloaded |

Note the Diagnostics numbers (load time, tokens/s, time to first word) — they decide whether
`reasoning_budget: 0` is the right default ([04 §4.8](04-local-ai-qvac.md#48-thinking-the-biggest-speed-risk)).

## 9.5 If something fails

| Symptom | Likely cause | Fix |
|---|---|---|
| Coach says "Demo mode" in the installed app | QVAC worker bundle missing | Rebuild; check the EAS prebuild log for `QVAC: ... generating tree-shaken bundle` |
| Build fails in `react-native-bare-kit` | SDK 57 / RN 0.86 compatibility (the QVAC Expo guide targets SDK 54) | See [04 §4.9](04-local-ai-qvac.md#49-expo--native-setup) options; report the log |
| Download stuck at 0% | Registry/Hugging Face unreachable | Check connection; Retry |
| "Not enough free memory" | Phone RAM | Use **Quick answers (Qwen3 0.6B)** on the Models screen |
| Voice: "Could not transcribe" | FFmpeg decoder or mic format | Report; voice uses m4a → QVAC's bundled audio decoder |

## 9.6 Automated checks (run before every build)

```powershell
npm run typecheck   # TypeScript
npm test            # Jest: tracking vectors, migration, safety triage, prompts, voice extraction, whole-app smoke tests
```
