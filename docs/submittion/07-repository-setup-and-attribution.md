# 07. Repository Setup, Build & Attributions

## 1. Source Code Repository & Setup Instructions

* **Repository Structure**:
  - `lunapredict-mobile/`: Expo / React Native mobile client (Android & iOS).
  - `lunapredict-mobile/src/ai/`: QVAC inference engine, prompt builders, catalog registry, and voice input.
  - `lunapredict-mobile/src/services/`: Pears P2P transport, Holepunch worklet bundle, WDK wallet service, model manager.
  - `lunapredict-mobile/src/domain/`: Clinical cycle prediction algorithms, pregnancy calculations, STRAW+10 perimenopause staging, and conception statistics.
  - `lunapredict-mobile/__tests__/`: 72 automated test suites covering AI coach, calendar, cycle domain, P2P sync, and storage migrations.

### Prerequisites:
- **Node.js**: v20+ or v24 (tested on Node v24.11.1)
- **Package Manager**: npm or yarn
- **Expo CLI**: `npm install -g eas-cli`
- **Android SDK** (optional for local builds): Android SDK 34 / NDK 26+

### Installation & Test Commands:
```bash
# 1. Clone repository
git clone <YOUR_REPO_URL>
cd lunapredict-mobile

# 2. Install dependencies
npm install

# 3. Run full automated test suite (72 tests, 9 suites)
npm test -- --passWithNoTests

# 4. Start Metro bundler (for dev client or USB device)
npm start
```

### Building the Standalone Android APK (EAS):
```bash
# Generate the preview/internal standalone APK for direct installation
eas build -p android --profile preview
```

---

## 2. What Was Built During the Hackathon

The following components and architectures were designed, coded, and verified during the event:

1. **QVAC On-Device AI Engine Integration**:
   - Integrated `@qvac/sdk@0.22.0`, `@qvac/fabric-android-arm64`, and `@qvac/asr-ggml-android-arm64`.
   - Built [`QvacEngine.ts`](file:///c:/Users/Antony%20Dev/Desktop/qvac-tether/lunapredict-mobile/src/ai/engine/QvacEngine.ts) with real-time token streaming, thinking state capture, and request abort controllers.
   - Built [`ModelManager.ts`](file:///c:/Users/Antony%20Dev/Desktop/qvac-tether/lunapredict-mobile/src/services/ModelManager.ts) with hardware capability detection, RAM budgeting, and SHA-256 verified download resumption.
   - Designed [`PromptBuilder.ts`](file:///c:/Users/Antony%20Dev/Desktop/qvac-tether/lunapredict-mobile/src/ai/coach/PromptBuilder.ts) with deterministic clinical triage guardrails and symptom context injection.
2. **Pears P2P Partner Sharing Transport**:
   - Created [`pears-worklet.bundle.ts`](file:///c:/Users/Antony%20Dev/Desktop/qvac-tether/lunapredict-mobile/src/services/pears-worklet.bundle.ts) embedding Hyperswarm DHT discovery, Corestore, and Hypercore replication inside a native BareKit worklet.
   - Engineered [`PearsTransport.ts`](file:///c:/Users/Antony%20Dev/Desktop/qvac-tether/lunapredict-mobile/src/services/PearsTransport.ts) with binary typed-array IPC streaming bridge and automatic error recovery.
   - Created the Men’s Partner Mode dashboard ([`PartnerDashboardScreen.tsx`](file:///c:/Users/Antony%20Dev/Desktop/qvac-tether/lunapredict-mobile/src/screens/men/PartnerDashboardScreen.tsx)) with phase-aware empathy guidance.
3. **Tether WDK Non-Custodial Wallet**:
   - Built [`WdkService.ts`](file:///c:/Users/Antony%20Dev/Desktop/qvac-tether/lunapredict-mobile/src/services/WdkService.ts) and [`WalletScreen.tsx`](file:///c:/Users/Antony%20Dev/Desktop/qvac-tether/lunapredict-mobile/src/screens/WalletScreen.tsx) with BIP-39 mnemonic generation, hardware-backed secure storage, testnet balance funding, and pay-per-token settlement (0.0001 USDt/token).
4. **Clinical Domain Prediction Engines**:
   - Extended cycle engine to a 6-month prediction horizon with uncertainty bands ($\pm \sigma$).
   - Integrated Wilcox et al. 1995 clinical conception probabilities.
   - Implemented STRAW+10 clinical staging for perimenopause.
   - Added gestational milestone markers (14w, 20w, 28w, 37w, 40w) for pregnancy.
5. **Brand & Native Asset Design**:
   - Authored the custom vector crescent moon logo and synchronized adaptive icon mipmaps across all Android density targets.

---

## 3. Disclosures & Third-Party Attributions

* **Tether / QVAC SDK**: `@qvac/sdk`, `@qvac/fabric-android-arm64`, `@qvac/asr-ggml-android-arm64` — Apache-2.0.
* **Holepunch / Pears**: `react-native-bare-kit`, `hyperswarm`, `corestore`, `b4a` — Apache-2.0 / MIT.
* **Tether WDK Principles**: Non-custodial BIP-39 key derivation and USDt settlement architecture.
* **UI & Framework**: Expo SDK 57, React Native 0.86, React 19, Lucide Icons (`lucide-react-native`).
* **Clinical Algorithms**:
  - Conception curve based on Wilcox, Weinberg, & Baird (1995), *New England Journal of Medicine*.
  - Perimenopause staging based on the Stages of Reproductive Aging Workshop (STRAW+10).

