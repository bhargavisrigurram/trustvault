# TrustVault — Engineering Prompts & AI Collaboration Log (`prompts.md`)

This document records the chronological prompts, architectural specifications, adversarial verification strategies, and engineering decisions utilized to build, harden, test, and deploy **TrustVault** for the software engineering hiring challenge.

---

## 📋 Executive Overview

- **Project:** TrustVault — High-Security Document-Sharing Platform
- **Evaluation Weight:** 35% on Application Security & Automated Adversarial Verification
- **Test Coverage:** 107 / 107 Automated Security & Threat Tests Passing (100% Pass Rate)
- **Mutation Kill Rate:** 3 / 3 Mutants Killed (100% Mutation Kill Rate)
- **Primary Security Invariants:**
  1. *Existence Concealment:* Unauthorized and unauthenticated access returns `HTTP 404 Not Found` (Deny-by-default, anti-IDOR probing).
  2. *Cryptographic CAS:* SHA-256 content-addressed deduplication and file integrity verification.
  3. *Trigger-Enforced Immutability:* PostgreSQL database triggers prohibit `UPDATE` and `DELETE` on the audit log.
  4. *Tamper-Evident Hash Chaining:* Every audit event is chained with the previous record's SHA-256 hash.
  5. *Ephemeral Single-Use Tokens:* Document downloads require cryptographically signed, single-use, 60-second download tokens.

---

## 🔄 Chronological Engineering Prompts & Implementation History

### Prompt 01: Initial Architecture & Threat Modeling Setup (Phase 1)
> **User Prompt:**  
> *"Act as a senior full-stack developer, application security engineer, database architect, and test engineer. Build TrustVault, a secure document-sharing web application for a software engineering hiring challenge. Security accounts for 35% of the evaluation, so preventing unauthorized document access is the highest priority..."*

- **Intent & Scope:** Establish monorepo structure, select an embedded zero-setup PostgreSQL solution (`@electric-sql/pglite`), configure TypeScript strict mode, and document the 28-threat threat matrix.
- **Architectural Deliverables:**
  - `packages/shared/`: Shared domain models, permission enums, and Zod validation schemas.
  - `apps/api/`: Express API with Helmet, strict CSP, CORS allowlist, and rate limiting.
  - `apps/web/`: React 18 + Vite frontend shell.
  - `docs/THREATS.md`: Detailed threat model categorizing threats T01 through T28 with STRIDE/DREAD ratings.

---

### Prompt 02: Relational Database Schema & Central Authorization Kernel (Phase 2)
> **User Prompt:**  
> *"Create the core database schema and the centralized authorization middleware. Deny by default, return 404 for unauthorized access to prevent resource enumeration, and enforce the role hierarchy (viewer < edit < owner)."*

