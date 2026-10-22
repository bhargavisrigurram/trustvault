# TrustVault REST API Specification

All API endpoints are prefixed with `/api`. Protected routes require an active session cookie (`trustvault_session`) and an `x-csrf-token` header for state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`).

---

## 1. Authentication & Session API

### `POST /api/auth/register`
Register a new user account.
- **Request Body:**
  ```json
  {
    "username": "alice_owner",
    "email": "alice@vault.local",
    "password": "AlicePassword123!",
    "role": "owner"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "c1f72740-47fa-47a3-83ec-bf86aa6364bf",
        "username": "alice_owner",
        "email": "alice@vault.local",
        "role": "owner",
        "is_active": true
      }
    }
  }
  ```

### `POST /api/auth/login`
Authenticate user credentials, issue session cookie, and return CSRF token.
- **Request Body:**
  ```json
  {
    "usernameOrEmail": "alice_owner",
    "password": "AlicePassword123!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "user": { ... },
      "csrfToken": "4a7b9c..."
    }
  }
  ```
- **Set-Cookie:** `trustvault_session=<opaque-token>; HttpOnly; SameSite=Strict; Path=/`

### `POST /api/auth/logout`
Invalidate current session and clear cookie.
- **Response (200 OK):** `{ "success": true }`

### `GET /api/auth/me`
Retrieve currently authenticated user profile.
- **Response (200 OK):** `{ "success": true, "data": { "user": { ... } } }`

---

## 2. Documents API

### `GET /api/documents`
Permission-safe document search and filtering.
- **Query Parameters:**
  - `q`: Text search across title and filename
  - `category`: Exact category match
  - `fileType`: Document file type extension (`pdf`, `txt`, `csv`, `md`)
  - `filter`: Scope (`all`, `owned`, `shared`, `trash`)
  - `sortBy`: `updated_at`, `title`, `created_at`, `file_size`
  - `sortOrder`: `asc`, `desc`
  - `limit`: Number of records (default: 20, max: 100)
  - `offset`: Pagination offset
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "documents": [ ... ],
      "pagination": { "totalCount": 5, "limit": 20, "offset": 0 },
      "facets": {
        "categories": [ { "category": "Legal", "count": 3 } ],
        "mimeTypes": [ { "mimeType": "application/pdf", "count": 5 } ]
      }
    }
  }
  ```

### `POST /api/documents`
Upload and store a new document with initial version (multipart/form-data).
- **Form Fields:**
  - `title`: string
  - `category`: string
  - `file`: binary file
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "document": { "id": "...", "title": "...", "category": "...", "current_version_number": 1 },
      "version": { "version_number": 1, "file_name": "...", "file_size": 1024, "sha256_checksum": "..." }
    }
  }
  ```

### `GET /api/documents/:id`
Retrieve document metadata and accessible version history. Returns `404` for unauthorized users.

### `GET /api/documents/:id/download`
Stream the document file binary. Returns `404` for unauthorized users.
- **Query Parameters:**
  - `version`: (optional) integer version number to download

### `POST /api/documents/:id/versions`
Upload a new document version using optimistic concurrency control.
- **Form Fields:**
  - `expectedVersion`: integer
  - `file`: binary file
- **Response:** `201 Created` on success, `409 Conflict` if version mismatch.

### `PATCH /api/documents/:id`
Update document title or category. Returns `404` for unauthorized users.

### `DELETE /api/documents/:id`
Soft-delete document (moves to trash). Returns `404` for unauthorized users.

### `POST /api/documents/:id/recover`
Restore a soft-deleted document back to active status (owner only).

---

## 3. Grants & Sharing API

### `POST /api/documents/:id/grants`
Create a document grant for another user.
- **Request Body:**
  ```json
  {
    "granteeUsernameOrEmail": "bob_viewer",
    "permission": "read",
    "expiresInHours": 24
  }
  ```
- **Response (201 Created):** `{ "success": true, "data": { "id": "...", "permission": "read" } }`

### `GET /api/documents/:id/grants`
List all active grants for the document (owner only).

### `DELETE /api/documents/:id/grants/:grantId`
Revoke a document grant instantly (owner only).

### `POST /api/documents/:id/tokens`
Generate an atomic, single-use download token.
- **Response (201 Created):** `{ "success": true, "data": { "token": "..." } }`

### `GET /api/documents/token-download?token=...`
Consume a single-use download token to download file content. Returns `410 Gone` or `404 Not Found` if expired or already consumed.

---

## 4. Admin Audit API

Restricted strictly to users with the `admin` role. Other users receive `403 Forbidden`.

### `GET /api/admin/audit`
Query append-only audit trail with optional filtering (`eventType`, `actorId`, `limit`, `offset`).

### `GET /api/admin/audit/verify`
Verify mathematical SHA-256 hash chaining from Genesis to Head.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "valid": true,
      "totalRecords": 42,
      "genesisHash": "0000000000000000000000000000000000000000000000000000000000000000",
      "headHash": "b3e5..."
    }
  }
  ```

### `GET /api/admin/audit/anomalies`
Inspect detected security anomalies (brute-force logins, IDOR probing, high download volumes).

---

## 5. Observability API

### `GET /api/health`
Health and readiness probe.
- **Response (200 OK):**
  ```json
  {
    "status": "UP",
    "database": "CONNECTED",
    "timestamp": "2026-10-22T16:50:00.000Z"
  }
  ```
