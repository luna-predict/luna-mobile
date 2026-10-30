# LunaPredict 🌙 — Private, On-Device Women's Health Intelligence

[![DoraHacks AI Yako](https://img.shields.io/badge/DoraHacks-AI%20Yako-FF6F00?style=for-the-badge)](https://dorahacks.io/hackathon/tether-developers-cup/detail)
[![QVAC Local AI](https://img.shields.io/badge/Local%20AI-QVAC%20MedPsy-14B8A6?style=for-the-badge)](https://docs.qvac.tether.io/)
[![Pears P2P](https://img.shields.io/badge/P2P%20Sync-Holepunch%20Pears-3B82F6?style=for-the-badge)](https://docs.pears.com/)
[![Tether WDK](https://img.shields.io/badge/Wallet-Tether%20WDK-22C55E?style=for-the-badge)](https://docs.wdk.tether.io/)
[![Live Landing Page](https://img.shields.io/badge/Web-lunapredict.vercel.app-F43F5E?style=for-the-badge)](https://lunapredict.vercel.app)

> **Repository**: [https://github.com/luna-predict/luna-mobile](https://github.com/luna-predict/luna-mobile)  
> **Landing Page & Web App**: [https://lunapredict.vercel.app](https://lunapredict.vercel.app) · [Frontend Repository](https://github.com/luna-predict/luna-frontend)  
> **Direct Android APK Download**: [Download .apk (EAS Build Artifact)](https://expo.dev/artifacts/eas/meXHMV7QVRx8dwxa-R1e1JmdGk9iQFJe9oY4rJB2PMs.apk)  
> **EAS Production Build Dashboard**: [Expo EAS Build #78506a43](https://expo.dev/accounts/degen90/projects/lunapredict-mobile/builds/78506a43-556d-4b38-9eb9-8303f648855e)  
> **Official Demo Walkthrough**: [Watch on YouTube](https://www.youtube.com/watch?v=NQ4eVRe_TWQ)

---

## 🌟 Overview & Core Ethos

**LunaPredict** is a private, sovereign women’s health intelligence and cycle tracking application engineered for the **DoraHacks: AI Yako Hackathon** (Tether & QVAC).

Unlike traditional reproductive health trackers (such as Flo or Clue) that harvest, serialize, and monetize intimate bodily data on central cloud databases, **LunaPredict operates 100% on-device**:
1. **Zero Cloud Telemetry**: All cycle predictions, symptoms, moods, and intimate journal notes remain encrypted inside on-device SQLite storage.
2. **Offline Clinical AI**: Powered by Tether's **QVAC SDK** with quantized **MedPsy 1.7B & 4B GGUF** foundation models running locally via ARM NEON / OpenCL on your phone's processor.
3. **Decentralized Partner Sharing**: Partner synchronization uses the **Holepunch / Pears** stack (Hyperswarm DHT + Hypercore logs + Noise-protocol E2EE) — connecting two devices directly across the world with **zero intermediate servers**.
4. **African Local Languages**: Native multi-lingual health coaching featuring **Swahili** maternal guidance via `TranslatePsy`, breaking digital and health literacy barriers.
5. **Non-Custodial WDK Wallet**: Integrated Tether **WDK** wallet for sovereign pay-per-token micropayments (0.0001 USDt/token) only if users explicitly opt into heavy delegated desktop compute.

---

## 📑 Official Submission Package (`docs/submittion/`)

The detailed audit trails, architecture blueprints, clinical algorithm formulas, and compliance documents are located in [`docs/submittion/`](./docs/submittion/):

| Document | Description & Key Contents |
| :--- | :--- |
| [**01. Project Overview & Track Selection**](./docs/submittion/01-project-overview-and-tracks.md) | Problem analysis, target user personas, market surveillance risks, and hackathon track mapping. |
| [**02. QVAC Integration & Offline AI**](./docs/submittion/02-qvac-integration-and-offline-ai.md) | `@qvac/sdk` integration, runtime RAM detection, MedPsy 1.7B/4B GGUF quantization, and offline inference verification. |
| [**03. WDK & Finance Integration**](./docs/submittion/03-wdk-and-finance-integration.md) | Non-custodial BIP-39 wallet derivation, testnet balance management, and micropayment settlement for compute. |
| [**04. Hardware Specs & Memory Limits**](./docs/submittion/04-device-specs-and-hardware-limits.md) | Tested phone hardware (Galaxy S24 / Android 14+), memory budgets, OpenCL GPU offloading, and model weights licensing. |
| [**05. Offline Demo & Video Guide**](./docs/submittion/05-offline-demo-and-video-guide.md) | Step-by-step airplane-mode demonstration script, video timeline, and reproducible prompt showcase. |
| [**06. Network Dependency Disclosure**](./docs/submittion/06-network-dependency-disclosure.md) | Complete network boundary disclosure (zero runtime network dependency for tracking and local AI). |
| [**07. Repository Setup, Build & Attributions**](./docs/submittion/07-repository-setup-and-attribution.md) | Detailed build from source instructions, dependency manifest, authored code inventory, and third-party credits. |
| [**08. African Languages & P2P Deep Dive**](./docs/submittion/08-african-languages-and-p2p-deepdive.md) | Deep dive on the Swahili maternal model pipeline (`TranslatePsy`), Holepunch BareKit IPC, and commit audit. |

---

## 🛠️ How to Reproduce & Build From Source

Follow these instructions to verify tests, run locally in a development environment, or build the production Android APK.

### 1. Prerequisites
- **Node.js**: `v20.x` or `v24.x` (verified on Node v24.11.1)
- **Package Manager**: `npm` (v10+)
- **Git** installed and configured
- **Expo CLI**: `npm install -g eas-cli`
- **Android Device or Emulator**: Android 8.0 (API 26) through Android 15 (ARM64 device recommended for on-device GGUF execution)

### 2. Clone & Install Dependencies
```bash
# Clone the mobile repository
git clone https://github.com/luna-predict/luna-mobile.git
cd luna-mobile

# Install exact npm dependencies
npm install
```

### 3. Run Automated Tests
LunaPredict features 72 comprehensive automated unit and domain tests covering cycle mathematics, Wilcox fertility calculations, P2P sync protocols, and AI prompt safety guardrails:

```bash
# Run the complete test suite
npm test -- --passWithNoTests
```

### 4. Start Local Development Bundler
```bash
# Start Metro bundler with Expo
npm start
```
* Press `a` to open in a connected Android device or emulator.
* Scan the Metro QR code using your Android test build.

### 5. Build Standalone Android APK (EAS Build)
To produce a standalone `.apk` directly installable on any Android device without development tools:

```bash
# Authenticate with EAS (if not logged in)
npx eas-cli login

# Build standalone Android preview APK
npx eas-cli build -p android --profile preview
```

#### 📦 Download Verified Standalone APK
Rather than building locally from source, you can directly download and install the pre-compiled Android release build:
- **Direct APK Download**: [Download .apk (EAS Build #78506a43)](https://expo.dev/artifacts/eas/meXHMV7QVRx8dwxa-R1e1JmdGk9iQFJe9oY4rJB2PMs.apk)
- **EAS Build Console**: [Expo EAS Build #78506a43-556d-4b38-9eb9-8303f648855e](https://expo.dev/accounts/degen90/projects/lunapredict-mobile/builds/78506a43-556d-4b38-9eb9-8303f648855e)
- **Interactive Web App & Details**: [lunapredict.vercel.app](https://lunapredict.vercel.app)

The resulting standalone signed APK can be sideloaded directly onto any Android phone.

---

## 🔬 Four Clinical Tracking Modes

LunaPredict adapts dynamically across four fundamental reproductive life seasons:

```
┌─────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐   ┌───────────────────────────┐
│ Track My Cycle  │   │  Conceive (Certainty)│   │  Follow Pregnancy    │   │  Navigate Perimenopause   │
│ 6-cycle forward │   │  Wilcox probability  │   │  Gestational weeks   │   │  STRAW+10 staging         │
│ quick-flow log  │   │  OPK LH & BBT chart  │   │  kick counter, timer │   │  hot flash & night sweats │
└─────────────────┘   └──────────────────────┘   └──────────────────────┘   └───────────────────────────┘
```

1. **Track My Cycle**:
   - 6-cycle forward prediction model accounting for personal cycle variation ($\mu \pm \sigma$).
   - Interactive one-tap quick flow for menstrual flow, spotting, cramps, and emotional state.
2. **Conceive with Certainty**:
   - Clinical Wilcox conception probability curves (peaking at 28% on O-1 and 24% on O-2).
   - LH surge detection with OPK ratio parsing and biphasic Basal Body Temperature (BBT) charting.
3. **Follow Pregnancy**:
   - Week-by-week gestational breakdown (e.g. `22w 3d`) with due-date countdown.
   - Clinical kick counter and 5-1-1 contraction timing rules.
4. **Navigate Perimenopause**:
   - STRAW+10 clinical staging for early/late menopausal transitions.
   - Severity and trigger logging for hot flashes, night sweats, and hormonal sleep disruption.

---

## 🤖 Offline AI Coach (QVAC MedPsy & Whisper)

* **Architecture**: The AI Coach runs directly on device via `@qvac/sdk` and `@qvac/fabric-android-arm64`.
* **Hardware Detection**: The [`ModelManager`](./src/services/ModelManager.ts) detects device RAM and hardware tiers:
  - Devices with $\le 6\text{ GB}$ RAM run `MedPsy 1.7B Q4_K_M`.
  - Flagship devices with $\ge 8\text{ GB}$ RAM load `MedPsy 4B Q4_K_M`.
* **Voice Flow**: Local speech-to-text using on-device GGML Whisper with complete recording controls (**Pause**, **Resume**, and **Cancel**).
* **Swahili Support**: Integrated with `TranslatePsy` to support maternal health questions in Swahili without sending voice or text queries over the internet.

---

## 🤝 Holepunch / Pears P2P Partner Sharing

* **Transport**: Direct peer-to-peer device discovery via **Hyperswarm DHT**.
* **Encryption**: End-to-end encrypted through the **Noise Protocol Framework**.
* **Zero Relay Servers**: Sync data replicates over append-only Hypercore logs directly between two phones.
* **Granular Sovereignty**: The user decides exactly what the partner sees (current phase, predictions, mood, symptoms). Personal diary notes **never** sync.

---

## 💰 Tether WDK Non-Custodial Wallet

* **Derivation**: 12-word BIP-39 mnemonic seed phrase generated and kept strictly in device hardware keystore.
* **Networks**: Seamless switching between USDt Sepolia testnet and production networks.
* **Micro-settlement**: Enables pay-per-token micropayments (0.0001 USDt/token) strictly for optional delegated compute tasks when users desire extra horsepower from larger desktop models.

---

## 📱 Project Directory Structure

```
lunapredict-mobile/
├── assets/                 # App icons, splash screens, vector crescent moon branding
├── docs/                   # Full documentation suite
│   ├── submittion/         # Official DoraHacks hackathon submission package (01-08)
│   └── PUBLISHING.md       # Google Play Store & iOS App Store roadmap
├── src/
│   ├── ai/                 # QVAC engine, MedPsy prompt builders, Whisper voice
│   ├── context/            # AppContext state (cycle state, user profile, partner sync)
│   ├── domain/             # Clinical algorithms: 6-cycle, Wilcox conception, STRAW+10
│   ├── navigation/         # Women's & Men's navigation hierarchies
│   ├── screens/            # Dashboard, Calendar, QuickLog, Coach, Partner, Wallet, Models
│   ├── screens/men/        # Men's Companion Mode: read-only partner dashboard & check-in
│   ├── services/           # PearsTransport, Holepunch BareKit bundle, WdkService, ModelManager
│   └── ui/                 # Design tokens, theme colors, accessible contrast components
├── __tests__/              # 72 automated Jest test suites
├── app.json                # Expo config & native Android permissions
├── package.json            # Pinned dependencies
└── tsconfig.json           # Strict TypeScript configuration
```

---

## ⚖️ License & Attribution

- **License**: MIT License — see [LICENSE](./LICENSE).
- **Attribution**: Built with Tether QVAC, Holepunch Pears, and Tether WDK for the Tether Developers Cup · AI Yako.

