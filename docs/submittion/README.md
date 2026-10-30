# LunaPredict — AI Yako Hackathon Submission

> **Private, On-Device Women’s Health Intelligence powered by QVAC Local AI, Pears Peer-to-Peer Sync, and Tether WDK.**

Welcome to the official hackathon submission package for **LunaPredict**, submitted to **DoraHacks: AI Yako** (QVAC + Tether).

This folder contains the complete, structured documentation fulfilling every submission criteria required by the hackathon judges.

---

## Submission Documents Directory

| Document | Purpose & Key Contents |
|---|---|
| [**01. Project Overview & Track Selection**](./01-project-overview-and-tracks.md) | Problem statement, target user personas, market shortcomings (Flo/Clue data harvesting), and chosen tracks. |
| [**02. QVAC Integration & Offline AI**](./02-qvac-integration-and-offline-ai.md) | SDK packages, version pinning, MedPsy 1.7B & 4B models, on-device streaming, code file locations, and offline inference proof. |
| [**03. WDK & Finance Integration**](./03-wdk-and-finance-integration.md) | Tether WDK integration: non-custodial BIP-39 wallet, testnet/mainnet switching, and micropayments for delegated compute (0.0001 USDt/token). |
| [**04. Device Specs, Memory & Hardware Limits**](./04-device-specs-and-hardware-limits.md) | Tested test hardware (Samsung Galaxy S24 / Android 14+), RAM budget, OpenCL / ARM NEON acceleration, and model licenses. |
| [**05. Offline Demo Script & Video Guide**](./05-offline-demo-and-video-guide.md) | Step-by-step recording guide for the offline video demo (airplane mode, local QVAC inference, zero cloud telemetry). |
| [**06. Network Dependency Disclosure**](./06-network-dependency-disclosure.md) | Explicit audit of features: zero-network offline features vs. one-time network operations (weights download, P2P DHT, chain tx). |
| [**07. Repository Setup, Build & Attributions**](./07-repository-setup-and-attribution.md) | Build instructions from source, npm dependencies, list of code authored during the event, and third-party disclosures. |
| [**08. African Languages & P2P Deep Dive**](./08-african-languages-and-p2p-deepdive.md) | Breakthrough deep dive: the 200M+ Swahili translation pipeline (TranslatePsy-AfriSLM), serverless Holepunch/Pears partner sync, and recent commit history audit. |

---

## Executive Summary for Judges

* **Core Innovation**: 100% of cycle predictions, health symptom analysis, and natural language AI coaching execute **entirely on the user's phone** via Tether's **QVAC SDK** with **MedPsy GGUF** medical models.
* **Zero Cloud Health Database**: No user cycles, pregnancies, or symptoms are ever transmitted to a central server.
* **Serverless Partner Sync**: Partner sharing uses the **Holepunch / Pears** stack (Hyperswarm DHT + Hypercore replication + Noise encryption), enabling device-to-device synchronization with zero backend servers.
* **Non-Custodial WDK Micro-Billing**: Built-in non-custodial Tether WDK wallet enabling granular pay-per-token compute settlement (0.0001 USDt/token) only if the user explicitly delegates tasks to larger desktop or cluster models.

