# TrustVault — Enterprise Secure Document-Sharing Platform

TrustVault is an enterprise-grade secure document-sharing web application engineered with a **Zero-Trust Security Architecture**. Built specifically to prevent unauthorized document access and information disclosure, TrustVault combines mandatory central authorization, server-side opaque sessions, an append-only cryptographic audit chain, private isolated file storage, and automated threat matrix defenses.

---

## 🌟 Security Highlights

- **Mandatory Central Authorization Engine (`authorize(user, document, action)`):** Every single document access, mutation, grant delegation, and download passes through one authoritative function. Deny by default.
- **Resource Existence Concealment (404 Not Found):** Unauthorized access attempts return `404 Not Found` rather than `403 Forbidden` to prevent IDOR probing and resource enumeration.
- **Principle of Least Privilege:** System `admin` accounts can verify security anomalies and audit chains, but have **zero implicit permission** to view or download user documents without an explicit grant.
- **Cryptographic Append-Only Audit Chain:** Every event is hashed with SHA-256 and chained to the previous record (`current_hash = SHA256(previous_hash + payload)`). A PostgreSQL database trigger (`trg_audit_log_immutable`) forbids direct `UPDATE` or `DELETE` operations on audit logs.
- **Zero-Leakage Predicate Search:** Document searches, total counts, and category/format facets are filtered at the database SQL query level; unauthorized documents never leak through aggregate counts.
- **Private Isolated Storage Engine:** Uploaded documents are stored outside the web root (`storage/files`) using unguessable UUID filenames (`${uuid}.bin`). File signatures (magic bytes) are strictly verified, rejecting executable binaries (PE/ELF) and archives (ZIP).
- **Atomic One-Time Download Tokens:** Race-condition-resistant tokens generated with cryptographic entropy for single-use downloads.
- **Dual-Mode Database Architecture:** Supports production PostgreSQL 16 connection pooling as well as zero-dependency in-process `@electric-sql/pglite` WebAssembly PostgreSQL for dev and testing.

---

## 🚀 Quick Start

### Option 1: Zero-Dependency Local Execution (Recommended for Dev & Review)

TrustVault runs out-of-the-box with Node.js 20+ without requiring an external PostgreSQL installation, thanks to its integrated PGlite WebAssembly engine:

```bash
# 1. Install dependencies
npm install

# 2. Build shared package and applications
npm run build

# 3. Start Backend API Server (Port 3000)
npm run dev:api

# 4. In a separate terminal, start Vite Web Frontend (Port 5173)
npm run dev:web
```

Access the frontend at **http://localhost:5173** (API automatically proxied to port 3000).

---

### Option 2: Production Containerization (Docker Compose)

Run the full production stack with multi-stage container builds and a dedicated PostgreSQL 16 database:

```bash
docker compose up --build
```

Access the application at **http://localhost:3000** (serves both React SPA and Express API).

---

## 🧪 Comprehensive Automated Testing

TrustVault features **107 automated security, threat, and authorization tests** covering every layer:

```bash
# Run entire test suite (all 7 suites, 107 tests)
npm run test

# Run the 28-Threat Matrix Verification Suite
npx vitest run tests/security/threat-matrix.test.ts

# Run AST-Aware Mutation Testing Harness
npm run mutation-test
```

### Mutation Testing (`npm run mutation-test`)
The controlled mutation test harness temporarily bypasses the central authorization calls in core services and verifies that the security test suites immediately detect the vulnerability (100% kill rate), cleanly restoring all source files afterward.

---

## 📁 Repository Layout

```
trustvault/
├── apps/
│   ├── api/                     # Node.js + Express modular monolith backend
│   │   ├── src/
│   │   │   ├── config/          # Environment configuration
│   │   │   ├── db/              # Dual-mode PostgreSQL & PGlite client
│   │   │   ├── middleware/      # Auth, CSRF, CORS, security headers, errors
│   │   │   ├── modules/
│   │   │   │   ├── auth/        # Argon2id password hashing & session management
│   │   │   │   ├── authorization/# Mandatory central authorization engine
│   │   │   │   ├── documents/   # Document service, repository, and routes
│   │   │   │   ├── sharing/     # Document grants and atomic download tokens
│   │   │   │   ├── storage/     # Private file engine & magic byte detector
│   │   │   │   └── audit/       # Cryptographic hash chaining & anomaly detector
│   │   │   └── server.ts        # Production bootstrap
│   │   └── tsconfig.json
│   └── web/                     # React 18 + Vite + Tailwind CSS frontend
│       ├── src/
│       │   ├── components/      # Navbar, UploadModal, ShareModal, VersionModal
│       │   ├── context/         # AuthContext & session state
│       │   ├── pages/           # AuthPage, DashboardPage, AdminAuditPage
│       │   └── services/        # Secure API client with CSRF and credentials
│       └── vite.config.ts
├── packages/
│   └── shared/                  # Shared TypeScript types, Zod schemas, & constants
├── database/                    # SQL schema definitions, migrations, and seeds
├── tests/
│   └── security/                # Adversarial and threat security test suites
│       ├── auth.security.test.ts
│       ├── authorization.test.ts
│       ├── document.security.test.ts
│       ├── sharing.security.test.ts
│       ├── audit.security.test.ts
│       ├── search.security.test.ts
│       └── threat-matrix.test.ts # Complete T01–T28 verification suite
├── scripts/
│   └── mutation-test.ts         # Controlled AST mutation testing harness
├── docs/
│   ├── ARCHITECTURE.md          # Architecture topology, design patterns, & data flow
│   ├── PERMISSIONS.md           # Role permissions matrix & grant state machine
│   ├── THREATS.md               # Detailed threat analysis & mitigation mapping (T01-T28)
│   └── API.md                   # Complete REST API specification
├── Dockerfile                   # Multi-stage production container build
├── docker-compose.yml           # Production Compose definition with PostgreSQL 16
└── package.json                 # Monorepo workspaces configuration
```

---

## 📚 Detailed Documentation

- 📐 **[System Architecture](docs/ARCHITECTURE.md)**: Deep dive into the modular monolith, zero-trust pipeline, and cryptographic chaining.
- 🛡️ **[Permission & Role Model](docs/PERMISSIONS.md)**: Role hierarchy, document action matrix, grant delegation, and soft-delete states.
- 🎯 **[Threat Matrix & Mitigations (T01-T28)](docs/THREATS.md)**: Threat-by-threat analysis, exploit scenarios, and defense implementations.
- 🔌 **[REST API Reference](docs/API.md)**: OpenAPI-aligned documentation for all endpoints.
