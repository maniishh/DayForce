import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { queryAll, queryOne, execute, transaction } from '../db/index.js';

const router = Router();
router.use(requireAuth);

// GET /api/v1/policies — list all policies with chunk counts
router.get('/', (_req: Request, res: Response): void => {
  const docs = queryAll<any>(
    `SELECT pd.*, COUNT(pc.id) as chunk_count
     FROM policy_documents pd
     LEFT JOIN policy_chunks pc ON pd.id = pc.document_id
     GROUP BY pd.id
     ORDER BY pd.created_at DESC`
  );
  res.json({ documents: docs });
});

// GET /api/v1/policies/:id — retrieve single policy with all chunks
router.get('/:id', (req: Request, res: Response): void => {
  const doc = queryOne<any>('SELECT * FROM policy_documents WHERE id = ?', [req.params.id]);
  if (!doc) { res.status(404).json({ error: 'Policy document not found' }); return; }
  const chunks = queryAll<any>(
    'SELECT * FROM policy_chunks WHERE document_id = ? ORDER BY chunk_index ASC',
    [req.params.id]
  );
  res.json({ document: doc, chunks });
});

const PolicyUploadSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  category: z.string().default('ATTENDANCE_AND_PUNCTUALITY'),
  content: z.string().min(20, 'Policy content must be at least 20 characters'),
  version: z.string().default('1.0'),
  effectiveFrom: z.string().default(() => new Date().toISOString().slice(0, 10)),
  location: z.string().default('ALL'),
});

// POST /api/v1/policies — upload, chunk, and index a new policy document (Admin only; Employees & Managers have read-only access)
router.post('/', requireRole('HR_ADMIN', 'SYSTEM_ADMIN'), (req: Request, res: Response): void => {
  const parsed = PolicyUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
    return;
  }

  const { title, category, content, version, effectiveFrom, location } = parsed.data;
  const tenantId = req.user!.tenantId || 'tenant-acme-corp';
  const docId = `pol-${uuidv4().substring(0, 8)}`;
  const storageKey = `policies/${tenantId}/${docId}.md`;
  const checksum = crypto.createHash('sha256').update(content).digest('hex');

  // Automatic semantic chunking: split by Section headers, markdown headings, or paragraphs
  const rawParagraphs = content.split(/(?=\n(?:#{1,3}\s+|Section\s+\d+|PART\s+\d+))/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunksToInsert: Array<{
    id: string;
    section: string;
    text: string;
    page: number;
    tokens: number;
  }> = [];

  rawParagraphs.forEach((para, idx) => {
    // Extract section title from first line if available
    const firstLine = para.split('\n')[0].replace(/^#+\s*/, '').trim();
    const sectionName = firstLine.length > 5 && firstLine.length < 80
      ? firstLine
      : `Section ${idx + 1}`;

    // If paragraph is huge, split by double newlines
    if (para.length > 800) {
      const subParts = para.split(/\n\n+/).filter(Boolean);
      subParts.forEach((part, subIdx) => {
        chunksToInsert.push({
          id: `chunk-${docId}-${idx + 1}-${subIdx + 1}`,
          section: `${sectionName} (Part ${subIdx + 1})`,
          text: part.trim(),
          page: Math.floor(idx / 3) + 1,
          tokens: Math.round(part.length / 4),
        });
      });
    } else {
      chunksToInsert.push({
        id: `chunk-${docId}-${idx + 1}`,
        section: sectionName,
        text: para,
        page: Math.floor(idx / 3) + 1,
        tokens: Math.round(para.length / 4),
      });
    }
  });

  try {
    transaction(() => {
      // 1. Insert Document
      execute(
        `INSERT INTO policy_documents
           (id, tenant_id, title, category, version, effective_from, location,
            storage_key, checksum, ingestion_status, uploaded_by, content, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'READY', ?, ?, datetime('now'))`,
        [
          docId,
          tenantId,
          title,
          category,
          version,
          effectiveFrom,
          location,
          storageKey,
          checksum,
          req.user!.displayName || req.user!.email,
          content,
        ]
      );

      // 2. Insert Chunks
      chunksToInsert.forEach((c, index) => {
        const metadataJson = JSON.stringify({
          documentId: docId,
          documentTitle: title,
          category,
          section: c.section,
          version,
          effectiveFrom,
        });
        const textHash = crypto.createHash('sha256').update(c.text).digest('hex').substring(0, 16);

        execute(
          `INSERT INTO policy_chunks
             (id, document_id, chunk_index, page, section, text_snippet, text_hash, metadata, metadata_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [
            c.id,
            docId,
            index,
            c.page,
            c.section,
            c.text,
            textHash,
            metadataJson,
            metadataJson,
          ]
        );
      });

      // 3. Log Audit Trail
      execute(
        `INSERT INTO audit_logs
           (id, tenant_id, actor_type, actor_id, action, entity_type, entity_id, before_data, before_json, after_data, after_json, reason, correlation_id, created_at)
         VALUES (?, ?, 'USER', ?, 'POLICY_UPLOADED', 'PolicyDocument', ?, null, null, ?, ?, 'User uploaded new organizational policy for RAG retrieval', ?, datetime('now'))`,
        [
          `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          tenantId,
          req.user!.id,
          docId,
          JSON.stringify({ id: docId, title, category, chunkCount: chunksToInsert.length }),
          JSON.stringify({ id: docId, title, category, chunkCount: chunksToInsert.length }),
          docId,
        ]
      );
    });

    res.status(201).json({
      message: `Policy '${title}' successfully ingested and chunked into ${chunksToInsert.length} searchable segments.`,
      document: {
        id: docId,
        title,
        category,
        version,
        effectiveFrom,
        location,
        chunkCount: chunksToInsert.length,
        ingestionStatus: 'READY',
      },
      chunks: chunksToInsert,
    });
  } catch (err: any) {
    console.error('[Policies] Ingest error:', err);
    res.status(500).json({ error: 'Failed to ingest policy', message: err.message });
  }
});

export default router;
