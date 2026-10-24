# 🛡️ TrustVault — Cryptographically Verifiable Zero-Trust Document Core

[![Security Tests](https://img.shields.io/badge/Security%20Tests-117%2F117%20Passed-10b981.svg?style=for-the-badge&logo=shield)](file:///d:/nexus%20tiq24/trustvault/threats.md)
[![Database](https://img.shields.io/badge/Database-Supabase%20PostgreSQL%20Live-3b82f6.svg?style=for-the-badge&logo=postgresql)](file:///d:/nexus%20tiq24/trustvault/architecture.md)
[![AI Engine](https://img.shields.io/badge/AI%20Copilot-Gemini%203.5%20%2F%202.5%20Flash%20Lite-8b5cf6.svg?style=for-the-badge&logo=google)](file:///d:/nexus%20tiq24/trustvault/prompts.md)
[![Auth](https://img.shields.io/badge/Cryptography-Argon2id%20%2B%20SHA--256%20CAS-06b6d4.svg?style=for-the-badge)](file:///d:/nexus%20tiq24/trustvault/security.md)
[![Threat Matrix](https://img.shields.io/badge/Threat%20Matrix-T01--T28%20Verified-emerald.svg?style=for-the-badge)](file:///d:/nexus%20tiq24/trustvault/threats.md)

TrustVault is a production-grade, enterprise Zero-Trust document management platform and cryptographic security core. It guarantees zero data and metadata leakage across all states: storage at rest, transmission in flight, multi-tenant database indexing, and interactive AI intelligence.

---

## ⚡ Live Demonstrations & Evaluator Access

| Environment | URL / Entrypoint | Status |
|---|---|---|
| **Public Live Tunnel** | [https://little-keys-tie.loca.lt](https://little-keys-tie.loca.lt) | 🟢 Active Tunnel |
| **Local Production Server** | [http://localhost:3000](http://localhost:3000) | 🟢 Running (Daemon) |
| **Supabase PostgreSQL** | `hybpqldwblpxluvsqazz` (us-east-1) | 🟢 Connected Live |

---

## 🔑 1-Click Fast-Track Evaluator Accounts

Judges can test the system immediately on `/` using the **1-Click Demo Evaluation Cards** without manual typing:

| Role | Username | Email | Password | Primary Evaluator Scenario |
|---|---|---|---|---|
| **Administrator** | `admin` | `admin@trustvault.local` | `AdminPass123!` | System health, cryptographic audit chain verification, anomaly detection, **1-Click Automated Security Scan**. *Least Privilege: Cannot view or download private user files.* |
| **Document Owner** | `alice` | `alice@trustvault.local` | `AlicePass123!` | Full control over owned files, AI summaries & DLP scans, issuing single-use download tokens, managing access grants. |
| **Viewer** | `bob` | `bob@trustvault.local` | `BobPass123!` | Read-only access to Alice's shared charter document. Probing unshared files returns strict HTTP 404 (Existence Concealment). |

---

## 🏛️ Core Architectural Invariants

1. **Mandatory Central Authorization Kernel (`authorize()`):** Single non-bypassable checkpoint. Deny by default.
2. **Existence Concealment (Zero IDOR):** Unauthorized reads strictly return `HTTP 404 Not Found` with identical timing, concealing file existence and preventing resource enumeration.
3. **Content-Addressable Storage (CAS):** Payload-addressed SHA-256 storage blobs outside web root with binary magic byte inspection (`MZ` and `ELF` executables rejected).
4. **Append-Only SHA-256 Audit Chain:** Cryptographically linked event ledger chained from Genesis. PostgreSQL kernel trigger `trg_audit_log_immutable` strictly forbids `UPDATE` and `DELETE`.
5. **Agentic AI Copilot Guardrails:** Powered by Google Gemini 2.5 / 3.5 Flash Lite with an active pre-flight Prompt Injection Firewall that blocks instruction overrides, jailbreaks, and system prompt leaks.
6. **Strict Role Isolation & AI Protection:** The AI Copilot is strictly hidden and inaccessible for guest visitors; unlocks only after authentication.

---

## 📚 Complete Project Documentation

- 📖 **[documentation.md](file:///d:/nexus%20tiq24/trustvault/documentation.md)**: Full Technical Documentation, REST API reference, and Production Runbook.
- 🚀 **[walkthrough.md](file:///d:/nexus%20tiq24/trustvault/walkthrough.md)**: Step-by-step evaluator walkthrough covering 1-click login, admin scans, and AI injection defense.
- 🏗️ **[architecture.md](file:///d:/nexus%20tiq24/trustvault/architecture.md)** (and **[architenchture.md](file:///d:/nexus%20tiq24/trustvault/architenchture.md)**): System architecture, data flow diagrams, and core invariant proofs.
- 🌟 **[features.md](file:///d:/nexus%20tiq24/trustvault/features.md)**: Comprehensive feature catalog and capabilities breakdown.
- 🔐 **[security.md](file:///d:/nexus%20tiq24/trustvault/security.md)**: Cryptographic proofs, mathematical formulas, and tokenization specs.
- 🎯 **[threats.md](file:///d:/nexus%20tiq24/trustvault/threats.md)**: Threat Matrix (T01 through T28) mapping and automated verification.
- 🤖 **[prompts.md](file:///d:/nexus%20tiq24/trustvault/prompts.md)**: Curated AI test prompts, DLP queries, and prompt injection test probes.
- 📊 **[workstatus.md](file:///d:/nexus%20tiq24/trustvault/workstatus.md)**: Development status report, build verification, and deployment readiness audit.

---

## 🛠️ Quick Start & Local Commands

```bash
# 1. Install dependencies across monorepo
npm install

# 2. Build all workspaces (shared, api, web)
npm run build

# 3. Run all 117 automated security and threat tests
npm test

# 4. Start production server
npm start
```

---

## 🚢 Online Deployment Options

### Render / Railway (Docker Monorepo Deployment)
1. Fork or push this repository to GitHub.
2. Link your repository in Render or Railway as a Web Service.
3. Configure Environment Variables:
   - `DATABASE_URL`: `postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres`
   - `GEMINI_API_KEY`: Your Google Gemini API Key
   - `SESSION_SECRET`: Random 32+ character hex string
4. The root `Dockerfile` automatically builds all workspaces and starts the production server on port 3000.
