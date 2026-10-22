import { getDb, DbClient } from '../../db/index.js';
import { getDocumentAuthorizationSqlPredicate } from '../authorization/index.js';
import type {
  Document,
  DocumentVersion,
  SearchDocumentsQuery,
  DocumentSearchResult,
  DocumentSearchItem,
} from '@trustvault/shared';

export class DocumentRepository {
  constructor(private client?: DbClient) {}

  private async getClient(): Promise<DbClient> {
    return this.client || (await getDb());
  }

  async findById(id: string): Promise<Document | null> {
    const db = await this.getClient();
    const res = await db.query<Document>(
      `SELECT id, owner_id, title, category, current_version_number,
              is_deleted, deleted_at, created_at, updated_at
       FROM documents
       WHERE id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async findWithCurrentVersion(id: string): Promise<{
    document: Document;
    currentVersion: DocumentVersion | null;
  } | null> {
    const db = await this.getClient();
    const doc = await this.findById(id);
    if (!doc) return null;

    const verRes = await db.query<DocumentVersion>(
      `SELECT id, document_id, version_number, storage_key, file_name,
              file_size, mime_type, sha256_checksum, uploaded_by_id, created_at
       FROM document_versions
       WHERE document_id = $1 AND version_number = $2`,
      [id, doc.current_version_number]
    );

    return {
      document: doc,
      currentVersion: verRes.rows[0] || null,
    };
  }

  async findVersions(documentId: string): Promise<DocumentVersion[]> {
    const db = await this.getClient();
    const res = await db.query<DocumentVersion>(
      `SELECT id, document_id, version_number, storage_key, file_name,
              file_size, mime_type, sha256_checksum, uploaded_by_id, created_at
       FROM document_versions
       WHERE document_id = $1
       ORDER BY version_number DESC`,
      [documentId]
    );
    return res.rows;
  }

  async findVersionByNumber(documentId: string, versionNumber: number): Promise<DocumentVersion | null> {
    const db = await this.getClient();
    const res = await db.query<DocumentVersion>(
      `SELECT id, document_id, version_number, storage_key, file_name,
              file_size, mime_type, sha256_checksum, uploaded_by_id, created_at
       FROM document_versions
       WHERE document_id = $1 AND version_number = $2`,
      [documentId, versionNumber]
    );
    return res.rows[0] || null;
  }

  async create(data: {
    ownerId: string;
    title: string;
    category: string;
  }): Promise<Document> {
    const db = await this.getClient();
    const res = await db.query<Document>(
      `INSERT INTO documents (owner_id, title, category, current_version_number, is_deleted)
       VALUES ($1, $2, $3, 1, FALSE)
       RETURNING id, owner_id, title, category, current_version_number, is_deleted, deleted_at, created_at, updated_at`,
      [data.ownerId, data.title, data.category]
    );
    return res.rows[0];
  }

  async createVersion(data: {
    documentId: string;
    versionNumber: number;
    storageKey: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    sha256Checksum: string;
    uploadedById: string;
  }): Promise<DocumentVersion> {
    const db = await this.getClient();
    const res = await db.query<DocumentVersion>(
      `INSERT INTO document_versions (document_id, version_number, storage_key, file_name, file_size, mime_type, sha256_checksum, uploaded_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, document_id, version_number, storage_key, file_name, file_size, mime_type, sha256_checksum, uploaded_by_id, created_at`,
      [
        data.documentId,
        data.versionNumber,
        data.storageKey,
        data.fileName,
        data.fileSize,
        data.mimeType,
        data.sha256Checksum,
        data.uploadedById,
      ]
    );
    return res.rows[0];
  }

  /**
   * Update current version number with optimistic concurrency control
   */
  async updateCurrentVersion(
    documentId: string,
    newVersionNumber: number,
    expectedCurrentVersion?: number
  ): Promise<boolean> {
    const db = await this.getClient();
    let query = `UPDATE documents SET current_version_number = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`;
    const params: any[] = [documentId, newVersionNumber];

    if (expectedCurrentVersion !== undefined) {
      query += ` AND current_version_number = $3`;
      params.push(expectedCurrentVersion);
    }

    const res = await db.query(query, params);
    return res.rowCount > 0;
  }

  async updateMetadata(
    id: string,
    data: { title?: string; category?: string }
  ): Promise<Document | null> {
    const db = await this.getClient();
    const sets: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: any[] = [id];
    let idx = 2;

    if (data.title !== undefined) {
      sets.push(`title = $${idx++}`);
      params.push(data.title);
    }
    if (data.category !== undefined) {
      sets.push(`category = $${idx++}`);
      params.push(data.category);
    }

    const res = await db.query<Document>(
      `UPDATE documents
       SET ${sets.join(', ')}
       WHERE id = $1
       RETURNING id, owner_id, title, category, current_version_number, is_deleted, deleted_at, created_at, updated_at`,
      params
    );
    return res.rows[0] || null;
  }

  async softDelete(id: string): Promise<void> {
    const db = await this.getClient();
    await db.query(
      `UPDATE documents
       SET is_deleted = TRUE,
           deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );
  }

  async recover(id: string): Promise<void> {
    const db = await this.getClient();
    await db.query(
      `UPDATE documents
       SET is_deleted = FALSE,
           deleted_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );
  }

  async getAllStorageKeys(): Promise<string[]> {
    const db = await this.getClient();
    const res = await db.query<{ storage_key: string }>('SELECT storage_key FROM document_versions');
    return res.rows.map((r) => r.storage_key);
  }

  /**
   * Search and filter documents with strict database-level permission safety
   */
  async searchDocuments(
    userId: string,
    query: SearchDocumentsQuery
  ): Promise<DocumentSearchResult> {
    const db = await this.getClient();
    const whereClauses: string[] = [];
    const queryParams: any[] = [];
    let idx = 1;

    // 1. Permission safety predicate: enforced at the SQL level (never in memory)
    queryParams.push(userId);
    const userIdIdx = idx++;

    if (query.filter === 'trash') {
      // Only owner can see their soft-deleted documents
      whereClauses.push(`(d.owner_id = $${userIdIdx} AND d.is_deleted = TRUE)`);
    } else if (query.filter === 'owned') {
      whereClauses.push(`(d.owner_id = $${userIdIdx} AND d.is_deleted = FALSE)`);
    } else if (query.filter === 'shared') {
      whereClauses.push(
        `(d.owner_id != $${userIdIdx} AND d.is_deleted = FALSE AND EXISTS (
          SELECT 1 FROM document_grants g
          WHERE g.document_id = d.id
            AND g.grantee_id = $${userIdIdx}
            AND g.revoked_at IS NULL
            AND (g.expires_at IS NULL OR g.expires_at > CURRENT_TIMESTAMP)
        ))`
      );
    } else {
      // Default 'all': permission predicate
      whereClauses.push(getDocumentAuthorizationSqlPredicate(userIdIdx));
    }

    // 2. Text Search on Title or Filename
    if (query.q && query.q.trim().length > 0) {
      whereClauses.push(`(d.title ILIKE $${idx} OR v.file_name ILIKE $${idx})`);
      queryParams.push(`%${query.q.trim()}%`);
      idx++;
    }

    // 3. Category Filter
    if (query.category && query.category.trim().length > 0) {
      whereClauses.push(`d.category = $${idx}`);
      queryParams.push(query.category.trim());
      idx++;
    }

    // 4. File Type / MIME Type Filter
    if (query.mimeType && query.mimeType.trim().length > 0) {
      whereClauses.push(`v.mime_type ILIKE $${idx}`);
      queryParams.push(`%${query.mimeType.trim()}%`);
      idx++;
    } else if (query.fileType && query.fileType.trim().length > 0) {
      whereClauses.push(`(v.mime_type ILIKE $${idx} OR v.file_name ILIKE $${idx})`);
      queryParams.push(`%${query.fileType.trim()}%`);
      idx++;
    }

    // 5. Date Range Filters
    if (query.startDate) {
      whereClauses.push(`d.created_at >= $${idx}`);
      queryParams.push(new Date(query.startDate).toISOString());
      idx++;
    }
    if (query.endDate) {
      whereClauses.push(`d.created_at <= $${idx}`);
      queryParams.push(new Date(query.endDate).toISOString());
      idx++;
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

    // 6. Safe Sorting mapping
    let sortColumn = 'd.updated_at';
    if (query.sortBy === 'title') sortColumn = 'd.title';
    else if (query.sortBy === 'created_at') sortColumn = 'd.created_at';
    else if (query.sortBy === 'file_size') sortColumn = 'COALESCE(v.file_size, 0)';

    const sortOrder = query.sortOrder === 'asc' ? 'ASC' : 'DESC';

    // 7. Total count query (matching the exact authorized where clause)
    const countRes = await db.query<{ count: string | number }>(
      `SELECT COUNT(*) as count
       FROM documents d
       LEFT JOIN document_versions v ON v.document_id = d.id AND v.version_number = d.current_version_number
       ${whereSql}`,
      queryParams
    );
    const totalCount = Number(countRes.rows[0]?.count ?? 0);

    // 8. Facet counts (Category & MimeType within authorized scope)
    const categoryFacetsRes = await db.query<{ category: string; count: string | number }>(
      `SELECT d.category, COUNT(*) as count
       FROM documents d
       LEFT JOIN document_versions v ON v.document_id = d.id AND v.version_number = d.current_version_number
       ${whereSql}
       GROUP BY d.category
       ORDER BY count DESC`,
      queryParams
    );

    const mimeFacetsRes = await db.query<{ mime_type: string; count: string | number }>(
      `SELECT v.mime_type, COUNT(*) as count
       FROM documents d
       LEFT JOIN document_versions v ON v.document_id = d.id AND v.version_number = d.current_version_number
       ${whereSql} AND v.mime_type IS NOT NULL
       GROUP BY v.mime_type
       ORDER BY count DESC`,
      queryParams
    );

    // 9. Document data query with bounded pagination
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const offset = Math.max(query.offset || 0, 0);

    const docQueryParams = [...queryParams, limit, offset];
    const limitIdx = idx++;
    const offsetIdx = idx++;

    const docsRes = await db.query<any>(
      `SELECT
         d.id,
         d.title,
         d.category,
         d.owner_id,
         u.username AS owner_username,
         d.current_version_number,
         v.file_name,
         v.file_size,
         v.mime_type,
         v.sha256_checksum,
         d.is_deleted,
         d.created_at,
         d.updated_at,
         CASE
           WHEN d.owner_id = $${userIdIdx} THEN 'owner'
           WHEN (
             SELECT g.permission FROM document_grants g
             WHERE g.document_id = d.id AND g.grantee_id = $${userIdIdx}
               AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at > CURRENT_TIMESTAMP)
             ORDER BY CASE WHEN g.permission = 'edit' THEN 1 ELSE 2 END
             LIMIT 1
           ) = 'edit' THEN 'edit'
           ELSE 'read'
         END AS effective_permission
       FROM documents d
       LEFT JOIN document_versions v ON v.document_id = d.id AND v.version_number = d.current_version_number
       JOIN users u ON u.id = d.owner_id
       ${whereSql}
       ORDER BY ${sortColumn} ${sortOrder}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      docQueryParams
    );

    const documents: DocumentSearchItem[] = docsRes.rows.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      owner_id: r.owner_id,
      owner_username: r.owner_username,
      current_version_number: Number(r.current_version_number),
      file_name: r.file_name || null,
      file_size: r.file_size !== null ? Number(r.file_size) : null,
      mime_type: r.mime_type || null,
      sha256_checksum: r.sha256_checksum || null,
      effective_permission: r.effective_permission,
      is_deleted: Boolean(r.is_deleted),
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    return {
      documents,
      pagination: {
        totalCount,
        limit,
        offset,
        hasMore: offset + documents.length < totalCount,
      },
      facets: {
        categories: categoryFacetsRes.rows.map((r) => ({
          category: r.category,
          count: Number(r.count),
        })),
        mimeTypes: mimeFacetsRes.rows.map((r) => ({
          mimeType: r.mime_type,
          count: Number(r.count),
        })),
      },
    };
  }
}
