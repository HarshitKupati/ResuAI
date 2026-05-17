import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Send,
  Loader2,
  MessageSquare,
  Plus,
  Trash2,
  Sparkles,
  Bot,
  User as UserIcon,
  History as HistoryIcon,
  X,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  listChatSessions,
  getChatSession,
  deleteChatSession,
  sendChatMessage,
  regenerateLastReply,
} from '../../services/api';

const STARTER_PROMPTS = [
  'I want to become a Full Stack Developer. I already know HTML, CSS, JavaScript, MongoDB and Express. What should I learn next?',
  'I want to be a Data Scientist. I know Python basics and SQL. Give me a roadmap with resources.',
  'I want to switch to DevOps. I know Linux and basic networking. What is the fastest path?',
];

export default function RoleCoach({ initialPrompt = '', onConsumeInitialPrompt = () => {} }) {
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false); // mobile drawer

  const scrollRef = useRef(null);
  const composerRef = useRef(null);

  // Initial: load sessions
  useEffect(() => {
    refreshSessions();
  }, []);

  // When parent gives us a prefill (e.g. from a clicked skill chip), drop it
  // into the composer, scroll it into view, and notify the parent so the same
  // prompt isn't re-applied on every render.
  useEffect(() => {
    if (!initialPrompt) return;
    setActiveId(null);
    setMessages([]);
    setInput(initialPrompt);
    // Focus composer next tick so the user can hit Enter immediately.
    setTimeout(() => {
      composerRef.current?.focus();
      composerRef.current?.setSelectionRange(
        initialPrompt.length,
        initialPrompt.length,
      );
    }, 30);
    onConsumeInitialPrompt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const refreshSessions = async () => {
    setSessionsLoading(true);
    try {
      const list = await listChatSessions();
      setSessions(list);
    } catch (e) {
      // silent — empty state is fine
    } finally {
      setSessionsLoading(false);
    }
  };

  const openSession = async (id) => {
    if (id === activeId) {
      setHistoryOpen(false);
      return;
    }
    setActiveId(id);
    setMessages([]);
    setHistoryOpen(false);
    try {
      const data = await getChatSession(id);
      setMessages(data?.messages || []);
    } catch (e) {
      toast.error('Could not load chat');
      setActiveId(null);
    }
  };

  const startNewChat = () => {
    setActiveId(null);
    setMessages([]);
    setInput('');
    setHistoryOpen(false);
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this chat?')) return;
    try {
      await deleteChatSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (id === activeId) startNewChat();
      toast.success('Chat deleted');
    } catch (err) {
      toast.error('Could not delete');
    }
  };

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;

    // Optimistic user message
    const tempUserMsg = {
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setInput('');
    setSending(true);

    try {
      const data = await sendChatMessage(content, activeId);
      setMessages(data?.messages || []);
      if (!activeId && data?.id) {
        setActiveId(data.id);
      }
      // refresh sidebar (title + ordering)
      refreshSessions();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Could not send message');
      // Roll back optimistic message
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    send();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleRegenerate = async () => {
    if (!activeId || regenerating || sending) return;
    setRegenerating(true);
    // Visually drop the trailing assistant message while we wait.
    setMessages((prev) => {
      if (prev.length && prev[prev.length - 1].role === 'assistant') {
        return prev.slice(0, -1);
      }
      return prev;
    });
    try {
      const data = await regenerateLastReply(activeId);
      setMessages(data?.messages || []);
      refreshSessions();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(
        typeof detail === 'string' ? detail : 'Could not regenerate reply',
      );
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden">
      <div className="flex h-[calc(100vh-260px)] min-h-[420px] max-h-[760px]">
        {/* Sidebar (desktop) */}
        <aside className="hidden md:flex w-64 lg:w-72 flex-col border-r border-slate-200 bg-slate-50/60">
          <SidebarHeader onNew={startNewChat} />
          <SidebarList
            sessions={sessions}
            loading={sessionsLoading}
            activeId={activeId}
            onOpen={openSession}
            onDelete={handleDelete}
          />
        </aside>

        {/* Mobile drawer */}
        {historyOpen && (
          <div className="md:hidden fixed inset-0 z-40 flex">
            <div
              className="absolute inset-0 bg-slate-900/40"
              onClick={() => setHistoryOpen(false)}
            />
            <aside className="relative w-72 max-w-[80%] bg-white shadow-xl flex flex-col">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
                <span className="text-sm font-semibold text-slate-900">Chat history</span>
                <button
                  className="p-1.5 rounded hover:bg-slate-100"
                  onClick={() => setHistoryOpen(false)}
                >
                  <X className="h-4 w-4 text-slate-500" />
                </button>
              </div>
              <SidebarHeader onNew={startNewChat} />
              <SidebarList
                sessions={sessions}
                loading={sessionsLoading}
                activeId={activeId}
                onOpen={openSession}
                onDelete={handleDelete}
              />
            </aside>
          </div>
        )}

        {/* Main chat area */}
        <section className="flex-1 flex flex-col min-w-0">
          {/* Mobile header */}
          <div className="md:hidden flex items-center justify-between px-3 py-2 border-b border-slate-200">
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              <HistoryIcon className="h-4 w-4" /> History
            </button>
            <button
              type="button"
              onClick={startNewChat}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-800"
            >
              <Plus className="h-4 w-4" /> New
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4 bg-gradient-to-b from-white via-white to-slate-50"
          >
            {messages.length === 0 && !sending && (
              <EmptyChatState onPick={send} />
            )}

            {messages.map((m, i) => {
              const isLastAssistant =
                m.role === 'assistant' && i === messages.length - 1 && !sending && !regenerating;
              return (
                <MessageBubble
                  key={i}
                  role={m.role}
                  content={m.content}
                  isLastAssistant={isLastAssistant}
                  canRegenerate={isLastAssistant && !!activeId}
                  onRegenerate={handleRegenerate}
                />
              );
            })}

            {(sending || regenerating) && <TypingBubble />}
          </div>

          {/* Composer */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-slate-200 bg-white p-3 sm:p-4"
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={composerRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder='Try: "I want to become a Full Stack Developer. I know HTML, CSS, JS, MongoDB and Express. What next?"'
                rows={2}
                disabled={sending || regenerating}
                className="flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={sending || regenerating || !input.trim()}
                className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-brand-600 to-accent-600 text-white px-4 py-2.5 text-sm font-semibold hover:from-brand-700 hover:to-accent-700 disabled:opacity-50 transition shadow-sm h-[42px]"
              >
                {sending || regenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Press <kbd className="px-1 py-0.5 rounded bg-slate-100 ring-1 ring-slate-200 font-mono">Enter</kbd> to send,
              <kbd className="ml-1 px-1 py-0.5 rounded bg-slate-100 ring-1 ring-slate-200 font-mono">Shift + Enter</kbd> for a new line.
            </p>
          </form>
        </section>
      </div>
    </div>
  );
}

/* ───────────────────────── Sub-components ───────────────────────── */

function SidebarHeader({ onNew }) {
  return (
    <div className="px-3 py-3 border-b border-slate-200">
      <button
        onClick={onNew}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-brand-600 to-accent-600 text-white px-3 py-2 text-sm font-semibold hover:from-brand-700 hover:to-accent-700 transition shadow-sm"
      >
        <Plus className="h-4 w-4" /> New chat
      </button>
    </div>
  );
}

function SidebarList({ sessions, loading, activeId, onOpen, onDelete }) {
  return (
    <div className="flex-1 overflow-y-auto px-2 py-2">
      <div className="px-1.5 pt-1 pb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        <HistoryIcon className="h-3 w-3" /> Chat history
      </div>
      {loading ? (
        <div className="space-y-1.5 px-1.5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-9 rounded-md bg-slate-200/60 animate-pulse" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <p className="px-2 pt-2 text-xs text-slate-400">
          No chats yet. Start a new one!
        </p>
      ) : (
        <ul className="space-y-0.5">
          {sessions.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => onOpen(s.id)}
                className={`group w-full text-left px-2.5 py-2 rounded-md flex items-start gap-2 text-sm transition ${
                  s.id === activeId
                    ? 'bg-brand-100 text-brand-800 ring-1 ring-brand-200'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <MessageSquare
                  className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                    s.id === activeId ? 'text-brand-600' : 'text-slate-400'
                  }`}
                />
                <span className="flex-1 min-w-0 truncate">{s.title || 'New chat'}</span>
                <button
                  type="button"
                  onClick={(e) => onDelete(s.id, e)}
                  className="opacity-0 group-hover:opacity-100 transition p-0.5 rounded hover:bg-red-50 hover:text-red-600 text-slate-400"
                  title="Delete chat"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyChatState({ onPick }) {
  return (
    <div className="text-center max-w-xl mx-auto py-8">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-accent-600 text-white shadow-glow">
        <Sparkles className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
        Tell me your target role + what you already know
      </h3>
      <p className="mt-2 text-sm text-slate-600 leading-relaxed">
        I&apos;ll figure out exactly what you should learn next, build you a step-by-step
        roadmap, and recommend where to learn each piece.
      </p>
      <div className="mt-5 grid sm:grid-cols-1 gap-2 text-left">
        {STARTER_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPick(p)}
            className="rounded-lg bg-white ring-1 ring-slate-200 px-3.5 py-2.5 text-sm text-slate-700 hover:ring-brand-300 hover:bg-brand-50 hover:text-brand-800 transition flex items-start gap-2"
          >
            <Sparkles className="h-4 w-4 flex-shrink-0 text-brand-500 mt-0.5" />
            <span>{p}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ role, content, isLastAssistant = false, canRegenerate = false, onRegenerate }) {
  const isUser = role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content || '');
      } else {
        // Older browser fallback
        const ta = document.createElement('textarea');
        ta.value = content || '';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (e) {
      toast.error('Could not copy');
    }
  };

  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white ${
          isUser
            ? 'bg-slate-700'
            : 'bg-gradient-to-br from-brand-600 to-accent-600 shadow-glow'
        }`}
      >
        {isUser ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className="flex flex-col max-w-[88%] sm:max-w-[80%] min-w-0">
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'bg-slate-900 text-white rounded-tr-md self-end'
              : 'bg-white ring-1 ring-slate-200 text-slate-800 rounded-tl-md shadow-sm'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{content}</p>
          ) : (
            <MarkdownLite text={content} />
          )}
        </div>

        {/* Action row — only on assistant messages */}
        {!isUser && (
          <div className="mt-1.5 flex items-center gap-1.5 px-1">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded px-1.5 py-0.5 transition"
              title="Copy reply"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-600" />
                  <span className="text-emerald-700">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
            {isLastAssistant && canRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-brand-700 hover:bg-brand-50 rounded px-1.5 py-0.5 transition"
                title="Get a new answer"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Regenerate</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex gap-2.5">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-accent-600 text-white shadow-glow">
        <Bot className="h-4 w-4" />
      </div>
      <div className="rounded-2xl rounded-tl-md bg-white ring-1 ring-slate-200 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1">
          <Dot delay="0s" />
          <Dot delay="0.15s" />
          <Dot delay="0.3s" />
        </div>
      </div>
    </div>
  );
}

function Dot({ delay }) {
  return (
    <span
      className="block h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce"
      style={{ animationDelay: delay, animationDuration: '0.9s' }}
    />
  );
}

/* ──────────────────── Lightweight markdown renderer ────────────────────
   Handles: ## headings, **bold**, *italic*, `code`, bullets, numbered lists,
   blockquotes, line breaks. No external deps. */
function MarkdownLite({ text }) {
  const blocks = useMemo(() => parseMarkdown(text || ''), [text]);
  return (
    <div className="prose-chat space-y-2 text-sm">
      {blocks.map((b, i) => renderBlock(b, i))}
    </div>
  );
}

function parseMarkdown(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Headings (##, ###)
    const h = line.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      blocks.push({ type: 'h', level: h[1].length, text: h[2].trim() });
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'quote', text: buf.join(' ') });
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Blank line → break paragraphs
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph (collect until blank line / block)
    const buf = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push({ type: 'p', text: buf.join(' ') });
  }
  return blocks;
}

function renderBlock(b, key) {
  switch (b.type) {
    case 'h': {
      const sizes = {
        1: 'text-base font-bold',
        2: 'text-sm font-bold',
        3: 'text-sm font-semibold',
      };
      return (
        <h4 key={key} className={`${sizes[b.level] || sizes[2]} text-slate-900 mt-1`}>
          {renderInline(b.text)}
        </h4>
      );
    }
    case 'quote':
      return (
        <blockquote
          key={key}
          className="border-l-2 border-brand-300 pl-3 text-slate-600 italic"
        >
          {renderInline(b.text)}
        </blockquote>
      );
    case 'ol':
      return (
        <ol key={key} className="list-decimal pl-5 space-y-1.5 marker:text-slate-400">
          {b.items.map((it, j) => (
            <li key={j} className="text-slate-700">{renderInline(it)}</li>
          ))}
        </ol>
      );
    case 'ul':
      return (
        <ul key={key} className="list-disc pl-5 space-y-1 marker:text-slate-400">
          {b.items.map((it, j) => (
            <li key={j} className="text-slate-700">{renderInline(it)}</li>
          ))}
        </ul>
      );
    case 'p':
    default:
      return (
        <p key={key} className="text-slate-700 leading-relaxed">
          {renderInline(b.text)}
        </p>
      );
  }
}

// Inline tokens: **bold**, *italic* / _italic_, `code`, links [t](u)
function renderInline(text) {
  if (!text) return null;
  // Order of patterns matters: code first to avoid mangling **/_
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(_[^_]+_)|(\[[^\]]+\]\([^)]+\))/g;
  const out = [];
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      out.push(text.slice(lastIndex, match.index));
    }
    const tok = match[0];
    if (tok.startsWith('`')) {
      out.push(
        <code
          key={key++}
          className="px-1 py-0.5 rounded bg-slate-100 text-slate-800 text-[12px] font-mono"
        >
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith('**')) {
      out.push(
        <strong key={key++} className="font-semibold text-slate-900">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else if (tok.startsWith('*') || tok.startsWith('_')) {
      out.push(
        <em key={key++} className="italic">
          {tok.slice(1, -1)}
        </em>,
      );
    } else if (tok.startsWith('[')) {
      const linkMatch = tok.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        out.push(
          <a
            key={key++}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer noopener"
            className="text-brand-700 underline underline-offset-2 hover:text-brand-800"
          >
            {linkMatch[1]}
          </a>,
        );
      } else {
        out.push(tok);
      }
    }
    lastIndex = match.index + tok.length;
  }
  if (lastIndex < text.length) out.push(text.slice(lastIndex));
  return out;
}
