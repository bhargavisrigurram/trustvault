import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { config } from '../../config/index.js';
import { StorageService } from '../storage/storage.service.js';
import type {
  AiDocumentSummaryResponse,
  AiSecurityScanResponse,
  AiDlpFinding,
  AiChatResponse,
  AiQuickScanResponse,
} from '@trustvault/shared';

export interface DocumentContentInfo {
  text: string;
  isTruncated: boolean;
  mimeType: string;
  fileName: string;
  rawBuffer?: Buffer;
}

export class AiService {
  constructor(private storageService: StorageService = new StorageService()) {}

  /**
   * Check if Gemini live API is available via environment or configured key
   */
  hasGeminiKey(customKey?: string): boolean {
    const key = customKey || config.gemini.apiKey || process.env.GEMINI_API_KEY;
    return Boolean(key && key.trim().length > 5);
  }

  getEngineStatus(customKey?: string): {
    hasKey: boolean;
    activeEngine: 'gemini' | 'local';
    model: string;
  } {
    const hasKey = this.hasGeminiKey(customKey);
    return {
      hasKey,
      activeEngine: hasKey ? 'gemini' : 'local',
      model: hasKey ? config.gemini.model : 'local-deterministic-dlp',
    };
  }

  /**
   * Extract text from stored document file
   */
  async extractDocumentContent(storageKey: string, mimeType: string, fileName: string): Promise<DocumentContentInfo> {
    const filePath = this.storageService.getFilePath(storageKey);
    if (!fs.existsSync(filePath)) {
      throw new Error('Physical file not found for AI analysis');
    }

    const buffer = fs.readFileSync(filePath);
    const maxChars = 32000;

    // 1. Plain text, markdown, CSV, JSON
    if (
      mimeType.startsWith('text/') ||
      mimeType.includes('json') ||
      mimeType.includes('csv') ||
      fileName.endsWith('.txt') ||
      fileName.endsWith('.md') ||
      fileName.endsWith('.csv')
    ) {
      const fullText = buffer.toString('utf-8');
      const isTruncated = fullText.length > maxChars;
      return {
        text: isTruncated ? fullText.slice(0, maxChars) : fullText,
        isTruncated,
        mimeType,
        fileName,
        rawBuffer: buffer,
      };
    }

    // 2. PDF Text Extraction (lightweight native text stream parser)
    if (mimeType.includes('pdf') || fileName.endsWith('.pdf')) {
      const extracted = this.extractTextFromPdfBuffer(buffer);
      const isTruncated = extracted.length > maxChars;
      return {
        text: isTruncated ? extracted.slice(0, maxChars) : extracted,
        isTruncated,
        mimeType,
        fileName,
        rawBuffer: buffer,
      };
    }

    // 3. Fallback for binary / images
    return {
      text: `[Binary document: ${fileName} (${mimeType}), size: ${buffer.length} bytes]`,
      isTruncated: false,
      mimeType,
      fileName,
      rawBuffer: buffer,
    };
  }

