# 02. QVAC Integration & Offline AI

## 1. SDK & Package Versions

LunaPredict integrates Tether's **QVAC SDK** via official React Native and Bare runtime native bindings:

| Package | Version | Purpose |
|---|---|---|
| `@qvac/sdk` | `^0.22.0` | Core QVAC inference, registry, cache manager, and streaming completion runtime |
| `@qvac/fabric-android-arm64` | `0.22.0` | Precompiled native Bare runtime and llama.cpp engine binaries for Android ARM64 |
| `@qvac/fabric-ios` | `0.22.0` | Precompiled native runtime binaries for Apple iOS |
| `@qvac/asr-ggml-android-arm64` | `0.10.0` | Whisper.cpp speech-to-text inference runtime for voice logging |
| `@qvac/asr-ggml-ios` | `0.10.0` | Whisper.cpp speech-to-text inference runtime for iOS |
| `react-native-bare-kit` | `^0.16.0` | TurboModule bridge connecting React Native UI to the native Bare worklet execution environment |

---

## 2. Models Used

LunaPredict leverages Tether's purpose-built **MedPsy** foundation models, specifically tuned for medical and psychological health consultations on constrained edge hardware:

| Model ID | SDK Registry Constant | Hugging Face Source / File | Disk Size | Target Hardware & Context |
|---|---|---|---|---|
| **`medpsy-1.7b-q4km`** *(Default Coach)* | `HEALTHCARE_1_7B_MEDICAL_Q4_K_M` | `qvac/MedPsy-1.7B-GGUF/medpsy-1.7b-q4_k_m-imat.gguf` | **1.28 GB** | Standard smartphones (4GB–8GB RAM). 2048 to 4096 context. −1.1% perplexity vs. BF16. |
| **`medpsy-4b-q4km`** *(Flagship Coach)* | `HEALTHCARE_4B_MEDICAL_Q4_K_M` | `qvac/MedPsy-4B-GGUF/medpsy-4b-q4_k_m-imat.gguf` | **2.72 GB** | High-end smartphones (8GB+ RAM). 4096 context. Deeper clinical reasoning. |
| **`qwen3-0.6b`** *(Low-RAM / Spike)* | `QWEN3_600M_INST_Q4` | `qvac/Qwen3-0.6B-Instruct-GGUF/qwen3-0.6b-q4_k_m.gguf` | **0.42 GB** | Budget fallback for ultra-low memory devices. |
| **`whisper-tiny-en`** *(Voice Logging)* | Builtin Whisper ASR | `whisper-tiny.en.bin` | **75 MB** | On-device voice input transcription. Audio never leaves RAM. |

> **Quantization Quality Guardrail**: In accordance with MedPsy clinical benchmarks, 3-bit quantizations are rejected because medical accuracy degrades noticeably below 4-bit (`q4_k_m`).

---

## 3. Model Download & Setup Lifecycle

1. **Hardware Assessment (`assessModelFit`)**:
   Before downloading, LunaPredict queries device hardware via `expo-device` and QVAC's `assessModelFit()`:
   ```ts
   assessModelFit({
     models: [{ modelSrc, modelType: 'llamacpp-completion', modelConfig: { ctx_size } }],
     policy: 'interactive-v1'
   })
   ```
   If RAM or available disk is insufficient (`freeDiskBytes < fileSize * 1.2`), the UI prevents downloading and explains why.
2. **Checksum-Verified Download**:
   Downloads stream directly via `downloadAsset({ assetSrc, onProgress, requireHttpChecksum: true })`. Every chunk is SHA-256 verified against Hugging Face metadata. Downloads support pause and resume.
3. **RAM Management & Execution**:
   - `loadModel({ modelSrc, modelType: 'llamacpp-completion', modelConfig: { ctx_size, n_threads: 4 } })` loads weights into private application memory.
   - Inference uses `completion({ history, stream: true, captureThinking: true })`, emitting token-by-token deltas to the UI.
   - When idle for 5 minutes or when the app is backgrounded, `unloadModel()` frees memory to keep the OS responsive.

---

## 4. Code Files Implementing QVAC

All QVAC-specific integration is organized cleanly in the codebase:

* **[`src/ai/qvac.ts`](file:///c:/Users/Antony%20Dev/Desktop/qvac-tether/lunapredict-mobile/src/ai/qvac.ts)**:
  - Runtime loader, environment validation, fallback detection, and typed access to `@qvac/sdk`.
* **[`src/services/ModelManager.ts`](file:///c:/Users/Antony%20Dev/Desktop/qvac-tether/lunapredict-mobile/src/services/ModelManager.ts)**:
  - Hardware probing, catalog registry, download state machine (`not_downloaded` → `downloading` → `paused` → `downloaded`), disk verification, and cache reconciliation.
* **[`src/ai/engine/QvacEngine.ts`](file:///c:/Users/Antony%20Dev/Desktop/qvac-tether/lunapredict-mobile/src/ai/engine/QvacEngine.ts)**:
  - Adapter connecting the QVAC C++ completion stream to React Native state, handling token deltas, thinking blocks, request cancellation, and performance telemetry (tokens/sec).
* **[`src/ai/coach/PromptBuilder.ts`](file:///c:/Users/Antony%20Dev/Desktop/qvac-tether/lunapredict-mobile/src/ai/coach/PromptBuilder.ts)**:
  - Injects the user's local cycle phase, symptoms, and pregnancy week into the system prompt with deterministic clinical guardrails and emergency triage triggers.
* **[`src/screens/ModelsScreen.tsx`](file:///c:/Users/Antony%20Dev/Desktop/qvac-tether/lunapredict-mobile/src/screens/ModelsScreen.tsx)**:
  - Model manager UI: shows device RAM, disk space, download progress bars, warmup buttons, and active model selection.
* **[`src/screens/AICoachScreen.tsx`](file:///c:/Users/Antony%20Dev/Desktop/qvac-tether/lunapredict-mobile/src/screens/AICoachScreen.tsx)**:
  - Chat interface displaying real-time streaming tokens, voice input via whisper, markdown rendering, and local conversation memory.

---

## 5. Offline Verification

When tested in **Airplane Mode (Wi-Fi off, Mobile Data off)**:
- MedPsy responds to questions immediately with streaming output at **12–25 tokens/second** on modern ARM64 devices (such as Snapdragon 8 Gen 3 / Exynos 2400).
- Zero HTTP/DNS network requests are initiated during inference.
- Audio recorded for voice transcription is processed in-memory by `whispercpp-transcription` and never leaves the handset.

