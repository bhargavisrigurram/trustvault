import { z } from 'zod';

// ==========================================
// User Roles & Models
// ==========================================

export const UserRole = {
  ADMIN: 'admin',
  OWNER: 'owner',
  VIEWER: 'viewer',
} as const;

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

export const UserSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(3).max(50),
  email: z.string().email(),
  role: z.enum(['admin', 'owner', 'viewer']),
  is_active: z.boolean().default(true),
  created_at: z.string().or(z.date()),
  updated_at: z.string().or(z.date()),
});

export type User = z.infer<typeof UserSchema>;

// Safe user profile without secrets or internal hashes
export const SafeUserSchema = UserSchema.omit({});
export type SafeUser = z.infer<typeof SafeUserSchema>;

// ==========================================
// Authentication Schemas
// ==========================================

export const RegisterRequestSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must not exceed 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain alphanumeric characters, underscores, and hyphens'),
  email: z.string().email('Invalid email address').max(100),
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters long')
    .max(128, 'Password is too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  role: z.enum(['admin', 'owner', 'viewer']).default('viewer'),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  usernameOrEmail: z.string().min(1, 'Username or email is required').max(100),
  password: z.string().min(1, 'Password is required').max(128),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

// ==========================================
// Session
// ==========================================

export interface SessionData {
  id: string;
  userId: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
}

// ==========================================
// Document Actions & Permissions
// ==========================================

export const DocumentAction = {
  READ: 'read',
  DOWNLOAD: 'download',
  EDIT: 'edit',
  VERSION: 'version',
  DELETE: 'delete',
  RECOVER: 'recover',
  SHARE: 'share',
  REVOKE: 'revoke',
  AUDIT: 'audit',
} as const;

export type DocumentActionType = (typeof DocumentAction)[keyof typeof DocumentAction];

export const GrantPermission = {
  READ: 'read',
  EDIT: 'edit',
} as const;

export type GrantPermissionType = (typeof GrantPermission)[keyof typeof GrantPermission];

// ==========================================
// Document Entities
// ==========================================

export const DocumentSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  title: z.string().min(1).max(255),
  category: z.string().min(1).max(100).default('General'),
  current_version_number: z.number().int().min(1).default(1),
  is_deleted: z.boolean().default(false),
  deleted_at: z.string().or(z.date()).nullable().optional(),
  created_at: z.string().or(z.date()),
  updated_at: z.string().or(z.date()),
});

export type Document = z.infer<typeof DocumentSchema>;

export const DocumentGrantSchema = z.object({
  id: z.string().uuid(),
  document_id: z.string().uuid(),
  grantee_id: z.string().uuid(),
  granted_by_id: z.string().uuid(),
  permission: z.enum(['read', 'edit']),
  expires_at: z.string().or(z.date()).nullable().optional(),
  revoked_at: z.string().or(z.date()).nullable().optional(),
  created_at: z.string().or(z.date()),
});

export type DocumentGrant = z.infer<typeof DocumentGrantSchema>;

export const DocumentVersionSchema = z.object({
  id: z.string().uuid(),
  document_id: z.string().uuid(),
  version_number: z.number().int().min(1),
  storage_key: z.string().uuid(),
  file_name: z.string().min(1).max(255),
  file_size: z.number().int().nonnegative(),
  mime_type: z.string().min(1).max(100),
  sha256_checksum: z.string().length(64),
  uploaded_by_id: z.string().uuid(),
  created_at: z.string().or(z.date()),
});

export type DocumentVersion = z.infer<typeof DocumentVersionSchema>;

// ==========================================
// File Upload & Type Allowlist
// ==========================================

export const ALLOWED_FILE_TYPES: Record<string, { mime: string; extensions: string[] }> = {
  pdf: { mime: 'application/pdf', extensions: ['.pdf'] },
  png: { mime: 'image/png', extensions: ['.png'] },
  jpeg: { mime: 'image/jpeg', extensions: ['.jpg', '.jpeg'] },
  txt: { mime: 'text/plain', extensions: ['.txt'] },
  md: { mime: 'text/markdown', extensions: ['.md', '.markdown'] },
  csv: { mime: 'text/csv', extensions: ['.csv'] },
};

export const ALLOWED_MIME_TYPES = Object.values(ALLOWED_FILE_TYPES).map((t) => t.mime);

export const CreateDocumentRequestSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(255, 'Title must not exceed 255 characters')
    .transform((t) => t.trim()),
  category: z
    .string()
    .min(1, 'Category is required')
    .max(100, 'Category must not exceed 100 characters')
    .default('General')
    .transform((c) => c.trim()),
});

export type CreateDocumentRequest = z.infer<typeof CreateDocumentRequestSchema>;

export const UpdateDocumentRequestSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(255, 'Title must not exceed 255 characters')
    .optional()
    .transform((t) => t?.trim()),
  category: z
    .string()
    .min(1, 'Category is required')
    .max(100, 'Category must not exceed 100 characters')
    .optional()
    .transform((c) => c?.trim()),
});

export type UpdateDocumentRequest = z.infer<typeof UpdateDocumentRequestSchema>;

export const CreateVersionRequestSchema = z.object({
  expectedVersion: z.coerce.number().int().min(1).optional(),
});

export type CreateVersionRequest = z.infer<typeof CreateVersionRequestSchema>;

// ==========================================
// Sharing & Grants Schemas
// ==========================================

export const CreateGrantRequestSchema = z.object({
  granteeUsernameOrEmail: z.string().min(1, 'Grantee username or email is required').max(100),
  permission: z.enum(['read', 'edit']),
  expiresInHours: z.coerce.number().int().min(1).max(8760).optional(), // Max 1 year
});

export type CreateGrantRequest = z.infer<typeof CreateGrantRequestSchema>;

export const CreateDownloadTokenRequestSchema = z.object({
  versionNumber: z.coerce.number().int().min(1).optional(),
});

export type CreateDownloadTokenRequest = z.infer<typeof CreateDownloadTokenRequestSchema>;

/**
 * Sanitize filenames for display and storage metadata:
 * - Strip directory traversal characters (../, ..\, etc.)
 * - Strip control characters and HTML tags (prevent stored XSS)
 * - Restrict to safe ASCII and common punctuation
 */
export function sanitizeFilename(filename: string): string {
  // Extract basename to eliminate path components
  const base = filename.replace(/^.*[\\/]/, '');
  // Strip control chars, HTML/script tags, and dangerous symbols
  const sanitized = base
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/&/g, '&amp;')
    .trim();
  return sanitized.length > 0 ? sanitized.slice(0, 255) : 'unnamed_file';
}

// ==========================================
// Authorization Result
// ==========================================

export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
  statusCode?: 401 | 403 | 404;
}

// ==========================================
// API Standard Responses
// ==========================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
