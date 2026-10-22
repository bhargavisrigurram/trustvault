import { getDb, DbClient } from '../../db/index.js';
import type { Document, DocumentVersion } from '@trustvault/shared';

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
}
