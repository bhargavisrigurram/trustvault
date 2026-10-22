import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../../config/index.js';
import { ALLOWED_FILE_TYPES } from '@trustvault/shared';

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedMime?: string;
  sha256Checksum?: string;
  size?: number;
}

export class StorageService {
  private filesDir: string;
  private tempDir: string;

  constructor(filesDir?: string, tempDir?: string) {
    this.filesDir = filesDir || config.storage.filesDir;
    this.tempDir = tempDir || config.storage.tempDir;
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.filesDir)) {
      fs.mkdirSync(this.filesDir, { recursive: true });
    }
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Resolve secure absolute path for a storage key.
   * Prevents path traversal by enforcing UUID format and verifying resolved directory.
   */
  getFilePath(storageKey: string): string {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(storageKey)) {
      throw new Error('Invalid storage key format: must be a valid UUID');
    }

    const resolvedPath = path.resolve(this.filesDir, `${storageKey}.bin`);
    if (!resolvedPath.startsWith(path.resolve(this.filesDir))) {
      throw new Error('Path traversal attempt detected');
    }

    return resolvedPath;
  }

  /**
   * Inspect file signature (magic bytes) to verify actual file content matches allowlist.
   */
  validateFileSignature(header: Buffer, originalExt: string): { valid: boolean; mime?: string; error?: string } {
    // 1. Explicitly check for executable and archive signatures to reject immediately
    if (header.length >= 2 && header[0] === 0x4d && header[1] === 0x5a) {
      return { valid: false, error: 'Executable files (PE/EXE) are strictly forbidden' };
    }
    if (header.length >= 4 && header[0] === 0x7f && header[1] === 0x45 && header[2] === 0x4c && header[3] === 0x46) {
      return { valid: false, error: 'ELF binaries are strictly forbidden' };
    }
    if (header.length >= 4 && header[0] === 0x50 && header[1] === 0x4b && (header[2] === 0x03 || header[2] === 0x05 || header[2] === 0x07)) {
      return { valid: false, error: 'Archive files (ZIP/JAR/Office packages) are forbidden in standard upload' };
    }
    if (header.length >= 4 && header[0] === 0x52 && header[1] === 0x61 && header[2] === 0x72 && header[3] === 0x21) {
      return { valid: false, error: 'RAR archives are strictly forbidden' };
    }
    if (header.length >= 2 && header[0] === 0x1f && header[1] === 0x8b) {
      return { valid: false, error: 'Gzip compressed files are strictly forbidden' };
    }

    // 2. PDF Signature (%PDF-)
    if (
      header.length >= 5 &&
      header[0] === 0x25 &&
      header[1] === 0x50 &&
      header[2] === 0x44 &&
      header[3] === 0x46 &&
      header[4] === 0x2d
    ) {
      if (originalExt.toLowerCase() !== '.pdf') {
        return { valid: false, error: 'File extension mismatch: content is PDF but extension is not .pdf' };
      }
      return { valid: true, mime: 'application/pdf' };
    }

    // 3. PNG Signature (\x89PNG\r\n\x1a\n)
    if (
      header.length >= 8 &&
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47 &&
      header[4] === 0x0d &&
      header[5] === 0x0a &&
      header[6] === 0x1a &&
      header[7] === 0x0a
    ) {
      if (originalExt.toLowerCase() !== '.png') {
        return { valid: false, error: 'File extension mismatch: content is PNG but extension is not .png' };
      }
      return { valid: true, mime: 'image/png' };
    }

    // 4. JPEG Signature (FF D8 FF)
    if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
      const ext = originalExt.toLowerCase();
      if (ext !== '.jpg' && ext !== '.jpeg') {
        return { valid: false, error: 'File extension mismatch: content is JPEG but extension is not .jpg/.jpeg' };
      }
      return { valid: true, mime: 'image/jpeg' };
    }

    // 5. Plain Text / Markdown / CSV Validation
    const textExtensions = ['.txt', '.md', '.markdown', '.csv'];
    if (textExtensions.includes(originalExt.toLowerCase())) {
      // Check for binary/null bytes in the header buffer
      for (let i = 0; i < header.length; i++) {
        if (header[i] === 0x00) {
          return { valid: false, error: 'Null bytes detected in text document: binary content rejected' };
        }
      }
      const ext = originalExt.toLowerCase();
      if (ext === '.csv') return { valid: true, mime: 'text/csv' };
      if (ext === '.md' || ext === '.markdown') return { valid: true, mime: 'text/markdown' };
      return { valid: true, mime: 'text/plain' };
    }

    return { valid: false, error: `Unsupported or ambiguous file format for extension '${originalExt}'` };
  }

  /**
   * Validate uploaded temporary file:
   * - Size limit check
   * - Magic byte inspection
   * - SHA-256 calculation
   */
  async validateAndInspectFile(
    tempFilePath: string,
    originalFilename: string
  ): Promise<FileValidationResult> {
    if (!fs.existsSync(tempFilePath)) {
      return { valid: false, error: 'Uploaded file not found in temporary storage' };
    }

    const stat = fs.statSync(tempFilePath);

    // Size limit
    if (stat.size > config.storage.maxFileSizeBytes) {
      return {
        valid: false,
        error: `File size exceeds the limit of ${config.storage.maxFileSizeBytes / (1024 * 1024)}MB`,
      };
    }

    if (stat.size === 0) {
      return { valid: false, error: 'Empty files are not allowed' };
    }

    // Read initial 512 bytes for magic numbers
    const fd = fs.openSync(tempFilePath, 'r');
    const headerBuffer = Buffer.alloc(Math.min(512, stat.size));
    fs.readSync(fd, headerBuffer, 0, headerBuffer.length, 0);
    fs.closeSync(fd);

    const ext = path.extname(originalFilename);
    const sigCheck = this.validateFileSignature(headerBuffer, ext);

    if (!sigCheck.valid) {
      return { valid: false, error: sigCheck.error };
    }

    // Calculate SHA-256 Checksum
    const hash = crypto.createHash('sha256');
    const fileStream = fs.createReadStream(tempFilePath);
    await new Promise<void>((resolve, reject) => {
      fileStream.on('data', (chunk) => hash.update(chunk));
      fileStream.on('end', () => resolve());
      fileStream.on('error', (err) => reject(err));
    });
    const sha256Checksum = hash.digest('hex');

    return {
      valid: true,
      detectedMime: sigCheck.mime,
      sha256Checksum,
      size: stat.size,
    };
  }

  /**
   * Move validated file from temp storage to permanent storage using a random UUID key
   */
  async commitFile(tempFilePath: string, storageKey: string): Promise<string> {
    const finalPath = this.getFilePath(storageKey);
    fs.renameSync(tempFilePath, finalPath);
    return finalPath;
  }

  /**
   * Delete temporary file on failure or abort
   */
  deleteTempFile(tempFilePath: string): void {
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (err) {
      console.error('[StorageService] Error cleaning up temporary file:', err);
    }
  }

  /**
   * Delete permanent file
   */
  deletePermanentFile(storageKey: string): void {
    try {
      const filePath = this.getFilePath(storageKey);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error('[StorageService] Error deleting permanent file:', err);
    }
  }

  /**
   * Create a readable stream for downloading a file
   */
  createReadStream(storageKey: string): fs.ReadStream {
    const filePath = this.getFilePath(storageKey);
    if (!fs.existsSync(filePath)) {
      throw new Error('Physical file not found on disk');
    }
    return fs.createReadStream(filePath);
  }

  /**
   * Check physical file existence
   */
  fileExists(storageKey: string): boolean {
    try {
      const filePath = this.getFilePath(storageKey);
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  /**
   * Storage reconciliation: detect orphaned files on disk not present in active database keys
   */
  reconcileStorage(activeStorageKeys: string[]): { orphanedFiles: string[]; missingKeys: string[] } {
    const keySet = new Set(activeStorageKeys);
    const onDiskFiles = fs.readdirSync(this.filesDir).filter((f) => f.endsWith('.bin'));

    const orphanedFiles: string[] = [];
    for (const file of onDiskFiles) {
      const key = file.replace(/\.bin$/, '');
      if (!keySet.has(key)) {
        orphanedFiles.push(key);
      }
    }

    const missingKeys: string[] = [];
    for (const key of activeStorageKeys) {
      const filePath = path.join(this.filesDir, `${key}.bin`);
      if (!fs.existsSync(filePath)) {
        missingKeys.push(key);
      }
    }

    return { orphanedFiles, missingKeys };
  }
}
