import type {
  User,
  DocumentSearchResult,
  SearchDocumentsQuery,
  Document,
  DocumentVersion,
  DocumentGrant,
  AuditRecord,
} from '@trustvault/shared';

class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// In-memory CSRF token store (synchronized with session)
let csrfTokenStore: string | null = null;

export function setCsrfToken(token: string | null) {
  csrfTokenStore = token;
}

export function getCsrfToken(): string | null {
  return csrfTokenStore;
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});

  // Send CSRF token on state-changing methods
  if (csrfTokenStore && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method || 'GET')) {
    headers.set('x-csrf-token', csrfTokenStore);
  }

  // Include cookies for server-side session authentication
  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type') || '';
  let responseData: any = null;

  if (contentType.includes('application/json')) {
    responseData = await response.json();
  }

  if (!response.ok) {
    const error = responseData?.error || {};
    throw new ApiError(
      error.code || 'REQUEST_FAILED',
      error.message || `Request failed with status ${response.status}`,
      response.status,
      error.details
    );
  }

  return responseData?.data !== undefined ? responseData.data : responseData;
}

// ==========================================
// API Methods
// ==========================================

export const api = {
  // Auth
  async register(data: any): Promise<{ user: User }> {
    return apiFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async login(credentials: any): Promise<{ user: User; csrfToken: string }> {
    const data = await apiFetch<{ user: User; csrfToken: string }>('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    setCsrfToken(data.csrfToken);
    return data;
  },

  async logout(): Promise<void> {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setCsrfToken(null);
  },

  async me(): Promise<{ user: User; csrfToken: string }> {
    const data = await apiFetch<{ user: User; csrfToken: string }>('/api/auth/me');
    setCsrfToken(data.csrfToken);
    return data;
  },

  // Documents
  async searchDocuments(query: Partial<SearchDocumentsQuery> = {}): Promise<DocumentSearchResult> {
    const searchParams = new URLSearchParams();
    Object.entries(query).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.set(key, String(val));
      }
    });

    const queryString = searchParams.toString();
    const endpoint = queryString ? `/api/documents?${queryString}` : '/api/documents';
    return apiFetch<DocumentSearchResult>(endpoint);
  },

  async getDocument(
    id: string
  ): Promise<{ document: Document; currentVersion: DocumentVersion | null; versions: DocumentVersion[] }> {
    return apiFetch(`/api/documents/${id}`);
  },

  async uploadDocument(formData: FormData): Promise<{ document: Document; version: DocumentVersion }> {
    return apiFetch('/api/documents', {
      method: 'POST',
      body: formData,
    });
  },

  async uploadVersion(
    documentId: string,
    formData: FormData
  ): Promise<{ document: Document; version: DocumentVersion }> {
    return apiFetch(`/api/documents/${documentId}/versions`, {
      method: 'POST',
      body: formData,
    });
  },

  async updateDocument(documentId: string, data: { title?: string; category?: string }): Promise<Document> {
    return apiFetch(`/api/documents/${documentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async deleteDocument(documentId: string): Promise<void> {
    await apiFetch(`/api/documents/${documentId}`, { method: 'DELETE' });
  },

  async recoverDocument(documentId: string): Promise<void> {
    await apiFetch(`/api/documents/${documentId}/recover`, { method: 'POST' });
  },

  // One-time download token
  async issueDownloadToken(
    documentId: string,
    versionNumber?: number
  ): Promise<{ token: string; expiresAt: string }> {
    return apiFetch(`/api/documents/${documentId}/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ versionNumber }),
    });
  },

  getDownloadUrl(token: string): string {
    return `/api/documents/token-download?token=${encodeURIComponent(token)}`;
  },

  // Sharing & Grants
  async listGrants(documentId: string): Promise<DocumentGrant[]> {
    return apiFetch(`/api/documents/${documentId}/grants`);
  },

  async createGrant(
    documentId: string,
    data: { granteeUsernameOrEmail: string; permission: 'read' | 'edit'; expiresInHours?: number }
  ): Promise<DocumentGrant> {
    return apiFetch(`/api/documents/${documentId}/grants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async revokeGrant(documentId: string, grantId: string): Promise<void> {
    await apiFetch(`/api/documents/${documentId}/grants/${grantId}`, {
      method: 'DELETE',
    });
  },

  // Admin Audit Dashboard
  async verifyAuditChain(): Promise<{
    valid: boolean;
    recordCount: number;
    genesisHash: string;
    headHash: string | null;
    brokenSequence?: number;
    error?: string;
  }> {
    return apiFetch('/api/admin/audit/verify');
  },

  async getAuditAnomalies(): Promise<{
    repeatedDeniedAttempts: Array<{ actor_username: string; count: number; last_attempt: string }>;
    failedLogins: Array<{ actor_username: string; count: number; last_attempt: string }>;
    unusualDownloads: Array<{ actor_username: string; count: number }>;
  }> {
    return apiFetch('/api/admin/audit/anomalies');
  },

  async queryAuditLogs(filters: {
    eventType?: string;
    outcome?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ records: AuditRecord[]; totalCount: number }> {
    const params = new URLSearchParams();
    if (filters.eventType) params.set('eventType', filters.eventType);
    if (filters.outcome) params.set('outcome', filters.outcome);
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.offset) params.set('offset', String(filters.offset));

    return apiFetch(`/api/admin/audit?${params.toString()}`);
  },
};
