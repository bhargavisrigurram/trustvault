# TrustVault Permission & Authorization Model

This document outlines the role definitions, permissions matrix, grant delegation model, and state transition rules enforced by TrustVault.

---

## 1. System Roles

TrustVault enforces three distinct system roles:

| Role | Scope | Description |
|---|---|---|
| **`owner`** | User & Document Domain | Standard document creator and vault owner. Can upload, manage versions, share grants, and soft-delete own documents. |
| **`viewer`** | Consumption Domain | Standard user capable of receiving read or edit grants on shared documents. Cannot create top-level documents unless elevated. |
| **`admin`** | Compliance & Audit Domain | System administrator. Can review user accounts, query security anomalies, and verify the cryptographic audit chain. **Has NO implicit document content access.** |

---

## 2. Document Permission Matrix

Permissions on individual documents depend on user ownership and explicit grants:

| Document Action | Owner | Grantee: `edit` | Grantee: `read` | Admin | Unauthenticated / Other |
|---|:---:|:---:|:---:|:---:|:---:|
| **`read`** (View metadata) | ✅ Allowed | ✅ Allowed | ✅ Allowed | ❌ 404 Not Found | ❌ 401 / 404 |
| **`download`** (Stream file) | ✅ Allowed | ✅ Allowed | ✅ Allowed | ❌ 404 Not Found | ❌ 401 / 404 |
| **`version`** (Upload new version) | ✅ Allowed | ✅ Allowed | ❌ 404 Not Found | ❌ 404 Not Found | ❌ 401 / 404 |
| **`edit`** (Update title/category) | ✅ Allowed | ✅ Allowed | ❌ 404 Not Found | ❌ 404 Not Found | ❌ 401 / 404 |
| **`delete`** (Soft-delete document) | ✅ Allowed | ❌ 404 Not Found | ❌ 404 Not Found | ❌ 404 Not Found | ❌ 401 / 404 |
| **`recover`** (Restore soft-deleted) | ✅ Allowed | ❌ 404 Not Found | ❌ 404 Not Found | ❌ 404 Not Found | ❌ 401 / 404 |
| **`share`** (Create document grant) | ✅ Allowed | ❌ 404 Not Found | ❌ 404 Not Found | ❌ 404 Not Found | ❌ 401 / 404 |
| **`revoke`** (Delete document grant) | ✅ Allowed | ❌ 404 Not Found | ❌ 404 Not Found | ❌ 404 Not Found | ❌ 401 / 404 |
| **`audit`** (Query audit trail) | ❌ 403 Forbidden | ❌ 403 Forbidden | ❌ 403 Forbidden | ✅ Allowed | ❌ 401 / 403 |

> **Note on 404 vs 403**: Whenever an unauthorized user attempts an action on a document they do not own and lack a grant for, TrustVault returns **`404 Not Found`** instead of `403 Forbidden` to prevent resource enumeration and IDOR probing.

---

## 3. Grant Lifecycle & Delegation Rules

1. **Grant Creation:** Only the document owner can grant permissions (`read` or `edit`) to other registered users by username or email.
2. **Expiration Time-To-Live:** Grants support optional expiration (`expires_at` or `expiresInHours`). Once the timestamp expires, the central authorization engine treats the grant as void.
3. **Instant Revocation:** Revoking a grant immediately denies subsequent requests.
4. **Grant Immutability:** Grantees cannot delegate or re-share documents.

---

## 4. Soft-Deletion State Transitions

Documents adhere to a strict soft-deletion lifecycle:

```
[ Active Document ]
       │
       │ DELETE /api/documents/:id (Owner Only)
       ▼
[ Soft-Deleted (is_deleted = true) ]
       ├── Downloads Blocked (Owner & Grantees get 404)
       ├── Excluded from Standard Search & Facet Counts
       ├── Accessible only in Trash Scope (Owner Only)
       │
       │ POST /api/documents/:id/recover (Owner Only)
       ▼
[ Active Document Restored ]
```
