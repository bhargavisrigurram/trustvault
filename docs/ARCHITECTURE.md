# TrustVault Architecture Specification

TrustVault is an enterprise-grade secure document-sharing platform built with a **Zero-Trust Security Model**, where security and unauthorized access prevention account for the primary design criteria.

---

## 1. System Topology & Layered Modular Monolith

TrustVault is engineered as a clean TypeScript modular monolith with strict separation between packages:

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Browser                         │
│            (React 18 + Vite + Tailwind CSS)                 │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / Cookie Auth / CSRF
┌──────────────────────────────▼──────────────────────────────┐
│                    API Gateway / Express                    │
│  - Helmet Security Headers (CSP, HSTS, X-Content-Type)      │
│  - Strict CORS Policy (Configured Origin Only)             │
│  - HttpOnly SameSite=Strict Cookie Session Authenticator   │
│  - Per-Session CSRF Defense (Double-Submit Token Pattern)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│              Mandatory Central Authorization Engine          │
│                  authorize(user, document, action)          │
│  - Deny by default                                          │
│  - Hides existence (returns 404 for unauthorized reads)     │
│  - Enforces Least Privilege (Admin has NO content access)   │
└───────┬──────────────────────┬──────────────────────┬───────┘
        │                      │                      │
┌───────▼──────────────┐┌──────▼──────────────┐┌──────▼──────────────┐
│  Document Service    ││  Storage Engine     ││   Audit Logger      │
│ - Versioning (OCC)   ││ - Magic Byte Sniff  ││ - Cryptographic SHA │
│ - Soft-Delete Engine ││ - Isolated Binaries ││ - Append-Only DB    │
│ - Predicate Search   ││ - UUID Key Mapping  ││ - Anomaly Detector  │
└───────┬──────────────┘└──────┬──────────────┘└──────┬──────────────┘
        │                      │                      │
┌───────▼──────────────────────▼──────────────────────▼───────┐
│                    Persistence Layer                        │
│ - Dual-Mode Engine: Native PostgreSQL & PGlite WASM         │
│ - Database Immutability Triggers (trg_audit_log_immutable)  │
│ - Private Filesystem Outside Web Root (/storage/files)      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Mandatory Central Authorization Engine

All document access, mutation, sharing, and download operations pass through a single, authoritative central authorization function:

```typescript
authorize(user: User, document: Document, action: DocumentActionType): Promise<AuthorizationResult>
```

### Invariants Enforced:
1. **Deny by Default:** Unless an explicit ownership or active grant rule is matched, authorization is rejected.
2. **Existence Concealment (404 Not Found):** To prevent IDOR probing and resource enumeration, unauthorized requests for metadata, content, downloads, or grants return `404 Not Found` rather than `403 Forbidden`.
3. **No Frontend Trust:** Client-provided roles, user IDs, or permission assertions in headers/bodies are strictly disregarded; identities are resolved exclusively from cryptographic server-side sessions.
4. **Principle of Least Privilege:** System `admin` accounts can inspect user profiles and audit chains, but have **zero implicit permission** to read, download, or edit user documents without an explicit grant.

---

## 3. Cryptographic Append-Only Audit Logging

All system events (authentication, access decisions, uploads, downloads, grant creations, revocations, and anomalies) are recorded in an immutable audit ledger:

### Hash Chaining Mechanism
- **Genesis Hash:** Fixed initial hash (`0000000000000000000000000000000000000000000000000000000000000000`).
- **Head Chaining:**
  $$\text{current\_hash} = \text{SHA256}(\text{previous\_hash} + \text{canonical\_json}(\text{payload}))$$
- **Database Trigger Defense:**
  A PostgreSQL database trigger `trg_audit_log_immutable` raises an unconditional exception upon any `UPDATE` or `DELETE` attempt on `audit_log`, ensuring audit integrity even against rogue internal queries.
- **Cryptographic Verification:**
  The `verifyChain()` routine validates sequence numbers from 1 to $N$, verifying that every entry's `previous_hash` matches the prior record's calculated hash. If tampering occurs, the exact sequence number is immediately pinpointed.

---

## 4. Private Storage Engine & Magic Byte Inspection

1. **Storage Isolation:** Files are stored in a dedicated directory outside the web application root (`storage/files`).
2. **UUID Storage Keys:** Files are renamed to random UUIDs (`${uuid}.bin`). The original filename is stored in metadata and never used as a filesystem path.
3. **Magic Byte Signature Inspection:** Uploaded files undergo signature inspection (magic bytes) to verify actual binary type:
   - Executables (`MZ`, `ELF`) and archives (`PK\x03\x04`, `7z`, `rar`) are strictly rejected.
   - Text, PDF, Markdown, and CSV signatures are strictly verified.
4. **Secure Download Headers:**
   ```http
   Content-Disposition: attachment; filename="..."
   X-Content-Type-Options: nosniff
   Cache-Control: private, no-cache, no-store, must-revalidate
   ```

---

## 5. Dual-Mode Database Architecture

TrustVault supports dual-mode PostgreSQL persistence:
- **Production Mode:** Native PostgreSQL 16 using `pg.Pool` connection pooling when `DATABASE_URL` is configured.
- **Zero-Dependency / Test Mode:** In-process `@electric-sql/pglite` WebAssembly PostgreSQL. Runs full PostgreSQL SQL, schemas, constraints, and PL/pgSQL triggers with zero external database dependencies.
