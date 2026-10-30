# 06. Network Dependency Disclosure

## 1. Compliance Statement

> **Judging Requirement**:  
> *"A clear list of any features that still need a network. Do not include private customer data, passwords, API keys or wallet secrets."*

LunaPredict adheres strictly to the **Local-First, Zero-Cloud** architecture. The table below provides an exhaustive audit of all features and their network dependencies.

---

## 2. Feature-by-Feature Network Audit

| Feature | Runs 100% Offline? | Network Usage Details | Fallback When Offline |
|---|---|---|---|
| **Cycle & Period Prediction Engine** | **YES** | **Zero network.** All statistical and late-period cycle calculations run locally via mathematical domain algorithms. | Full native functionality. |
| **Symptom & Mood Logging** | **YES** | **Zero network.** Encrypted SQLite / local AsyncStorage persistence on the device. | Full native functionality. |
| **Interactive Calendar & Day Inspector** | **YES** | **Zero network.** 6-month prediction horizon, Wilcox conception curves, and STRAW+10 heat staging computed locally. | Full native functionality. |
| **QVAC Local AI Health Coach (MedPsy)** | **YES** | **Zero network.** Model weights reside in local application storage; inference runs via local llama.cpp C++ binaries on the CPU/GPU. | **Core Feature**: Operates completely in Airplane Mode. |
| **Voice Logging & Transcription (Whisper)** | **YES** | **Zero network.** In-memory ASR audio transcription via local GGML Whisper engine. | Full native functionality. |
| **WDK Local Key Derivation & Vault** | **YES** | **Zero network.** BIP-39 mnemonic generation and AES-256 secure storage use Android hardware Keystore. | Full native functionality. |
| **One-Time Model Weights Download** | NO | **One-time HTTP/HTTPS download** from Hugging Face / QVAC model hub during initial setup (~1.28 GB). | Once downloaded and SHA-256 verified, network is never contacted again. |
| **P2P Partner Swarm Discovery** | NO | Requires **local Wi-Fi or Internet** to announce and find DHT peers via Hyperswarm. | If offline or in demo mode, falls back gracefully to synthetic local sync with clear badge. |
| **On-Chain WDK Balance Broadcast** | NO | Requires **Internet** to query public testnet/mainnet node for live blockchain state. | Offline mode uses locally tracked spend ledger and cached state. |

---

## 3. Data Privacy & Secrets Disclosure

LunaPredict maintains absolute confidentiality:
- **Zero Centralized User Database**: We run no backends, no Firebase user accounts, no Supabase instances, and no telemetry analytics.
- **Zero Third-Party Cloud AI APIs**: The app contains no API keys for OpenAI, Anthropic, Gemini, or AWS Bedrock.
- **No Embedded Private Keys or Passwords**: Mnemonic seed phrases are generated on the fly on the user's phone and stored exclusively in the user's private OS SecureStore.
- **No Private Health Data Exfiltration**: Health logs and period dates are strictly inaccessible to anyone other than the user and their explicitly paired partner device.

