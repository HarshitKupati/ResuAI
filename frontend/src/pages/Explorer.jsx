import React, { useEffect, useState } from 'react';
import {
  Compass,
  Search,
  MessageCircle,
  Bookmark,
  Loader2,
  Trash2,
  Download,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { RoleExplorer } from './Dashboard';
import RoleCoach from '../components/chat/RoleCoach';
import {
  listSavedRoadmaps,
  getSavedRoadmap,
  deleteSavedRoadmap,
  downloadRoadmapPdf,
} from '../services/api';

const TABS = [
  {
    id: 'roadmap',
    label: 'Quick Roadmap',
    icon: Search,
    description: 'Type a role, get the full skills + learning path instantly.',
  },
  {
    id: 'coach',
    label: 'AI Coach',
    icon: MessageCircle,
    description: 'Chat: tell me what you already know and I will plan the next steps.',
  },
  {
    id: 'saved',
    label: 'Saved Roadmaps',
    icon: Bookmark,
    description: 'Your saved roadmaps \u2014 revisit, download as PDF, or delete.',
  },
];

export default function Explorer() {
  const [tab, setTab] = useState('roadmap');
  const [coachPrefill, setCoachPrefill] = useState('');
  const active = TABS.find((t) => t.id === tab) || TABS[0];

  // Called from RoleExplorer when the user clicks a skill chip.
  const handleAskCoach = (prompt) => {
    setCoachPrefill(prompt);
    setTab('coach');
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="rounded-2xl bg-gradient-to-r from-brand-600 via-brand-700 to-accent-600 p-5 sm:p-7 text-white shadow-premium relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="relative flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur ring-1 ring-white/30 flex-shrink-0">
            <Compass className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Career Explorer</h1>
            <p className="mt-1 text-sm sm:text-base text-brand-100 leading-relaxed max-w-2xl">
              {active.description}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? 'text-brand-700'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              {isActive && (
                <span className="absolute left-3 right-3 -bottom-px h-0.5 bg-gradient-to-r from-brand-600 to-accent-600 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === 'roadmap' && <RoleExplorer onAskCoach={handleAskCoach} />}
      {tab === 'coach' && (
        <RoleCoach
          initialPrompt={coachPrefill}
          onConsumeInitialPrompt={() => setCoachPrefill('')}
        />
      )}
      {tab === 'saved' && <SavedRoadmaps />}
    </div>
  );
}

/* ────────────────────────── Saved Roadmaps ────────────────────────── */

function SavedRoadmaps() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedData, setExpandedData] = useState(null);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await listSavedRoadmaps();
      setItems(list);
    } catch (e) {
      toast.error('Could not load saved roadmaps');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const toggleExpand = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedData(null);
      return;
    }
    setExpandedId(id);
    setExpandedData(null);
    setExpandedLoading(true);
    try {
      const full = await getSavedRoadmap(id);
      setExpandedData(full);
    } catch (e) {
      toast.error('Could not load roadmap');
      setExpandedId(null);
    } finally {
      setExpandedLoading(false);
    }
  };

  const handleDelete = async (id, role) => {
    if (!window.confirm(`Delete the roadmap for "${role}"?`)) return;
    setDeletingId(id);
    try {
      await deleteSavedRoadmap(id);
      setItems((prev) => prev.filter((r) => r.id !== id));
      if (expandedId === id) {
        setExpandedId(null);
        setExpandedData(null);
      }
      toast.success('Roadmap deleted');
    } catch (e) {
      toast.error('Could not delete');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (id, role) => {
    setDownloadingId(id);
    try {
      const safe = (role || 'roadmap').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
      await downloadRoadmapPdf(id, `${safe}_roadmap.pdf`);
    } catch (e) {
      toast.error('Could not download PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-10 text-center">
        <Loader2 className="h-5 w-5 animate-spin text-brand-600 mx-auto" />
        <p className="mt-3 text-sm text-slate-500">Loading your saved roadmaps…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-10 text-center">
        <Bookmark className="h-8 w-8 text-slate-300 mx-auto" />
        <h3 className="mt-3 text-base font-semibold text-slate-900">
          No saved roadmaps yet
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Generate a roadmap from the <strong>Quick Roadmap</strong> tab and click
          <em> Save roadmap </em>to keep it here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-200 overflow-hidden">
      <ul className="divide-y divide-slate-100">
        {items.map((r) => {
          const isOpen = expandedId === r.id;
          return (
            <li key={r.id} className="px-4 sm:px-6">
              <div className="flex flex-wrap items-center gap-3 py-4">
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => toggleExpand(r.id)}
                    className="text-left w-full"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm sm:text-base font-semibold text-slate-900">
                        {r.role}
                      </h4>
                      {r.estimated_time && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                          <Clock className="h-3 w-3" /> {r.estimated_time}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400">
                        {formatDate(r.created_at)}
                      </span>
                    </div>
                    {r.summary && (
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                        {r.summary}
                      </p>
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDownload(r.id, r.role)}
                    disabled={downloadingId === r.id}
                    className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300 transition disabled:opacity-60"
                    title="Download as PDF"
                  >
                    {downloadingId === r.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(r.id, r.role)}
                    disabled={deletingId === r.id}
                    className="inline-flex items-center justify-center rounded-md bg-white px-2 py-1.5 text-xs text-slate-500 ring-1 ring-slate-200 hover:bg-red-50 hover:text-red-600 hover:ring-red-200 transition disabled:opacity-60"
                    title="Delete"
                  >
                    {deletingId === r.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleExpand(r.id)}
                    className="inline-flex items-center justify-center rounded-md bg-white px-2 py-1.5 text-xs text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-800 transition"
                    title={isOpen ? 'Collapse' : 'Expand'}
                  >
                    {isOpen ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
              {isOpen && (
                <div className="pb-5 pt-1">
                  {expandedLoading || !expandedData ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading…
                    </div>
                  ) : (
                    <RoadmapDetail data={expandedData} />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RoadmapDetail({ data }) {
  const {
    summary,
    key_skills = [],
    tools = [],
    requirements = [],
    learning_path = [],
    career_growth = [],
  } = data || {};

  return (
    <div className="rounded-lg bg-slate-50 ring-1 ring-slate-200 p-4 space-y-4">
      {summary && (
        <p className="text-sm text-slate-700 leading-relaxed">{summary}</p>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        {key_skills.length > 0 && (
          <DetailChips title="Key skills" items={key_skills} tone="brand" />
        )}
        {tools.length > 0 && (
          <DetailChips title="Tools & tech" items={tools} tone="accent" />
        )}
      </div>
      {requirements.length > 0 && (
        <div>
          <h6 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Requirements
          </h6>
          <ul className="text-sm text-slate-700 list-disc pl-5 space-y-1">
            {requirements.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
      {learning_path.length > 0 && (
        <div>
          <h6 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Learning path
          </h6>
          <ol className="space-y-2">
            {learning_path.map((s, i) => (
              <li key={i} className="text-sm text-slate-700">
                <span className="font-semibold">
                  {s.step || i + 1}. {s.title || `Step ${i + 1}`}
                </span>
                {s.duration && (
                  <span className="ml-1 text-xs text-slate-500">— {s.duration}</span>
                )}
                {s.description && (
                  <p className="mt-0.5 text-xs text-slate-600">{s.description}</p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
      {career_growth.length > 0 && (
        <div>
          <h6 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Where this leads next
          </h6>
          <div className="flex flex-wrap gap-1.5">
            {career_growth.map((c, i) => (
              <span
                key={i}
                className="inline-flex items-center px-2 py-0.5 rounded-md bg-white ring-1 ring-slate-200 text-xs text-slate-700"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailChips({ title, items, tone }) {
  const cls =
    tone === 'brand'
      ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200'
      : 'bg-accent-50 text-accent-700 ring-1 ring-accent-200';
  return (
    <div>
      <h6 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
        {title}
      </h6>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it, i) => (
          <span
            key={i}
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${cls}`}
          >
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

