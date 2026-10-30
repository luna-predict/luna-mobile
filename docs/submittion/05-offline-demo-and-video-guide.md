# 05. Offline Demo Script & Video Guide

## 1. Hackathon Offline AI Requirement

> **Judging Criteria Rule**:  
> *"The core QVAC AI feature must run with the internet switched off. Projects that rely on a cloud AI API for that feature are not eligible for prizes."*

To satisfy this requirement unequivocally, your demo video should follow this structured recording workflow.

---

## 2. Recommended Video Recording Flow (3-Minute Script)

### Segment 1: The Problem & Solution (0:00 – 0:35)
* **Visual**: Show the LunaPredict app opening to the Dashboard.
* **Voiceover**:  
  *"This is LunaPredict — private, on-device women’s health intelligence. Commercial apps like Flo and Clue store billions of cycles, symptoms, and pregnancies on central cloud servers where they can be subpoenaed, sold, or leaked. LunaPredict proves that women’s health apps don’t need a cloud backend: clinical predictions, P2P partner sharing, and natural language AI coaching all run directly on the phone."*

### Segment 2: Proof of Offline QVAC AI (0:35 – 1:30) **[CRITICAL PROOF]**
* **Action on Camera**:
  1. Swipe down the Android status bar.
  2. **Turn on Airplane Mode** (verify Wi-Fi is OFF, Mobile Data is OFF, and the airplane icon is visible in the status bar).
  3. Return to LunaPredict.
  4. Navigate to the **Luna Coach** tab.
  5. Tap the **Models** screen to show that `MedPsy 1.7B` is downloaded and loaded in RAM.
  6. Return to the chat and ask a realistic question:
     > *"I am in my luteal phase and having intense lower back cramps. What is happening and what helps?"*
  7. Show the response streaming back **token by token at 15–20 tokens/sec** with the internet completely disconnected.
  8. Point out the local thinking indicator, symptom context awareness, and clinical disclaimers.

### Segment 3: P2P Partner Sharing Over Pears (1:30 – 2:15)
* **Visual**: Navigate to the **Partner** tab.
* **Action**:
  1. Generate a pairing invite code (e.g. `k87d-4mpx-w29z`).
  2. Explain that device discovery and snapshot replication use the **Holepunch / Pears stack** (`hyperswarm` and `hypercore` inside a native BareKit worklet).
  3. Show the granular sharing controls: the woman can toggle cycle phase, predicted dates, mood, or symptoms independently.
  4. Switch to the Partner mode dashboard: the partner gets live guidance on how to support her during her exact phase, with zero intermediary servers.

### Segment 4: Tether WDK Non-Custodial Wallet (2:15 – 2:45)
* **Visual**: Open the **Wallet** tab.
* **Action**:
  1. Show the non-custodial USDt balance (pre-funded on Testnet).
  2. Reveal the 12-word BIP-39 mnemonic phrase stored in hardware-backed secure storage.
  3. Explain the pay-per-token settlement: local on-device AI is 100% free; WDK micro-billing (0.0001 USDt/token) is only utilized if the user chooses to delegate heavy tasks to a remote cluster.

### Segment 5: Conclusion (2:45 – 3:00)
* **Voiceover**:  
  *"LunaPredict is private health intelligence you actually own. Powered by QVAC, Pears, and Tether WDK. All source code and test suites are open source on GitHub."*

---

## 3. Checklist for Remote Judges & Reproducibility

To reproduce the offline demonstration independently:

1. Install the LunaPredict APK (`eas build -p android --profile preview` or direct install).
2. Open **Settings > Models** and download the `MedPsy 1.7B (Medical Q4_K_M)` model while on Wi-Fi.
3. Turn on **Airplane Mode** on your Android phone.
4. Open the **Coach** tab and send any query.
5. The local QVAC engine will initialize and stream responses with zero network packets transmitted.

