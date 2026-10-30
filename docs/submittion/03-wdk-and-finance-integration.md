# 03. Tether WDK & Finance Integration

## 1. Role of WDK in LunaPredict

LunaPredict takes a strict stance on user privacy and AI monetization:
- **Local On-Device AI is 100% Free & Perpetual**: Running MedPsy on your own smartphone processor incurs zero subscription fees, zero token fees, and zero paywalls.
- **Tether WDK (Wallet Development Kit) Powers Optional Delegated Compute**:
  If a user has a budget smartphone that cannot fit larger models (such as MedPsy 4B or complex multi-turn medical diagnostics), they can opt to delegate queries to either:
  1. Their own paired home desktop (free, private P2P).
  2. The decentralized QVAC compute network.

When delegating to the compute network, the prompt is anonymized, and inference is settled **per token** in USDt via Tether's WDK.

---

## 2. Non-Custodial Architecture & Cryptography

LunaPredict implements a self-custodial wallet directly on the handset using cryptographic primitives aligned with Tether WDK:

* **Entropy & Mnemonic Generation**:
  - Generated using `expo-crypto` secure random bytes (`Crypto.getRandomBytesAsync`).
  - Implements 12-word BIP-39 mnemonic phrase generation.
  - Generates a deterministic Ethereum-compatible address (`0x...`) via SHA-256 derivation.
* **Encrypted Hardware Vault**:
  - The mnemonic seed phrase is stored exclusively in hardware-backed secure storage via `expo-secure-store` ([`SecureVault.ts`](file:///c:/Users/Antony%20Dev/Desktop/qvac-tether/lunapredict-mobile/src/storage/SecureVault.ts)).
  - It is never stored in standard unencrypted AsyncStorage, never synced to cloud backups, and never accessible to the UI without explicit user authorization.
* **Network Environments**:
  - Supports instant toggling between **Testnet** (pre-seeded with 5.00 USDt for immediate judge testing) and **Mainnet**.

---

## 3. Pay-Per-Token Micropayment Settlement

* **Rate**: `0.0001 USDt` per token.
* A comprehensive medical answer (~300 tokens) costs approximately `$0.03 USDt`.
* **Real-time Deduction**:
  When a delegated compute session runs, tokens stream back over the transport while the WDK service records transaction micro-deductions and updates wallet balance listeners in real time.
* **Transaction History**:
  Every deduction records the timestamp, token count, USDt total, and simulated on-chain transaction hash (`0x...`).

---

## 4. Code Files Implementing WDK

* **[`src/services/WdkService.ts`](file:///c:/Users/Antony%20Dev/Desktop/qvac-tether/lunapredict-mobile/src/services/WdkService.ts)**:
  - Core WDK singleton service: handles wallet generation, balance tracking, spending deductions, transaction logging, and state persistence.
* **[`src/storage/SecureVault.ts`](file:///c:/Users/Antony%20Dev/Desktop/qvac-tether/lunapredict-mobile/src/storage/SecureVault.ts)**:
  - Hardware-backed keychain interface storing the user's secret mnemonic.
* **[`src/screens/WalletScreen.tsx`](file:///c:/Users/Antony%20Dev/Desktop/qvac-tether/lunapredict-mobile/src/screens/WalletScreen.tsx)**:
  - Full-featured wallet interface: displays real-time USDt balance, 12-word seed phrase reveal with security warnings, deposit address QR/clipboard copy, network switcher (Testnet / Mainnet), and transaction ledger.