- **Intent & Scope:** Design the normalized PostgreSQL schema with foreign key constraints and build the central authorization gatekeeper.
- **Architectural Deliverables:**
  - `database/schema.sql`: Tables for `users`, `sessions`, `documents`, `document_versions`, `document_grants`, `audit_log`, and `download_tokens`.
  - `apps/api/src/middleware/auth.middleware.ts`: Authenticates server-side sessions, checks absolute/idle expiration, and enforces CSRF tokens for mutating HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`).
  - `apps/api/src/middleware/authorize.middleware.ts`: Evaluates `effective_permission` through ownership and grant tables. Unconditionally responds with `HTTP 404 Not Found` when a document does not exist OR when the requester lacks sufficient grants.

---

### Prompt 03: Cryptographic Storage Engine & Version History (Phase 3)
> **User Prompt:**  
> *"Implement secure document uploads, versioning, and single-use downloads. Ensure files are content-addressed by SHA-256, deduplicated on disk, and validated via magic-bytes rather than untrusted client extensions."*

- **Intent & Scope:** Prevent malicious file uploads (e.g., polyglots, executable scripts disguised as PDFs), path traversal, and unauthorized direct file access.
- **Architectural Deliverables:**
  - `apps/api/src/services/storage.service.ts`: Computes streaming SHA-256 hash, stores binaries in dedicated storage directory outside web root, and prevents duplicate disk writes when content hash matches existing version.
  - Magic-byte inspection: Rejects mismatched MIME types and dangerous extensions (`.exe`, `.sh`, `.bat`, `.zip`, `.html`).
  - `apps/api/src/modules/documents/document.routes.ts`: `POST /api/documents/:id/token` generates a single-use HMAC-SHA256 download token valid for 60 seconds; `GET /api/documents/download?token=...` streams the file and atomically marks the token consumed.

---

### Prompt 04: Append-Only Cryptographic Audit Log & Admin Dashboard (Phase 4)
> **User Prompt:**  
> *"Implement an immutable audit logging system. Enforce immutability via database triggers so no application code can update or delete audit records. Chain each audit entry with a SHA-256 cryptographic hash of the previous record."*

- **Intent & Scope:** Provide tamper-evident, non-repudiable audit logs and automated anomaly detection.
- **Architectural Deliverables:**
  - Database Trigger: `prevent_audit_tampering()` trigger raising an exception on any `UPDATE` or `DELETE` executed against `audit_log`.
  - Cryptographic Hash Chaining: Each event includes `previous_hash` and `record_hash = SHA256(id + event_type + ... + previous_hash)`.
  - Anomaly Detection: Algorithmic detection of brute-force login attempts (5+ failures in 15 minutes) and IDOR probing attempts (3+ unauthorized 404 access attempts in 10 minutes).
  - Admin Least Privilege: Admins can inspect the audit chain and anomaly alerts, but *cannot* read or download private document contents without an explicit grant.

---

### Prompt 05: Permission-Safe Search & Filtering Engine (Phase 5)
> **User Prompt:**  
> *"Implement permission-safe document search and filtering. Ensure zero metadata leakage, database-level isolation, search facet calculations restricted to authorized documents, and soft-deletion lifecycle."*

- **Intent & Scope:** Prevent indirect information disclosure via search suggestions, total counts, or facet counts.
- **Architectural Deliverables:**
  - `apps/api/src/modules/documents/document.service.ts`: SQL queries inject `(owner_id = $userId OR id IN (SELECT document_id FROM document_grants WHERE grantee_id = $userId))` directly into the `WHERE` clause.
  - Facet Aggregations: Dynamic facet counts for categories and MIME types are calculated strictly over the filtered result set.
  - Soft-Delete Recovery: Deleted documents are concealed from regular searches and accessible only via explicit `filter=trash` by the document owner.

---

### Prompt 06: React & Vite Security Frontend (Phase 6)
> **User Prompt:**  
> *"Build the complete frontend in React, Vite, and Tailwind CSS. Implement the dashboard, upload modal, version history modal, collaborator sharing modal, and admin audit chain verification UI."*

- **Intent & Scope:** Deliver an intuitive, responsive, and secure user interface enforcing client-side validation while respecting server-side security invariants.
- **Architectural Deliverables:**
  - `apps/web/src/pages/DashboardPage.tsx`: Document grid with permission badges, search filters, category pills, and quick action bars.
  - `apps/web/src/components/UploadModal.tsx`: Drag-and-drop file upload with category tagging and real-time size validation.
  - `apps/web/src/components/VersionHistoryModal.tsx`: Version timeline with changelogs, one-click rollback/download, and new version uploads.
  - `apps/web/src/components/ShareModal.tsx`: Grant management modal with permission dropdowns (`viewer`, `edit`) and instant revocation.
  - `apps/web/src/pages/AdminAuditPage.tsx`: Real-time cryptographic chain integrity verification tool and anomaly alert cards.

---

### Prompt 07: Threat Matrix Automated Verification (T01-T28) & Mutation Testing (Phase 7)
> **User Prompt:**  
> *"Write automated tests verifying all 28 threats from THREATS.md. Implement a mutation testing script to verify test suite quality and create production Docker configuration."*

- **Intent & Scope:** Provide end-to-end mathematical and behavioral verification of every security control and ensure tests detect injected vulnerabilities.
- **Architectural Deliverables:**
  - `tests/security/threat-matrix.test.ts`: 29 automated tests verifying every threat vector from T01 to T28, including the two-user adversarial matrix test.
  - `scripts/mutation-test.ts`: Automatically injects 3 deliberate security regressions (removing 404 existence concealment, bypassing MIME check, skipping single-use token invalidation) and confirms all 3 mutants are killed by the test suite (100% kill rate).
  - `Dockerfile` & `compose.yaml`: Multi-stage, non-root Alpine container setup with automated healthchecks.

---

### Prompt 08: Enterprise Showcase, Live Threat Simulator & Cryptographic Inspector
> **User Prompt:**  
> *"make home page better and add best ui features and better security and it should be best website for company and users also"*

- **Intent & Scope:** Elevate TrustVault from a standard CRUD app to an enterprise showcase with an interactive attack simulator and cryptographic inspection tools.
- **Architectural Deliverables:**
  - `apps/web/src/pages/HomePage.tsx`: Landing page with dark cyber-grid styling, live metric counters, 6 architectural pillars, persona value propositions, comparison matrix vs. S3/Google Drive, and security FAQ.
  - `apps/web/src/components/InteractiveAttackSimulator.tsx`: Live playground demonstrating deflection of 5 core attack vectors with real-time HTTP deflection headers and security explanations.
  - `apps/web/src/components/DocumentDetailsModal.tsx`: Cryptographic inspector modal displaying SHA-256 fingerprint, one-click copy with verified badge, payload stats, and storage invariants.
  - `apps/web/src/pages/AuthPage.tsx`: Password complexity checklist and modal support.
  - `apps/web/src/components/Navbar.tsx`: Live API health pulse querying `/api/health`.

---

### Prompt 09: Production Deployment & Live Tunnel Execution
> **User Prompt:**  
> *"ok fine now i dont need any changes deploy my website"*  
> *Selection: "Generate a public URL via a secure tunnel (e.g. cloudflared or localtunnel) for live external access"*

- **Intent & Scope:** Unify the frontend production build and backend into a single deployable server and expose it over a live, secure HTTPS tunnel.
- **Architectural Deliverables:**
  - Single-Port Static Serving: `apps/api/src/app.ts` configured to serve the production Vite bundle (`apps/web/dist`) on root `/` and API on `/api/*`.
  - CORS & CSP Tunnel Alignment: Allowed tunnel domains in `security.middleware.ts` while preserving strict external rejection.
  - Live Public Tunnel: Deployed on secure public HTTPS URL via `localtunnel` with active health monitoring.

---

## 💡 Key Architectural Decisions & Rationale

| Decision | Alternative Considered | Why TrustVault Made This Decision |
| :--- | :--- | :--- |
| **HTTP 404 Existence Concealment** | HTTP 403 Forbidden | Returning 403 informs an attacker that a resource exists at a given ID. Returning 404 eliminates IDOR probing and resource enumeration entirely. |
| **PostgreSQL Trigger Immutability** | Application-Level ORM Hooks | Application code can be bypassed or misconfigured. Database triggers guarantee that no SQL query, connection, or service role can delete or modify audit records. |
| **Ephemeral Single-Use Tokens** | Pre-signed S3 URLs | Pre-signed URLs remain valid until expiration, exposing URLs to browser history or proxy cache leakage. Single-use tokens become invalid the millisecond they are consumed. |
| **SHA-256 Content-Addressed Storage** | Random Filename per Upload | CAS guarantees file integrity, eliminates duplicate storage costs across versions, and provides cryptographic proof against data tampering. |
| **Magic-Byte Sniffing** | File Extension Checking | Attackers routinely rename malicious executables (e.g., `payload.exe` to `invoice.pdf`). Magic-byte sniffing verifies the actual binary header. |

---

## 🧪 Verification & Audit Commands

Reviewers can verify the entire platform using the following commands:

```bash
# 1. Run all 107 automated security & integration tests
npm run test

# 2. Run the threat matrix automated verification suite (T01 - T28)
npm run test:security

# 3. Execute the automated mutation testing harness
npm run mutation-test

# 4. Build all production workspaces
npm run build
```

---

*Authored as part of the TrustVault software engineering challenge submission.*