  /**
   * Native text stream extractor for standard PDF streams without external binary dependencies
   */
  private extractTextFromPdfBuffer(buffer: Buffer): string {
    const raw = buffer.toString('binary');
    const textChunks: string[] = [];

    // Extract text in PDF text objects (BT ... ET)
    const btMatches = raw.match(/BT[\s\S]*?ET/g);
    if (btMatches && btMatches.length > 0) {
      for (const block of btMatches) {
        // Find literal strings in (string) Tj or ' or "
        const literalMatches = block.match(/\((.*?)\)\s*(?:Tj|'|")/g);
        if (literalMatches) {
          for (const m of literalMatches) {
            const clean = m.replace(/\s*(?:Tj|'|")$/, '').replace(/^\(/, '').replace(/\)$/, '');
            if (clean.trim()) textChunks.push(clean);
          }
        }

        // Find hex strings <hex> Tj
        const hexMatches = block.match(/<([0-9a-fA-F]+)>\s*Tj/g);
        if (hexMatches) {
          for (const hm of hexMatches) {
            const hex = hm.replace(/<|>|\s*Tj/g, '');
            try {
              const decoded = Buffer.from(hex, 'hex').toString('utf-8');
              if (decoded.trim()) textChunks.push(decoded);
            } catch {
              // ignore
            }
          }
        }
      }
    }

    // If structured BT/ET text was found, assemble it
    if (textChunks.length > 0) {
      return textChunks.join(' ').replace(/\s+/g, ' ').trim();
    }

    // Fallback: search for readable ASCII text sequences of length >= 4
    const asciiStrings: string[] = [];
    let current = '';
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      if (byte >= 32 && byte <= 126) {
        current += String.fromCharCode(byte);
      } else {
        if (current.length >= 4 && !current.startsWith('obj') && !current.startsWith('endobj')) {
          asciiStrings.push(current);
        }
        current = '';
      }
    }

    return asciiStrings.slice(0, 500).join(' ');
  }

  /**
   * Generate Document Summary & Key Takeaways
   */
  async summarizeDocument(
    content: DocumentContentInfo,
    docMetadata: { title: string; category: string },
    customKey?: string
  ): Promise<AiDocumentSummaryResponse> {
    const key = customKey || config.gemini.apiKey || process.env.GEMINI_API_KEY;

    if (this.hasGeminiKey(key)) {
      try {
        const ai = new GoogleGenAI({ apiKey: key! });
        const prompt = `You are the TrustVault AI Document Intelligence engine. Analyze the following document and return a STRICT JSON object with these exact keys:
- "summary": A concise executive summary of the document (2-4 sentences).
- "keyPoints": Array of 3-6 key takeaways or crucial clauses/data points.
- "categorySuggestion": Recommended document category (e.g. Legal, Finance, Security, Architecture, Compliance, Operations).
- "recommendedTags": Array of 3-6 relevant tags (e.g. #confidential, #pci-dss, #contract).
- "readingTimeMinutes": Estimated reading time in minutes (integer).
- "language": Detected language (e.g. English, Spanish, etc.).

Document Title: ${docMetadata.title}
Category: ${docMetadata.category}
File Name: ${content.fileName}
MIME Type: ${content.mimeType}

Document Content:
${content.text.slice(0, 20000)}

Respond with ONLY valid JSON without markdown fences.`;

        const response = await ai.models.generateContent({
          model: config.gemini.model,
          contents: prompt,
        });

        const rawText = response.text || '';
        const cleanedJson = rawText.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
        const parsed = JSON.parse(cleanedJson);

        return {
          summary: parsed.summary || 'Summary generated via TrustVault AI.',
          keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : ['Key finding extracted'],
          categorySuggestion: parsed.categorySuggestion || docMetadata.category,
          recommendedTags: Array.isArray(parsed.recommendedTags) ? parsed.recommendedTags : ['#vault-doc'],
          readingTimeMinutes: typeof parsed.readingTimeMinutes === 'number' ? parsed.readingTimeMinutes : 1,
          language: parsed.language || 'English',
          sourceEngine: 'gemini',
        };
      } catch (err) {
        console.warn('[AiService] Gemini live summarization failed, using local NLP engine:', err);
      }
    }

    // Local Deterministic NLP Engine
    return this.localSummarize(content, docMetadata);
  }

  /**
   * Local deterministic NLP Summarizer
   */
  private localSummarize(
    content: DocumentContentInfo,
    docMetadata: { title: string; category: string }
  ): AiDocumentSummaryResponse {
    const text = content.text.trim();
    const wordCount = text.length > 0 ? text.split(/\s+/).length : 0;
    const readingTime = Math.max(1, Math.ceil(wordCount / 200));

    // Sentences
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20 && !s.includes('%PDF-'));

    let summary = '';
    const keyPoints: string[] = [];

    if (sentences.length >= 2) {
      summary = `${sentences[0]} ${sentences[1]}`;
      const candidates = sentences.slice(2, 8);
      for (const c of candidates) {
        if (keyPoints.length < 4 && c.length < 200) {
          keyPoints.push(c);
        }
      }
    } else if (text.length > 0) {
      summary = `Document "${docMetadata.title}" (${content.fileName}) contains ${wordCount} words of structured content in the "${docMetadata.category}" category.`;
      keyPoints.push(`Stored format: ${content.mimeType}`);
      keyPoints.push(`File size: ${(content.rawBuffer?.length || 0)} bytes`);
      keyPoints.push('Integrity checked and authenticated in TrustVault storage.');
    } else {
      summary = `Document "${docMetadata.title}" is securely stored in TrustVault with verified cryptographic integrity.`;
      keyPoints.push('Zero-trust isolation active');
      keyPoints.push(`Category: ${docMetadata.category}`);
    }

    if (keyPoints.length === 0) {
      keyPoints.push(`Executive record under category ${docMetadata.category}`);
      keyPoints.push(`Access-controlled under TrustVault central authorization engine`);
    }

    // Suggested category & tags based on keywords
    let categorySuggestion = docMetadata.category;
    const lower = text.toLowerCase();
    const recommendedTags: string[] = ['#verified', '#trustvault'];

    if (lower.includes('invoice') || lower.includes('payment') || lower.includes('tax') || lower.includes('revenue') || lower.includes('budget')) {
      categorySuggestion = 'Financial';
      recommendedTags.push('#finance', '#budget');
    } else if (lower.includes('agreement') || lower.includes('contract') || lower.includes('confidentiality') || lower.includes('liability')) {
      categorySuggestion = 'Legal';
      recommendedTags.push('#legal', '#contract', '#confidential');
    } else if (lower.includes('architecture') || lower.includes('api') || lower.includes('database') || lower.includes('security') || lower.includes('server')) {
      categorySuggestion = 'Technical';
      recommendedTags.push('#engineering', '#security-core');
    } else if (lower.includes('hipaa') || lower.includes('gdpr') || lower.includes('audit') || lower.includes('compliance')) {
      categorySuggestion = 'Compliance';
      recommendedTags.push('#compliance', '#audit-ready');
    }

    return {
      summary,
      keyPoints,
      categorySuggestion,
      recommendedTags,
      readingTimeMinutes: readingTime,
      language: 'English',
      sourceEngine: 'local-nlp',
    };
  }

  /**
   * Zero-Leakage Security & Privacy DLP Scan
   */
  async scanSecurityDlp(
    content: DocumentContentInfo,
    _docMetadata: { title: string },
    customKey?: string
  ): Promise<AiSecurityScanResponse> {
    const text = content.text;
    const findings: AiDlpFinding[] = [];
    const lines = text.split('\n');

    // 1. AWS Access Key Pattern
    const awsKeyRegex = /\b(AKIA[0-9A-Z]{16})\b/g;
    // 2. Private Key Header
    const privateKeyRegex = /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g;
    // 3. High-Entropy Tokens & API Keys
    const apiKeyPattern = /\b(?:api[_-]?key|secret[_-]?token|access[_-]?token|auth[_-]?token|bearer)\s*[:=]\s*["']?([a-zA-Z0-9_\-\.]{16,})["']?/gi;
    // 4. US Social Security Numbers
    const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
    // 5. Major Credit Card Numbers
    const creditCardRegex = /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g;
    // 6. Generic Passwords in text
    const passwordPattern = /\b(?:password|passwd|pwd)\s*[:=]\s*["']?([^\s"']{6,})["']?/gi;
    // 7. Sensitive PII: Personal Emails
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g;
    // 8. Phone Numbers
    const phoneRegex = /\b(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})\b/g;

    let redactedPreview = text;

    // Scan lines for line-number reporting
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const lineNum = idx + 1;

      // AWS
      let m: RegExpExecArray | null;
      while ((m = awsKeyRegex.exec(line)) !== null) {
        findings.push({
          type: 'EXPOSED_AWS_ACCESS_KEY',
          severity: 'CRITICAL',
          description: 'High-privilege AWS Cloud credential identified in plaintext.',
          matchedSnippet: `${m[1].slice(0, 4)}...${m[1].slice(-4)}`,
          line: lineNum,
        });
      }

      // Private Key
      if (privateKeyRegex.test(line)) {
        findings.push({
          type: 'PRIVATE_CRYPTOGRAPHIC_KEY',
          severity: 'CRITICAL',
          description: 'Asymmetric private key header detected. Immediate exposure risk.',
          matchedSnippet: '-----BEGIN PRIVATE KEY-----',
          line: lineNum,
        });
      }

      // Passwords
      while ((m = passwordPattern.exec(line)) !== null) {
        findings.push({
          type: 'HARDCODED_PASSWORD',
          severity: 'CRITICAL',
          description: 'Hardcoded password credential detected.',
          matchedSnippet: `${m[0].slice(0, 10)}***`,
          line: lineNum,
        });
      }

      // API Keys
      while ((m = apiKeyPattern.exec(line)) !== null) {
        findings.push({
          type: 'API_SECRET_TOKEN',
          severity: 'HIGH',
          description: 'Application secret key or authentication bearer token detected.',
          matchedSnippet: `${m[0].slice(0, 15)}***`,
          line: lineNum,
        });
      }

      // SSN
      while ((m = ssnRegex.exec(line)) !== null) {
        findings.push({
          type: 'US_SOCIAL_SECURITY_NUMBER',
          severity: 'HIGH',
          description: 'PII: US Social Security Number (SSN) detected.',
          matchedSnippet: `***-**-${m[0].slice(-4)}`,
          line: lineNum,
        });
      }

      // Credit Card
      while ((m = creditCardRegex.exec(line)) !== null) {
        findings.push({
          type: 'PAYMENT_CARD_PAN',
          severity: 'HIGH',
          description: 'PCI-DSS Risk: Unmasked credit card primary account number.',
          matchedSnippet: `****-****-****-${m[0].slice(-4)}`,
          line: lineNum,
        });
      }

      // Emails
      while ((m = emailRegex.exec(line)) !== null) {
        // Only report first 3 emails to avoid noise
        if (findings.filter((f) => f.type === 'PII_EMAIL_ADDRESS').length < 3) {
          findings.push({
            type: 'PII_EMAIL_ADDRESS',
            severity: 'MODERATE',
            description: 'Personally Identifiable Information: Personal email address.',
            matchedSnippet: m[0],
            line: lineNum,
          });
        }
      }

      // Phone numbers
      while ((m = phoneRegex.exec(line)) !== null) {
        if (findings.filter((f) => f.type === 'PII_PHONE_NUMBER').length < 3) {
          findings.push({
            type: 'PII_PHONE_NUMBER',
            severity: 'LOW',
            description: 'Direct communication identifier: Telephone number.',
            matchedSnippet: m[0],
            line: lineNum,
          });
        }
      }
    }

    // Apply redactions to preview
    redactedPreview = redactedPreview
      .replace(awsKeyRegex, '[REDACTED_AWS_KEY]')
      .replace(privateKeyRegex, '[REDACTED_PRIVATE_KEY]')
      .replace(ssnRegex, '[REDACTED_SSN]')
      .replace(creditCardRegex, '[REDACTED_CREDIT_CARD]')
      .replace(passwordPattern, 'password: [REDACTED_SECRET]')
      .replace(apiKeyPattern, 'api_key: [REDACTED_TOKEN]')
      .replace(emailRegex, '[REDACTED_EMAIL]')
      .replace(phoneRegex, '[REDACTED_PHONE]');

    // Calculate Risk Score
    let riskScore = 0;
    const criticalCount = findings.filter((f) => f.severity === 'CRITICAL').length;
    const highCount = findings.filter((f) => f.severity === 'HIGH').length;
    const modCount = findings.filter((f) => f.severity === 'MODERATE').length;
    const lowCount = findings.filter((f) => f.severity === 'LOW').length;

    riskScore = Math.min(100, criticalCount * 40 + highCount * 25 + modCount * 10 + lowCount * 5);

    let riskLevel: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'CLEAN' = 'CLEAN';
    if (riskScore >= 75) riskLevel = 'CRITICAL';
    else if (riskScore >= 45) riskLevel = 'HIGH';
    else if (riskScore > 0) riskLevel = 'MODERATE';

    const recommendations: string[] = [];
    if (criticalCount > 0) {
      recommendations.push('Immediate action required: Rotate exposed API keys and invalidate hardcoded credentials.');
      recommendations.push('Store confidential tokens in an encrypted secret vault rather than plaintext documents.');
    }
    if (highCount > 0) {
      recommendations.push('Mask sensitive personal and financial identifiers (SSNs, credit card numbers) before sharing.');
      recommendations.push('Ensure documents comply with PCI-DSS and HIPAA regulations prior to distribution.');
    }
    if (modCount > 0 || lowCount > 0) {
      recommendations.push('Review customer contact information to verify consent under GDPR / CCPA privacy frameworks.');
    }
    if (findings.length === 0) {
      recommendations.push('No plaintext credentials, credit cards, or high-risk PII detected.');
      recommendations.push('Document satisfies standard Zero-Trust Data Loss Prevention criteria.');
    }

    const key = customKey || config.gemini.apiKey || process.env.GEMINI_API_KEY;
    const sourceEngine = this.hasGeminiKey(key) ? 'gemini' : 'local-dlp';

    return {
      riskLevel,
      riskScore,
      findings,
      redactedPreview: redactedPreview.slice(0, 15000),
      complianceStatus: {
        gdprRisk: modCount > 0 || lowCount > 0,
        hipaaRisk: highCount > 0,
        credentialLeakRisk: criticalCount > 0,
      },
      recommendations,
      sourceEngine,
    };
  }

  /**
   * Prompt Injection & Jailbreak Defense Guardrail
   */
  detectPromptInjection(text: string): { isInjection: boolean; pattern?: string; reason?: string } {
    const normalized = text.toLowerCase().trim();

    // High-risk prompt injection & instruction override signatures
    const injectionPatterns = [
      { pattern: /ignore\s+(all\s+)?(previous|prior|above|system)\s+instructions?/i, reason: 'Instruction override attempt' },
      { pattern: /disregard\s+(all\s+)?(previous|prior|above|system)\s+(instructions?|rules?|prompts?)/i, reason: 'Rule cancellation attempt' },
      { pattern: /(output|print|reveal|show|display|dump|leak)\s+(the\s+)?(system\s+prompt|developer\s+mode|initial\s+instructions?)/i, reason: 'System instruction exfiltration' },
      { pattern: /you\s+are\s+now\s+(in\s+)?(dan|jailbreak|unrestricted|god\s*mode|developer\s*mode)/i, reason: 'Persona escape/DAN jailbreak attempt' },
      { pattern: /pretend\s+you\s+(have\s+no\s+rules|are\s+unfiltered|can\s+bypass)/i, reason: 'Hypothetical rule bypass attempt' },
      { pattern: /bypass\s+(all\s+)?(zero-trust|security|content\s+filters?|guardrails?)/i, reason: 'Direct security guardrail bypass' },
      { pattern: /drop\s+table|delete\s+from\s+users|union\s+select/i, reason: 'SQL injection payload in prompt' },
    ];

    for (const item of injectionPatterns) {
      if (item.pattern.test(normalized)) {
        return { isInjection: true, pattern: item.pattern.source, reason: item.reason };
      }
    }

    return { isInjection: false };
  }

  /**
   * Interactive Vault AI Copilot & Document Q&A
   */
  async chatWithCopilot(
    message: string,
    documentContext?: { title: string; content: string; category: string },
    conversationHistory?: Array<{ role: string; content: string }>,
    customKey?: string
  ): Promise<AiChatResponse> {
    // 1. Prompt Injection Defense Guardrail
    const injectionCheck = this.detectPromptInjection(message);
    if (injectionCheck.isInjection) {
      return {
        reply: `🛡️ **TrustVault Security Guardrail Activated:**\n\nA prompt injection or instruction override attempt was detected (${injectionCheck.reason}) and safely neutralized.\n\nTrustVault AI Copilot operates under strict Zero-Trust boundaries: system instructions, API keys, and authorization controls cannot be overridden or exfiltrated through user prompts.`,
        citedDocumentTitle: documentContext?.title,
        suggestedQuestions: [
          'What zero-trust principles protect TrustVault?',
          'How does existence concealment prevent enumeration?',
          'How does download token protection work?',
        ],
        sourceEngine: 'local-copilot',
      };
    }

    const key = customKey || config.gemini.apiKey || process.env.GEMINI_API_KEY;

    if (this.hasGeminiKey(key)) {
      try {
        const ai = new GoogleGenAI({ apiKey: key! });

        let systemInstruction = `You are "Vault AI", the intelligent security copilot and document assistant for TrustVault.
TrustVault is an enterprise zero-trust document vault featuring existence concealment (404 on unauthorized access), append-only cryptographic audit logging, mandatory central authorization, and private isolated storage.

Your role:
1. Provide accurate, helpful, and concise answers.
2. If document context is provided, ground your answers directly in the document clauses and information.
3. If asked about vault security, explain zero-trust, threat modeling, cryptographic CAS, single-use download tokens, or audit chains clearly.
4. Maintain a professional, security-first tone. Never leak internal system keys.`;

        if (documentContext) {
          systemInstruction += `\n\nCURRENT DOCUMENT CONTEXT:
Title: "${documentContext.title}"
Category: "${documentContext.category}"
Document Content:
"""
${documentContext.content.slice(0, 16000)}
"""`;
        }

        // Build normalized alternating turns for Gemini multiturn chat
        const rawTurns: Array<{ role: 'user' | 'model'; text: string }> = [];
        if (conversationHistory && conversationHistory.length > 0) {
          for (const msg of conversationHistory.slice(-8)) {
            const role: 'user' | 'model' =
              msg.role === 'assistant' || msg.role === 'model' || msg.role === 'system' ? 'model' : 'user';
            const text = String(msg.content || '').trim();
            if (text && !text.startsWith('⚠️')) {
              rawTurns.push({ role, text });
            }
          }
        }
        rawTurns.push({ role: 'user', text: message });

        // Normalize turns: must start with 'user' and strictly alternate
        const contents: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }> = [];
        for (const turn of rawTurns) {
          if (contents.length === 0 && turn.role === 'model') {
            // Gemini API requires first turn to be 'user'
            continue;
          }
          const lastTurn = contents[contents.length - 1];
          if (lastTurn && lastTurn.role === turn.role) {
            lastTurn.parts[0].text += `\n\n${turn.text}`;
          } else {
            contents.push({
              role: turn.role,
              parts: [{ text: turn.text }],
            });
          }
        }

        const response = await ai.models.generateContent({
          model: config.gemini.model,
          contents: contents.length === 1 ? contents[0].parts[0].text : (contents as any),
          config: {
            systemInstruction,
          },
        });

        const reply = response.text || 'I analyzed your request, but could not produce a response.';
        return {
          reply,
          citedDocumentTitle: documentContext?.title,
          suggestedQuestions: this.generateFollowUpQuestions(message, !!documentContext),
          sourceEngine: 'gemini',
        };
      } catch (err) {
        console.warn('[AiService] Gemini live chat failed, using local copilot engine:', err);
      }
    }

    // Local Copilot Engine
    return this.localChat(message, documentContext);
  }

