# Route: Models (stack)

**File:** [ModelsScreen.tsx](../../../src/screens/ModelsScreen.tsx) · Service: [ModelManager.ts](../../../src/services/ModelManager.ts) · Architecture: [04 §4.2–4.4](../04-local-ai-qvac.md#42-model-catalog-target)

## Purpose
Show what this phone can run, download and manage on-device models, and pick the active coach model.

## Layout
1. **Device card:** model name, RAM, free storage 🆕, engine (QVAC / Demo) 🆕.
2. **Models list** (LLMs only in v1): name, size, quality note, fit verdict (`likely-fits` /
   `too large` / `can't tell`), state control.
3. **Diagnostics** 🆕 (collapsed): last load time, tokens/s, time to first token, SDK version.

## Per-model control by state

| State | Control | Secondary |
|---|---|---|
| not_downloaded | **Download (1.3 GB)** | fit badge; mobile-data warning on tap |
| downloading | progress bar with MB / MB and speed | **Pause** |
| paused | progress bar | **Resume** · Delete partial |
| downloaded (inactive) | **Use for coach** | Delete |
| downloaded (active) | "Active" badge; **Warm up** (load now) | Delete |
| error | message | **Retry** |

## Status today
- 🧪 Download is a timer and loading is fake ([04 §4.1](../04-local-ai-qvac.md#41-today-vs-target)).
- ⚠️ Catalog sizes and quantizations don't match the real files (MedPsy 1.7B shows "Q4_0, 1.1 GB"; real Q4_K_M is 1.28 GB).
- ⚠️ RAM checks use a hard-coded table; `Device.totalMemory` ignores free memory. Replace with `assessModelFit`.
- ⚠️ Interrupted downloads reset to 0 on restart instead of resuming.
- ⚠️ Deleting the active model doesn't promote another LLM, and `LocalInference` still thinks it's loaded.
- ⚠️ Whisper and Bergamot can be "downloaded" but nothing uses them. Hide them.
- ⚠️ The "QVAC READY" badge shows even though no QVAC runtime exists.
- ✅ Registry persists; subscribe/emit keeps the list live while downloading.

## Acceptance
- Tap Download on mobile data → warning dialog with size → Cancel does nothing.
- Download MedPsy 1.7B → MB counter matches 1,280 MB total → "Use for coach" auto-selected (first LLM).
- Pause at 40% → kill app → reopen → "Paused 40%" → Resume continues from about 40%.
- Delete the active model → coach shows the empty state; another downloaded LLM becomes active if present.
- On a 3 GB RAM phone, MedPsy 4B shows "Too large for this phone" and its Download is disabled.
