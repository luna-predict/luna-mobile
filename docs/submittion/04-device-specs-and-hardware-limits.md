# 04. Device Specs, Memory & Hardware Limits

## 1. Primary Testing Device & OS

LunaPredict was developed, debugged, and verified on physical hardware:

* **Device**: Samsung Galaxy S24 (`SM-S921N`)
* **Operating System**: Android 14 (One UI 6.1, Kernel 6.1.43-android14-11-29177119)
* **Processor**: Samsung Exynos 2400 (10-core 64-bit ARMv9 architecture: 1× Cortex-X4 @ 3.2GHz, 5× Cortex-A720, 4× Cortex-A520)
* **RAM**: 8 GB LPDDR5X
* **Storage Available**: 256 GB UFS 4.0
* **Architecture ABI**: `arm64-v8a`

> **Note for Judges**: LunaPredict also runs on any Android 11+ physical device or simulator supporting `arm64-v8a` with at least 4 GB of RAM (for `medpsy-1.7b-q4km`) or 2 GB of RAM (for `qwen3-0.6b`).

---

## 2. Memory Requirements & RAM Budget

Local AI inference on mobile devices requires strict memory discipline to avoid Android Out-Of-Memory (OOM) kills.

| Model | Weights Size | KV Cache (2048 ctx) | Runtime Overhead | Total Peak RAM Needed | Target Devices |
|---|---|---|---|---|---|
| **MedPsy 1.7B Q4_K_M** | 1.28 GB | ~112 MB | ~150 MB | **~1.55 GB** | Standard phones (4GB–6GB total RAM) |
| **MedPsy 4B Q4_K_M** | 2.72 GB | ~144 MB | ~200 MB | **~3.05 GB** | Flagship phones (8GB+ total RAM) |
| **Qwen3 0.6B Q4_K_M** | 0.42 GB | ~40 MB | ~80 MB | **~0.55 GB** | Low-cost entry phones (3GB–4GB RAM) |
| **Whisper Tiny ASR** | 75 MB | Negligible | ~45 MB | **~120 MB** | Voice logging on any modern phone |

### Memory Management Safeguards:
1. **Dynamic Model Unloading**: The model is automatically unloaded after 5 minutes of idle time or upon app backgrounding, freeing up to 2.7 GB of system RAM immediately.
2. **Pre-Download RAM Validation**: The app verifies `Device.totalMemory` and blocks downloads of models that exceed 60% of available physical memory.
3. **Context Length Adaptation**: Phones with < 6 GB of RAM automatically default to a 2048-token context window, while 8 GB+ devices use 4096 tokens.

---

## 3. Hardware Acceleration: OpenCL & ARM NEON

* **ARM NEON**: QVAC utilizes vector SIMD optimizations in the native `fabric-android-arm64` engine to parallelize matrix multiplications across all available CPU cores.
* **OpenCL Acceleration & Fallback**:
  - The Android build includes the OpenCL driver configuration (`uses-native-library android:name="libOpenCL.so" android:required="false"`).
  - Devices with vendor OpenCL drivers utilize GPU acceleration for prompt evaluation.
  - Devices without OpenCL automatically fall back to CPU multicore execution with zero crashes.

---

## 4. Model Licenses & Open Weights

* **MedPsy 1.7B & 4B**: Licensed under the **Apache 2.0 License**. Derived from Tether/QVAC's clinical healthcare fine-tunes on medical dialogue datasets.
* **Qwen 3**: Licensed under the **Apache 2.0 License**.
* **Whisper Tiny**: Licensed under the **MIT License** (OpenAI / whisper.cpp).
* All models use open-weights GGUF formats and contain zero proprietary training backdoors.