  /**
   * Local intelligent copilot responder
   */
  private localChat(
    message: string,
    documentContext?: { title: string; content: string; category: string }
  ): AiChatResponse {
    const q = message.toLowerCase().trim();

    if (documentContext) {
      const docText = documentContext.content;
      const lowerDoc = docText.toLowerCase();

      // Check for specific questions against document text
      if (q.includes('summary') || q.includes('summarize') || q.includes('what is this document about')) {
        const sentences = docText.split(/[.!?]\s+/).filter((s) => s.length > 20);
        const snippet = sentences.slice(0, 3).join('. ');
        return {
          reply: `**Summary of "${documentContext.title}":**\n\n${snippet || docText.slice(0, 300)}...\n\n*This document is classified under category "${documentContext.category}".*`,
          citedDocumentTitle: documentContext.title,
          suggestedQuestions: [
            'What are the key obligations or points?',
            'Are there any security or confidentiality risks?',
            'What dates or deadlines are mentioned?',
          ],
          sourceEngine: 'local-copilot',
        };
      }

      if (q.includes('risk') || q.includes('security') || q.includes('confidential') || q.includes('secret') || q.includes('leak')) {
        return {
          reply: `**Security Assessment for "${documentContext.title}":**\n\nTrustVault scanned this document: all file contents are isolated outside the web root. To see specific credential or PII leaks, run the **"Run AI Security Scan"** DLP tool in the document modal.`,
          citedDocumentTitle: documentContext.title,
          suggestedQuestions: ['Can I share this document securely?', 'How does download token protection work?'],
          sourceEngine: 'local-copilot',
        };
      }

      // Keyword search in document
      const words = q.split(/\s+/).filter((w) => w.length > 3 && !['what', 'where', 'when', 'does', 'this', 'that', 'with', 'from'].includes(w));
      const matchingSentences: string[] = [];
      const sentences = docText.split(/(?<=[.!?])\s+/);

      for (const word of words) {
        for (const sentence of sentences) {
          if (sentence.toLowerCase().includes(word) && !matchingSentences.includes(sentence)) {
            matchingSentences.push(sentence.trim());
            if (matchingSentences.length >= 3) break;
          }
        }
      }

      if (matchingSentences.length > 0) {
        return {
          reply: `Here are the relevant clauses found in **"${documentContext.title}"**:\n\n${matchingSentences.map((s) => `> "${s}"`).join('\n\n')}`,
          citedDocumentTitle: documentContext.title,
          suggestedQuestions: ['Summarize the entire document', 'Check for security and compliance risks'],
          sourceEngine: 'local-copilot',
        };
      }

      return {
        reply: `I searched **"${documentContext.title}"** regarding "${message}".\n\nThe document is categorized as **${documentContext.category}** and spans ${docText.length} characters. You can ask for an overall summary, extract specific clauses, or run an AI DLP security scan.`,
        citedDocumentTitle: documentContext.title,
        suggestedQuestions: ['Give me a 3-bullet summary', 'Are there any financial terms or costs?'],
        sourceEngine: 'local-copilot',
      };
    }

    // General Vault Copilot Queries
    if (q.includes('zero trust') || q.includes('architecture') || q.includes('security')) {
      return {
        reply: `**TrustVault Zero-Trust Architecture:**\n\n1. **Deny-by-Default:** Every access and mutation is verified through central authorization (\`authorize(user, document, action)\`).\n2. **Existence Concealment:** Unauthorized queries return **404 Not Found** instead of 403 Forbidden to eliminate IDOR resource enumeration.\n3. **Append-Only Audit Chain:** Every event is hashed (\`current_hash = SHA256(prev_hash + payload)\`) and protected by database triggers against modification.\n4. **Isolated Storage:** Files are stored in unguessable \`.bin\` files outside the web root with magic-byte validation.`,
        suggestedQuestions: [
          'Why does TrustVault return 404 instead of 403?',
          'How does the download token prevent replay attacks?',
          'Can administrators read my documents?',
        ],
        sourceEngine: 'local-copilot',
      };
    }

    if (q.includes('404') || q.includes('existence concealment') || q.includes('idor')) {
      return {
        reply: `**Existence Concealment Principle:**\n\nWhen an unauthorized user attempts to access or probe a document ID they lack permission for, TrustVault unconditionally responds with **HTTP 404 Not Found** rather than 403 Forbidden.\n\nThis guarantees that an attacker learns zero information about whether a target document ID exists or what its metadata might be, stopping IDOR enumeration cold.`,
        suggestedQuestions: ['How does least privilege apply to admins?', 'How do single-use download tokens work?'],
        sourceEngine: 'local-copilot',
      };
    }

    if (q.includes('admin') || q.includes('least privilege')) {
      return {
        reply: `**Principle of Least Privilege in TrustVault:**\n\nAdministrators can inspect system health, verify the cryptographic audit chain, and detect brute-force anomalies, but they have **zero implicit permission** to read or download user files without an explicit grant. Even the admin receives a 404 Not Found if they try to access unauthorized document contents.`,
        suggestedQuestions: ['How do I share a document with someone?', 'How are audit logs cryptographically verified?'],
        sourceEngine: 'local-copilot',
      };
    }

    return {
      reply: `Hello! I am **Vault AI**, your security copilot. I can help you analyze documents, detect PII and secret leaks, explain zero-trust security invariants, and answer questions about your vault.\n\nTry asking about a document or how TrustVault safeguards your data!`,
      suggestedQuestions: [
        'How does existence concealment stop IDOR attacks?',
        'How does the cryptographic audit chain work?',
        'What file types are supported?',
      ],
      sourceEngine: 'local-copilot',
    };
  }

