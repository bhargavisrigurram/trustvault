import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Bot,
  X,
  Key,
  RefreshCw,
  Send,
  AlertTriangle,
  FileText,
  Clock,
  Tag,
  Folder,
  Globe,
  Eye,
  EyeOff,
  Copy,
  Check,
  ChevronRight,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { api, getStoredGeminiKey, setStoredGeminiKey } from '../services/api';
import type {
  DocumentSearchItem,
  AiDocumentSummaryResponse,
  AiSecurityScanResponse,
} from '@trustvault/shared';

interface AiIntelligenceModalProps {
  document: DocumentSearchItem;
  isOpen: boolean;
  onClose: () => void;
}

export const AiIntelligenceModal: React.FC<AiIntelligenceModalProps> = ({
  document: doc,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'dlp' | 'chat'>('summary');

  // Engine status
  const [engineStatus, setEngineStatus] = useState<{
    hasKey: boolean;
    activeEngine: 'gemini' | 'local';
    model: string;
  } | null>(null);

  // Custom key config
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [keyInput, setKeyInput] = useState(getStoredGeminiKey() || '');
  const [keySavedMessage, setKeySavedMessage] = useState(false);

  // Summary State
  const [summaryData, setSummaryData] = useState<AiDocumentSummaryResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // DLP Scan State
  const [scanData, setScanData] = useState<AiSecurityScanResponse | null>(null);
  const [loadingScan, setLoadingScan] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [showRedactedPreview, setShowRedactedPreview] = useState(false);

  // Chat State
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; engine?: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([
    'What are the key obligations or points in this document?',
    'Are there any confidential, liability, or security clauses?',
    'Provide a quick executive summary for stakeholders',
  ]);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Copied states
  const [copiedSummary, setCopiedSummary] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadEngineStatus();
      if (!summaryData && !loadingSummary) {
        handleFetchSummary();
      }
    }
  }, [isOpen, doc.id]);

  useEffect(() => {
    if (activeTab === 'dlp' && !scanData && !loadingScan) {
      handleFetchScan();
    }
    if (activeTab === 'chat' && messages.length === 0) {
      // Welcome assistant greeting
      setMessages([
        {
          role: 'assistant',
          content: `👋 Hello! I am **Vault AI Copilot**, your zero-trust document intelligence assistant. I have analyzed **"${doc.title}"** (${doc.file_name || 'document'}). How can I assist you with this document?`,
        },
      ]);
    }
  }, [activeTab]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  const loadEngineStatus = async () => {
    try {
      const status = await api.getAiStatus();
      setEngineStatus(status);
    } catch {
      // Ignore fallback
    }
  };

  const handleSaveKey = () => {
    setStoredGeminiKey(keyInput.trim() || null);
    setKeySavedMessage(true);
    loadEngineStatus();
    setTimeout(() => {
      setKeySavedMessage(false);
      setShowKeyConfig(false);
    }, 1200);
  };

  const handleFetchSummary = async () => {
    setLoadingSummary(true);
    setSummaryError(null);
    try {
      const res = await api.getAiSummary(doc.id, doc.current_version_number);
      setSummaryData(res);
    } catch (err: any) {
      setSummaryError(err.message || 'Failed to generate document summary');
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleFetchScan = async () => {
    setLoadingScan(true);
    setScanError(null);
    try {
      const res = await api.getAiSecurityScan(doc.id, doc.current_version_number);
      setScanData(res);
    } catch (err: any) {
      setScanError(err.message || 'Failed to execute security DLP scan');
    } finally {
      setLoadingScan(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || chatInput.trim();
    if (!text || chatLoading) return;

    const newHistory = [...messages, { role: 'user' as const, content: text }];
    setMessages(newHistory);
    setChatInput('');
    setChatLoading(true);

    try {
      const cleanHistory = messages
        .filter((m) => !m.content.startsWith('⚠️'))
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await api.sendAiChat(
        text,
        doc?.id,
        cleanHistory
      );

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.reply,
          engine: res.sourceEngine,
        },
      ]);

      if (res.suggestedQuestions && res.suggestedQuestions.length > 0) {
        setSuggestedQuestions(res.suggestedQuestions);
      }
    } catch (err: any) {
      const detailsMsg =
        err.details && Array.isArray(err.details) && err.details.length > 0
          ? ` (${err.details.map((d: any) => `${d.path}: ${d.message}`).join(', ')})`
          : '';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ Failed to query Vault Copilot: ${err.message || 'Unknown error'}${detailsMsg}`,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const copySummaryText = () => {
    if (!summaryData) return;
    const text = `Document: ${doc.title}\nCategory: ${summaryData.categorySuggestion}\n\nSummary:\n${summaryData.summary}\n\nKey Takeaways:\n${summaryData.keyPoints.map((p) => `• ${p}`).join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  if (!isOpen) return null;

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return 'bg-rose-950/80 text-rose-400 border-rose-700/80';
      case 'HIGH':
        return 'bg-orange-950/80 text-orange-400 border-orange-700/80';
      case 'MODERATE':
        return 'bg-amber-950/80 text-amber-400 border-amber-700/80';
      default:
        return 'bg-emerald-950/80 text-emerald-400 border-emerald-700/80';
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn"
    >
      <div className="relative w-full max-w-4xl h-[90vh] max-h-[820px] rounded-3xl glass-panel-glow bg-slate-900 border border-slate-700/90 shadow-2xl flex flex-col overflow-hidden">
        {/* Glow corners */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between flex-shrink-0 bg-slate-900/90">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 flex-shrink-0">
              <Sparkles className="w-5 h-5 text-slate-950" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold text-white truncate max-w-sm sm:max-w-md">
                  {doc.title}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex-shrink-0">
                  v{doc.current_version_number}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate flex items-center space-x-2">
                <span>{doc.file_name || 'Document'}</span>
                <span>•</span>
                <span className="text-emerald-400 font-medium">AI Intelligence Suite</span>
              </p>
            </div>
          </div>

          {/* Engine Status & Close */}
          <div className="flex items-center space-x-2">
            {/* Active Engine pill */}
            <div
              onClick={() => setShowKeyConfig(!showKeyConfig)}
              className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-800/90 border border-slate-700 text-[11px] font-mono cursor-pointer hover:border-emerald-600 transition-colors"
              title="Click to configure Gemini API Key"
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  engineStatus?.activeEngine === 'gemini'
                    ? 'bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse'
                    : 'bg-teal-400'
                }`}
              />
              <span className="text-slate-300">
                {engineStatus?.activeEngine === 'gemini' ? 'Gemini 2.5 Flash' : 'Local NLP / DLP'}
              </span>
              <Sliders className="w-3 h-3 text-slate-400 ml-0.5" />
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Custom API Key Setting Panel (collapsible) */}
        {showKeyConfig && (
          <div className="p-4 bg-slate-950/90 border-b border-slate-800 text-xs animate-fadeIn">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-1.5 text-emerald-400 font-semibold">
                <Key className="w-4 h-4" />
                <span>Custom Google Gemini API Key</span>
              </div>
              <span className="text-[11px] text-slate-500">Stored in browser session only</span>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="password"
                placeholder="AIzaSy... (leave blank to use server default or local engine)"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
              />
              <button
                onClick={handleSaveKey}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold transition-colors"
              >
                {keySavedMessage ? 'Saved!' : 'Apply'}
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-800 px-4 sm:px-6 bg-slate-900/60 flex-shrink-0">
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex items-center space-x-2 py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'summary'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Summary & Insights</span>
          </button>

          <button
            onClick={() => setActiveTab('dlp')}
            className={`flex items-center space-x-2 py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'dlp'
                ? 'border-teal-500 text-teal-400 bg-teal-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Security DLP Scan</span>
            {scanData && scanData.riskScore > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-950 text-rose-400 border border-rose-800">
                {scanData.riskScore}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center space-x-2 py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'chat'
                ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>Vault Copilot (Chat)</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* TAB 1: SUMMARY & INSIGHTS */}
          {activeTab === 'summary' && (
            <div className="space-y-6 animate-fadeIn">
              {loadingSummary ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                  <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
                  <p className="text-sm text-slate-300 font-medium">Extracting content & generating AI summary...</p>
                  <p className="text-xs text-slate-500">Processing document streams with zero data leakage</p>
                </div>
              ) : summaryError ? (
                <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/80 flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-rose-300">Summarization Error</h4>
                    <p className="text-xs text-rose-400/90 mt-0.5">{summaryError}</p>
                    <button
                      onClick={handleFetchSummary}
                      className="mt-3 px-3 py-1 rounded-lg bg-rose-900/60 hover:bg-rose-900 text-rose-200 text-xs font-semibold"
                    >
                      Retry Analysis
                    </button>
                  </div>
                </div>
              ) : summaryData ? (
                <>
                  {/* Executive Summary Card */}
                  <div className="relative rounded-2xl p-5 sm:p-6 bg-slate-950/60 border border-slate-800 overflow-hidden shadow-inner">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                          Executive Summary
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          Engine: {summaryData.sourceEngine}
                        </span>
                        <button
                          onClick={copySummaryText}
                          className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                          title="Copy Summary"
                        >
                          {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedSummary ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-200 font-sans">
                      {summaryData.summary}
                    </p>
                  </div>

                  {/* Key Takeaways */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-teal-400" />
                      <span>Key Findings & Clauses</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {summaryData.keyPoints.map((point, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 flex items-start space-x-2.5 text-xs text-slate-300"
                        >
                          <span className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-400 font-bold flex items-center justify-center flex-shrink-0 text-[10px] border border-emerald-800/80">
                            {idx + 1}
                          </span>
                          <span className="leading-relaxed">{point}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Document Intelligence Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 flex flex-col justify-between">
                      <div className="flex items-center space-x-1.5 text-slate-400 text-xs">
                        <Folder className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Category</span>
                      </div>
                      <span className="text-sm font-bold text-white mt-1 truncate">
                        {summaryData.categorySuggestion}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 flex flex-col justify-between">
                      <div className="flex items-center space-x-1.5 text-slate-400 text-xs">
                        <Clock className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Reading Time</span>
                      </div>
                      <span className="text-sm font-bold text-white mt-1">
                        ~{summaryData.readingTimeMinutes} min
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 flex flex-col justify-between">
                      <div className="flex items-center space-x-1.5 text-slate-400 text-xs">
                        <Globe className="w-3.5 h-3.5 text-teal-400" />
                        <span>Language</span>
                      </div>
                      <span className="text-sm font-bold text-white mt-1 truncate">
                        {summaryData.language}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 flex flex-col justify-between">
                      <div className="flex items-center space-x-1.5 text-slate-400 text-xs">
                        <Tag className="w-3.5 h-3.5 text-amber-400" />
                        <span>Tags</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {summaryData.recommendedTags.slice(0, 2).map((t, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* TAB 2: DLP SECURITY SCAN */}
          {activeTab === 'dlp' && (
            <div className="space-y-6 animate-fadeIn">
              {loadingScan ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                  <RefreshCw className="w-8 h-8 text-teal-400 animate-spin" />
                  <p className="text-sm text-slate-300 font-medium">Running zero-leakage DLP security scanner...</p>
                  <p className="text-xs text-slate-500">Checking for exposed API keys, private keys, SSNs & PCI-DSS data</p>
                </div>
              ) : scanError ? (
                <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/80 flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-rose-300">Scan Error</h4>
                    <p className="text-xs text-rose-400/90 mt-0.5">{scanError}</p>
                    <button
                      onClick={handleFetchScan}
                      className="mt-3 px-3 py-1 rounded-lg bg-rose-900/60 hover:bg-rose-900 text-rose-200 text-xs font-semibold"
                    >
                      Retry Security Scan
                    </button>
                  </div>
                </div>
              ) : scanData ? (
                <>
                  {/* Risk Overview Banner */}
                  <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center space-x-4">
                      <div
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center border font-mono font-bold text-lg ${
                          scanData.riskLevel === 'CRITICAL'
                            ? 'bg-rose-950/80 text-rose-400 border-rose-700'
                            : scanData.riskLevel === 'HIGH'
                            ? 'bg-orange-950/80 text-orange-400 border-orange-700'
                            : scanData.riskLevel === 'MODERATE'
                            ? 'bg-amber-950/80 text-amber-400 border-amber-700'
                            : 'bg-emerald-950/80 text-emerald-400 border-emerald-700'
                        }`}
                      >
                        {scanData.riskScore}
                        <span className="text-[10px] text-slate-500 font-normal">/100</span>
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getRiskBadge(
                              scanData.riskLevel
                            )}`}
                          >
                            {scanData.riskLevel} RISK
                          </span>
                          <span className="text-xs text-slate-400">
                            {scanData.findings.length === 0
                              ? 'Clean Document'
                              : `${scanData.findings.length} findings identified`}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Evaluated against Zero-Trust Data Loss Prevention (DLP) security rules.
                        </p>
                      </div>
                    </div>

                    {/* Compliance Indicators */}
                    <div className="flex flex-wrap sm:flex-col gap-1.5 text-[11px] font-mono">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            scanData.complianceStatus.credentialLeakRisk ? 'bg-rose-500' : 'bg-emerald-400'
                          }`}
                        />
                        <span className="text-slate-300">
                          {scanData.complianceStatus.credentialLeakRisk ? 'Exposed Credentials' : 'Zero Secret Leaks'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            scanData.complianceStatus.hipaaRisk ? 'bg-orange-500' : 'bg-emerald-400'
                          }`}
                        />
                        <span className="text-slate-300">
                          {scanData.complianceStatus.hipaaRisk ? 'HIPAA / PII Risk' : 'HIPAA Clean'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            scanData.complianceStatus.gdprRisk ? 'bg-amber-500' : 'bg-emerald-400'
                          }`}
                        />
                        <span className="text-slate-300">
                          {scanData.complianceStatus.gdprRisk ? 'GDPR Contact PII' : 'GDPR Clean'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Findings List */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center space-x-2">
                      <ShieldAlert className="w-4 h-4 text-orange-400" />
                      <span>Security & DLP Findings</span>
                    </h3>

                    {scanData.findings.length === 0 ? (
                      <div className="p-6 rounded-2xl bg-emerald-950/20 border border-emerald-800/60 text-center">
                        <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                        <h4 className="text-sm font-bold text-white">No Sensitive Secrets or Unmasked PII Found</h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                          This document satisfies all baseline confidentiality and DLP checks. No API keys, passwords, or credit card numbers were detected.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {scanData.findings.map((f, i) => (
                          <div
                            key={i}
                            className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                                    f.severity === 'CRITICAL'
                                      ? 'bg-rose-950 text-rose-400 border-rose-800'
                                      : f.severity === 'HIGH'
                                      ? 'bg-orange-950 text-orange-400 border-orange-800'
                                      : f.severity === 'MODERATE'
                                      ? 'bg-amber-950 text-amber-400 border-amber-800'
                                      : 'bg-slate-800 text-slate-300 border-slate-700'
                                  }`}
                                >
                                  {f.severity}
                                </span>
                                <span className="text-xs font-mono font-bold text-white">{f.type}</span>
                                {f.line && (
                                  <span className="text-[10px] text-slate-500 font-mono">Line {f.line}</span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400">{f.description}</p>
                            </div>

                            {f.matchedSnippet && (
                              <div className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-rose-300">
                                {f.matchedSnippet}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Redacted Preview Toggle */}
                  {scanData.redactedPreview && (
                    <div className="border border-slate-800 rounded-2xl overflow-hidden">
                      <button
                        onClick={() => setShowRedactedPreview(!showRedactedPreview)}
                        className="w-full p-4 bg-slate-950/60 hover:bg-slate-950 text-left flex items-center justify-between text-xs font-semibold text-slate-300 transition-colors"
                      >
                        <div className="flex items-center space-x-2">
                          {showRedactedPreview ? <EyeOff className="w-4 h-4 text-emerald-400" /> : <Eye className="w-4 h-4 text-emerald-400" />}
                          <span>{showRedactedPreview ? 'Hide Redacted Preview' : 'View Redacted Document Preview'}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">Zero data leakage preview</span>
                      </button>

                      {showRedactedPreview && (
                        <div className="p-4 bg-slate-950 border-t border-slate-800 font-mono text-xs text-slate-300 max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                          {scanData.redactedPreview}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recommendations */}
                  <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800">
                    <h4 className="text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
                      Security Recommendations
                    </h4>
                    <ul className="space-y-1.5 text-xs text-slate-400">
                      {scanData.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start space-x-2">
                          <ChevronRight className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* TAB 3: VAULT COPILOT (CHAT) */}
          {activeTab === 'chat' && (
            <div className="h-full flex flex-col justify-between space-y-4 animate-fadeIn">
              {/* Message List */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex items-start space-x-3 ${
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center flex-shrink-0 mt-1">
                        <Bot className="w-4 h-4 text-slate-950" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-emerald-600 text-slate-950 font-medium rounded-br-sm'
                          : 'bg-slate-950/80 text-slate-200 border border-slate-800 rounded-bl-sm'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                      {msg.engine && (
                        <div className="mt-2 text-[10px] font-mono text-slate-400/80 text-right">
                          Grounded via {msg.engine}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {chatLoading && (
                  <div className="flex items-center space-x-2 text-xs text-slate-400 p-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>Vault Copilot is analyzing document clauses...</span>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Suggested Questions */}
              {suggestedQuestions.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Suggested Questions
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(q)}
                        disabled={chatLoading}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-950/60 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors text-left"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat Input Bar */}
              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="text"
                  placeholder="Ask any question about this document or vault security..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendMessage();
                  }}
                  disabled={chatLoading}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={chatLoading || !chatInput.trim()}
                  className="p-3 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-50 text-slate-950 transition-all shadow-md shadow-emerald-500/20"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
