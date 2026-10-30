# 01. Project Overview & Track Selection

## 1. Problem Description

Commercial women's health apps (such as Flo, Clue, and Premom) suffer from four systemic flaws:

1. **The African Language Exclusion Barrier**:
   - Over **1.4 billion people** live in Africa, speaking over 2,000 indigenous languages. **Swahili (Kiswahili)** alone is spoken by over **200 million people** across East and Central Africa (Kenya, Tanzania, Uganda, Rwanda, DRC, Burundi).
   - Yet, nearly every digital health app and foundation model (including MedPsy, Llama, and GPT-4) is validated and prompted exclusively in English or high-resource Global North languages.
   - When a woman in Nairobi, Dodoma, or rural Goma experiences early pregnancy complications, severe dysmenorrhea, or perimenopausal symptoms, articulating nuanced sensations in clinical English is unnatural, intimidating, or inaccessible.
   - Cloud translation APIs (Google Translate, DeepL) violate patient confidentiality, cost prohibitive cellular data, and fail completely in offline rural clinics or during frequent network blackouts.
2. **Massive Privacy Vulnerabilities & Data Commercialization**:
   - Billions of intimate data points (menstrual cycles, sexual activity, ovulation tests, pregnancy status, and hormonal symptoms) are stored on centralized cloud servers.
   - Post-Roe v. Wade, centralized reproductive databases represent an existential legal and privacy risk for millions of women subject to surveillance, subpoenas, or data broker sales.
3. **Cloud-Dependent AI with Privacy Leakage**:
   - Modern "AI assistants" in reproductive apps route deeply personal questions (e.g., miscarriage fears, unusual bleeding, medication interactions) to cloud LLM APIs (OpenAI, Anthropic, or AWS), exposing sensitive health queries to third-party logs and server telemetry.
4. **The "Disconnected Partner" Dilemma**:
   - Partners of pregnant women or couples trying to conceive—especially athletes on tour, military personnel on deployment, offshore workers, or long-distance couples—are treated as passive bystanders or forced to share full cloud account credentials. There is no respectful, privacy-preserving, peer-to-peer sharing mechanism.

---

## 2. Who Needs the Solution?

* **Women & Families Across Africa & the Global South**:
  - Millions of non-native English speakers—starting with **200M+ Swahili speakers**—who deserve clinical-grade reproductive intelligence in their mother tongue, spoken or typed, without internet dependence.
* **Women & People with Menstrual Cycles**:
  - Anyone tracking periods, natural fertility windows, symptoms, pregnancy, or perimenopause who refuses to let their reproductive health data sit in a subpoena-vulnerable cloud database.
* **Couples Trying to Conceive (TTC)**:
  - Partners needing accurate, synchronized fertile window awareness (clinical Wilcox et al. probabilities) without awkward daily interrogation.
* **Expectant Parents & Active Partners**:
  - Partners stationed away from home who want respectful, real-time insight into pregnancy milestones, hormonal shifts, and personalized actionable guidance on how to provide meaningful support.
* **Individuals in Low-Connectivity Environments**:
  - Users in rural areas, flights, maritime vessels, or regions with intermittent internet connectivity who still need dependable clinical insight and cycle predictions at 2:00 AM.

---

## 3. Chosen Tracks

### Primary Track: **QVAC Track (On-Device AI)**
LunaPredict was built around Tether's **QVAC SDK** (`@qvac/sdk@0.22.0`). All natural language understanding, clinical health coaching, voice transcriptions, and symptom-to-log structured extraction operate **strictly offline on the user's mobile processor**.
- **No cloud LLM API** is used for core AI features.
- In airplane mode, the user can chat with the MedPsy medical model, ask questions about cramps or fertile windows in English or Swahili, and receive instant token-by-token streaming responses.

### Complementary Tracks:
1. **Pears / Holepunch P2P Track**:
   - Partner sharing is implemented using the **Pears stack** (BareKit Worklet running `hyperswarm`, `corestore`, and `b4a`).
   - Pairing is accomplished via short 12-character z-base-32 blind invite codes, creating an encrypted device-to-device replication channel over Noise protocol without any centralized server or database.
2. **WDK (Finance / Wallet) Track**:
   - Integrated non-custodial **Tether WDK** wallet with local BIP-39 mnemonic generation, AES-256 secure storage, and testnet/mainnet switching.
   - Powers a pay-per-token compute model (0.0001 USDt per token) designed for delegated desktop or cluster compute. Local on-device AI is 100% free and perpetual.