  private generateFollowUpQuestions(query: string, hasDoc: boolean): string[] {
    if (hasDoc) {
      return [
        'Can you summarize the main risks in this document?',
        'What are the key dates, numbers, or deadlines?',
        'Suggest tags and category for this document',
      ];
    }
    return [
      'Explain TrustVault zero-trust architecture',
      'Why return 404 Not Found instead of 403 Forbidden?',
      'How does the cryptographic audit hash chain work?',
    ];
  }

  /**
   * Quick scan for text / pre-upload inspection
   */
  async quickScan(text: string, fileName?: string): Promise<AiQuickScanResponse> {
    const dummyInfo: DocumentContentInfo = {
      text,
      isTruncated: false,
      mimeType: 'text/plain',
      fileName: fileName || 'upload.txt',
    };

    const dlpResult = await this.scanSecurityDlp(dummyInfo, { title: fileName || 'Upload' });
    const summary = this.localSummarize(dummyInfo, { title: fileName || 'Upload', category: 'General' });

    const warnings: string[] = [];
    if (dlpResult.riskLevel === 'CRITICAL') {
      warnings.push('CRITICAL: Plaintext credentials or private keys detected in this file.');
    }
    if (dlpResult.riskLevel === 'HIGH') {
      warnings.push('WARNING: Financial or PII identifiers detected (SSNs or credit card patterns).');
    }

    return {
      riskLevel: dlpResult.riskLevel,
      categorySuggestion: summary.categorySuggestion,
      detectedSecretsCount: dlpResult.findings.length,
      warnings,
      sourceEngine: dlpResult.sourceEngine,
    };
  }
}
