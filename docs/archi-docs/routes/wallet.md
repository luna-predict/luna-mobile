# Route: Wallet (women, stack) — labs in v1

**File:** [WalletScreen.tsx](../../../src/screens/WalletScreen.tsx) · Service: [WdkService.ts](../../../src/services/WdkService.ts)

## Purpose (original)
A non-custodial Tether WDK wallet to pay public compute nodes per token (Tier 3 inference).

## Why it moves behind `labs` in v1
There is no real paid compute network for it to pay (see [04 §4.14](../04-local-ai-qvac.md#414-p2p-tiers-desktop--network)).
A wallet that only spends fake balance on fake peers, next to a real on-device AI, makes the whole
app look simulated. Keep the screen for demos behind a Profile → Labs switch.

## Status today
- 🧪 Balances, faucet top-ups and stream payments are local numbers.
- ⚠️ **Security:** the mnemonic is stored in plain AsyncStorage (`luna:wallet`). Move it to `expo-secure-store` now, even in labs.
- ⚠️ The mnemonic isn't BIP39: a 260-word list, so phrases won't import into any real wallet, and "import" accepts any 12 words.
- ⚠️ The address is the first 40 hex characters of SHA-256(mnemonic), not a real derived address.
- ✅ Seed reveal is gated behind a confirm; copy warns to clear the clipboard.

## Target (when a real network exists, P6)
- WDK secret manager for BIP39 generation and storage; real chain module (testnet first) for address and balance.
- Payment channel per compute session, with a spending cap set by the user before the session.
- Wallet and compute payments are visible only when Tier 3 is enabled.

## Acceptance (v1)
- Labs off → no Wallet row in Profile; no wallet chip in the Coach.
- Labs on → wallet works as today; the mnemonic is read from SecureStore (not visible in an AsyncStorage dump).
