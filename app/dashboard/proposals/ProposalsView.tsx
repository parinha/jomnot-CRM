'use client';

import { useState } from 'react';
import { uid } from '@/app/_lib/id';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PortfolioItem {
  id: string;
  title: string;
  platform: string;
  views: string;
  engagement: string;
  description: string;
}

export interface ContentPackage {
  id: string;
  name: string;
  videos: number;
  price: number;
  deliverables: string[];
  timeline: string;
  highlighted: boolean;
}

export interface StoryboardScene {
  id: string;
  scene: number;
  time: string;
  shotType: string;
  description: string;
  notes: string;
}

export type ProposalStatus = 'draft' | 'sent' | 'accepted' | 'rejected';

export interface Proposal {
  id: string;
  number: string;
  date: string;
  status: ProposalStatus;
  // From
  fromName: string;
  fromHandle: string;
  fromBio: string;
  fromFollowers: string;
  fromAvgViews: string;
  fromEngagement: string;
  // To
  toCompany: string;
  toContact: string;
  toPosition: string;
  toEmail: string;
  // Campaign
  campaignTitle: string;
  campaignObjective: string;
  impactStory: string;
  // Content
  portfolioItems: PortfolioItem[];
  packages: ContentPackage[];
  selectedPackageId: string;
  storyboard: StoryboardScene[];
  notes: string;
}

// ── Default packages template ─────────────────────────────────────────────────

function defaultPackages(): ContentPackage[] {
  return [
    {
      id: uid(),
      name: 'Starter',
      videos: 1,
      price: 650,
      deliverables: [
        '1 × Short-form video (60–90 sec)',
        'Brand mention + product placement',
        'Posted on YouTube, TikTok & IG Reels',
        '30-day usage rights',
      ],
      timeline: '7–10 days',
      highlighted: false,
    },
    {
      id: uid(),
      name: 'Growth',
      videos: 3,
      price: 1800,
      deliverables: [
        '3 × Short-form videos (60–90 sec)',
        'Dedicated brand story episode',
        'Cross-posting on all platforms',
        'Thumbnail + caption copywriting',
        '60-day usage rights',
      ],
      timeline: '21–28 days',
      highlighted: true,
    },
    {
      id: uid(),
      name: 'Full Campaign',
      videos: 10,
      price: 5500,
      deliverables: [
        '10 × Short-form videos (60–90 sec)',
        '1 × Long-form documentary (5–8 min)',
        'Monthly performance report',
        'Behind-the-scenes content',
        'Full brand integration + co-branding',
        '90-day usage rights',
      ],
      timeline: '60–90 days',
      highlighted: false,
    },
  ];
}

function defaultStoryboard(): StoryboardScene[] {
  return [
    {
      id: uid(),
      scene: 1,
      time: '0:00–0:10',
      shotType: 'Aerial / Drone',
      description: 'Wide drone shot gliding over lush forest canopy at golden hour. No dialogue.',
      notes: 'Magic hour — schedule at 6:30 AM',
    },
    {
      id: uid(),
      scene: 2,
      time: '0:10–0:25',
      shotType: 'Medium / Walk-in',
      description:
        'Creator walks into frame along a jungle trail, camera reveals eco-lodge in background.',
      notes: 'Handheld for organic feel',
    },
    {
      id: uid(),
      scene: 3,
      time: '0:25–0:45',
      shotType: 'Interview / Vox',
      description:
        'Local community guide shares the story of how eco-tourism transformed the village economy.',
      notes: 'Subtitle overlay in Thai + English',
    },
    {
      id: uid(),
      scene: 4,
      time: '0:45–1:05',
      shotType: 'B-Roll Montage',
      description:
        'Quick cuts: local craft market, children smiling, fresh ingredients at morning market, sponsor product naturally integrated.',
      notes: 'Use warm LUT preset',
    },
    {
      id: uid(),
      scene: 5,
      time: '1:05–1:20',
      shotType: 'Close-up / Product',
      description:
        "Creator genuinely uses/experiences the sponsor's product in context — natural, not forced.",
      notes: 'Integrated, not ad-break style',
    },
    {
      id: uid(),
      scene: 6,
      time: '1:20–1:35',
      shotType: 'CTA / Outro',
      description:
        'Creator speaks to camera: visit link in bio, follow for next episode. Sponsor logo fades in.',
      notes: 'Keep CTA under 15 sec',
    },
  ];
}

function defaultPortfolio(): PortfolioItem[] {
  return [
    {
      id: uid(),
      title: 'Hidden Waterfall Trail — Chiang Rai',
      platform: 'YouTube / TikTok',
      views: '2.3M',
      engagement: '8.4%',
      description:
        'Solo travel documentary revealing an untouched waterfall. Sparked a 40% visitor increase to the region within 3 months.',
    },
    {
      id: uid(),
      title: 'Night Market Food Series — Bangkok',
      platform: 'Instagram Reels',
      views: '1.1M',
      engagement: '11.2%',
      description:
        'Street food deep-dive series. Featured vendor saw daily revenue double after episode aired.',
    },
    {
      id: uid(),
      title: 'Floating Village Life — Tonle Sap',
      platform: 'YouTube',
      views: '890K',
      engagement: '7.6%',
      description:
        'Community story covering sustainable fishing. Collaboration with a local NGO to promote eco-tours.',
    },
  ];
}

// ── Mock seed data ────────────────────────────────────────────────────────────

const SEED: Proposal[] = [
  {
    id: 'prop-001',
    number: 'PROP-2026-001',
    date: '2026-03-15',
    status: 'sent',
    fromName: 'Jomnot (Your Name)',
    fromHandle: '@jomnot',
    fromBio:
      'Travel & lifestyle content creator based in Southeast Asia. I make videos that tell real stories about places, people, and culture — driving authentic tourism and community growth.',
    fromFollowers: '280K',
    fromAvgViews: '950K / mo',
    fromEngagement: '8.9%',
    toCompany: 'GreenRoute Travel Co.',
    toContact: 'Ms. Ariya Suwan',
    toPosition: 'Marketing Director',
    toEmail: 'ariya@greenroute.co.th',
    campaignTitle: 'Eco-Tourism Community Series',
    campaignObjective:
      "Showcase GreenRoute's eco-lodge properties while amplifying the real impact of responsible tourism on local communities — creating content that converts viewers into guests.",
    impactStory:
      "When a video goes viral, a community changes. In 2025 my Hidden Waterfall Trail episode drove a 40% spike in visitors to a small village in Chiang Rai. Local homestays were fully booked for 6 consecutive weekends. The village cooperative used the income to build a community school.\n\nThis is the power of authentic storytelling: your brand doesn't just get views — it gets credit for growth. We bring sponsors into that story, not as advertisers, but as heroes.",
    portfolioItems: defaultPortfolio(),
    packages: defaultPackages(),
    selectedPackageId: '',
    storyboard: defaultStoryboard(),
    notes:
      'Pricing is exclusive of travel & accommodation costs for remote locations. All packages include one revision round.',
  },
  {
    id: 'prop-002',
    number: 'PROP-2026-002',
    date: '2026-03-28',
    status: 'draft',
    fromName: 'Jomnot (Your Name)',
    fromHandle: '@jomnot',
    fromBio: 'Travel & lifestyle content creator based in Southeast Asia.',
    fromFollowers: '280K',
    fromAvgViews: '950K / mo',
    fromEngagement: '8.9%',
    toCompany: 'Horizon Organic Foods',
    toContact: 'Mr. Tanaka Phol',
    toPosition: 'Brand Manager',
    toEmail: 'tanaka@horizonfoods.com',
    campaignTitle: 'Farm-to-Table Thailand',
    campaignObjective:
      'Position Horizon Organic as the go-to brand for health-conscious travellers exploring authentic Thai culinary culture.',
    impactStory: 'Draft — fill in impact story.',
    portfolioItems: defaultPortfolio(),
    packages: defaultPackages(),
    selectedPackageId: '',
    storyboard: defaultStoryboard(),
    notes: '',
  },
];

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<ProposalStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-zinc-100 text-zinc-600' },
  sent: { label: 'Sent', cls: 'bg-blue-100 text-blue-700' },
  accepted: { label: 'Accepted', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-600' },
};

const inputCls =
  'h-10 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition w-full bg-white';
const textareaCls =
  'rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition w-full bg-white resize-none';

// ── Helpers ───────────────────────────────────────────────────────────────────

function nextNumber(proposals: Proposal[]): string {
  const year = new Date().getFullYear();
  const prefix = `PROP-${year}-`;
  const max = proposals.reduce((m, p) => {
    if (!p.number.startsWith(prefix)) return m;
    const n = parseInt(p.number.slice(prefix.length), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

function blankProposal(proposals: Proposal[]): Omit<Proposal, 'id'> {
  return {
    number: nextNumber(proposals),
    date: new Date().toISOString().slice(0, 10),
    status: 'draft',
    fromName: '',
    fromHandle: '',
    fromBio: '',
    fromFollowers: '',
    fromAvgViews: '',
    fromEngagement: '',
    toCompany: '',
    toContact: '',
    toPosition: '',
    toEmail: '',
    campaignTitle: '',
    campaignObjective: '',
    impactStory: '',
    portfolioItems: defaultPortfolio(),
    packages: defaultPackages(),
    selectedPackageId: '',
    storyboard: defaultStoryboard(),
    notes: '',
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProposalsView() {
  const [proposals, setProposals] = useState<Proposal[]>(SEED);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'basics' | 'portfolio' | 'packages' | 'storyboard'>(
    'basics'
  );
  const [form, setForm] = useState<Omit<Proposal, 'id'>>(blankProposal(SEED));
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openNew() {
    setEditingId(null);
    setForm(blankProposal(proposals));
    setActiveTab('basics');
    setPanelOpen(true);
  }

  function openEdit(p: Proposal) {
    setEditingId(p.id);
    const { id: _id, ...rest } = p;
    setForm(rest);
    setActiveTab('basics');
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    setEditingId(null);
  }

  function handleSave() {
    if (editingId) {
      setProposals(proposals.map((p) => (p.id === editingId ? { id: editingId, ...form } : p)));
    } else {
      setProposals([...proposals, { id: uid(), ...form }]);
    }
    closePanel();
  }

  function handleDelete(id: string) {
    setProposals(proposals.filter((p) => p.id !== id));
    setDeleteId(null);
  }

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Portfolio helpers
  function addPortfolioItem() {
    setField('portfolioItems', [
      ...form.portfolioItems,
      { id: uid(), title: '', platform: '', views: '', engagement: '', description: '' },
    ]);
  }
  function updatePortfolioItem(id: string, patch: Partial<PortfolioItem>) {
    setField(
      'portfolioItems',
      form.portfolioItems.map((it) => (it.id === id ? { ...it, ...patch } : it))
    );
  }
  function removePortfolioItem(id: string) {
    setField(
      'portfolioItems',
      form.portfolioItems.filter((it) => it.id !== id)
    );
  }

  // Package helpers
  function updatePackage(id: string, patch: Partial<ContentPackage>) {
    setField(
      'packages',
      form.packages.map((pkg) => (pkg.id === id ? { ...pkg, ...patch } : pkg))
    );
  }

  // Storyboard helpers
  function addScene() {
    const next = form.storyboard.length + 1;
    setField('storyboard', [
      ...form.storyboard,
      { id: uid(), scene: next, time: '', shotType: '', description: '', notes: '' },
    ]);
  }
  function updateScene(id: string, patch: Partial<StoryboardScene>) {
    setField(
      'storyboard',
      form.storyboard.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  }
  function removeScene(id: string) {
    const updated = form.storyboard
      .filter((s) => s.id !== id)
      .map((s, i) => ({ ...s, scene: i + 1 }));
    setField('storyboard', updated);
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Proposals</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{proposals.length} total</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-brand text-zinc-900 text-sm font-medium hover:bg-brand-hover transition"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New proposal
        </button>
      </div>

      {/* Proposal cards */}
      {proposals.length === 0 ? (
        <div className="bg-white rounded-xl border border-zinc-200 flex flex-col items-center justify-center py-20 text-zinc-400">
          <svg
            className="w-10 h-10 mb-3 text-zinc-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l6 6v10a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-sm">No proposals yet. Create your first one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {proposals.map((p) => {
            const sc = STATUS_CFG[p.status];
            const selectedPkg = p.packages.find((pkg) => pkg.id === p.selectedPackageId);
            return (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-zinc-200 overflow-hidden hover:border-zinc-300 hover:shadow-sm transition flex flex-col"
              >
                {/* Card top accent */}
                <div className="h-1.5 w-full bg-gradient-to-r from-brand to-amber-300" />
                <div className="p-5 flex flex-col flex-1 gap-3">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-zinc-400 font-medium">
                        {p.number} · {p.date}
                      </p>
                      <h3 className="text-sm font-semibold text-zinc-900 mt-0.5 truncate">
                        {p.campaignTitle || 'Untitled Campaign'}
                      </h3>
                    </div>
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${sc.cls}`}
                    >
                      {sc.label}
                    </span>
                  </div>

                  {/* To */}
                  <div className="flex items-center gap-2 text-sm text-zinc-600">
                    <div className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                      <svg
                        className="w-3.5 h-3.5 text-zinc-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                    </div>
                    <span className="truncate">
                      {p.toCompany || <span className="text-zinc-400 italic">No company</span>}
                    </span>
                  </div>

                  {p.toContact && (
                    <p className="text-xs text-zinc-400 -mt-1.5 ml-8">
                      {p.toContact}
                      {p.toPosition && `, ${p.toPosition}`}
                    </p>
                  )}

                  {/* Objective snippet */}
                  {p.campaignObjective && (
                    <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                      {p.campaignObjective}
                    </p>
                  )}

                  {/* Package tag */}
                  {selectedPkg ? (
                    <div className="flex items-center gap-2 mt-auto pt-2 border-t border-zinc-100">
                      <span className="text-xs px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-medium border border-amber-200">
                        {selectedPkg.name} · {selectedPkg.videos} video
                        {selectedPkg.videos > 1 ? 's' : ''}
                      </span>
                      <span className="text-sm font-semibold text-zinc-900 ml-auto">
                        ${selectedPkg.price.toLocaleString()}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-auto pt-2 border-t border-zinc-100">
                      <span className="text-xs text-zinc-400">No package selected</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <a
                      href={`/proposals/${p.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                      Preview
                    </a>
                    <button
                      onClick={() => openEdit(p)}
                      className="h-8 px-3 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteId(p.id)}
                      className="h-8 w-8 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 transition flex items-center justify-center"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Slide-in panel ────────────────────────────────────────────────────── */}
      {panelOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={closePanel} />
          <div className="fixed inset-y-0 right-0 z-50 w-full md:max-w-2xl bg-white shadow-2xl flex flex-col">
            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 shrink-0">
              <h2 className="text-lg font-semibold text-zinc-900">
                {editingId ? 'Edit proposal' : 'New proposal'}
              </h2>
              <button onClick={closePanel} className="text-zinc-400 hover:text-zinc-700 transition">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 border-b border-zinc-200 shrink-0 px-6 overflow-x-auto">
              {(
                [
                  { key: 'basics', label: 'Basics' },
                  { key: 'portfolio', label: 'Portfolio' },
                  { key: 'packages', label: 'Packages' },
                  { key: 'storyboard', label: 'Storyboard' },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ${
                    activeTab === key
                      ? 'border-brand text-zinc-900'
                      : 'border-transparent text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
              {/* ── TAB: Basics ── */}
              {activeTab === 'basics' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Proposal Number" required>
                      <input
                        value={form.number}
                        onChange={(e) => setField('number', e.target.value)}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Date" required>
                      <input
                        type="date"
                        value={form.date}
                        onChange={(e) => setField('date', e.target.value)}
                        className={inputCls}
                      />
                    </Field>
                  </div>

                  <Field label="Status">
                    <div className="flex gap-2 flex-wrap">
                      {(Object.keys(STATUS_CFG) as ProposalStatus[]).map((s) => {
                        const active = form.status === s;
                        const cfg = STATUS_CFG[s];
                        return (
                          <button
                            key={s}
                            onClick={() => setField('status', s)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${active ? `${cfg.cls} border-current` : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}
                          >
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </Field>

                  <div className="h-px bg-zinc-100" />
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    From — Creator Info
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Your Name" required>
                      <input
                        value={form.fromName}
                        onChange={(e) => setField('fromName', e.target.value)}
                        placeholder="Jomnot"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Handle / Channel">
                      <input
                        value={form.fromHandle}
                        onChange={(e) => setField('fromHandle', e.target.value)}
                        placeholder="@jomnot"
                        className={inputCls}
                      />
                    </Field>
                  </div>
                  <Field label="Short Bio">
                    <textarea
                      rows={2}
                      value={form.fromBio}
                      onChange={(e) => setField('fromBio', e.target.value)}
                      placeholder="Travel content creator based in Southeast Asia…"
                      className={textareaCls}
                    />
                  </Field>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Followers">
                      <input
                        value={form.fromFollowers}
                        onChange={(e) => setField('fromFollowers', e.target.value)}
                        placeholder="280K"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Avg Views/mo">
                      <input
                        value={form.fromAvgViews}
                        onChange={(e) => setField('fromAvgViews', e.target.value)}
                        placeholder="950K"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Engagement">
                      <input
                        value={form.fromEngagement}
                        onChange={(e) => setField('fromEngagement', e.target.value)}
                        placeholder="8.9%"
                        className={inputCls}
                      />
                    </Field>
                  </div>

                  <div className="h-px bg-zinc-100" />
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    To — Sponsor / Brand
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Company" required>
                      <input
                        value={form.toCompany}
                        onChange={(e) => setField('toCompany', e.target.value)}
                        placeholder="GreenRoute Travel Co."
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Contact Person">
                      <input
                        value={form.toContact}
                        onChange={(e) => setField('toContact', e.target.value)}
                        placeholder="Ms. Ariya Suwan"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Position">
                      <input
                        value={form.toPosition}
                        onChange={(e) => setField('toPosition', e.target.value)}
                        placeholder="Marketing Director"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Email">
                      <input
                        type="email"
                        value={form.toEmail}
                        onChange={(e) => setField('toEmail', e.target.value)}
                        placeholder="ariya@company.com"
                        className={inputCls}
                      />
                    </Field>
                  </div>

                  <div className="h-px bg-zinc-100" />
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Campaign
                  </p>

                  <Field label="Campaign Title" required>
                    <input
                      value={form.campaignTitle}
                      onChange={(e) => setField('campaignTitle', e.target.value)}
                      placeholder="Eco-Tourism Community Series"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Objective">
                    <textarea
                      rows={3}
                      value={form.campaignObjective}
                      onChange={(e) => setField('campaignObjective', e.target.value)}
                      placeholder="Showcase your brand while amplifying community impact…"
                      className={textareaCls}
                    />
                  </Field>
                  <Field label="Community Impact Story">
                    <textarea
                      rows={5}
                      value={form.impactStory}
                      onChange={(e) => setField('impactStory', e.target.value)}
                      placeholder="When a video goes viral, a community changes…"
                      className={textareaCls}
                    />
                  </Field>
                  <Field label="Notes / Terms">
                    <textarea
                      rows={2}
                      value={form.notes}
                      onChange={(e) => setField('notes', e.target.value)}
                      placeholder="Travel costs not included, one revision round…"
                      className={textareaCls}
                    />
                  </Field>
                </>
              )}

              {/* ── TAB: Portfolio ── */}
              {activeTab === 'portfolio' && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-zinc-700">Past Work Highlights</p>
                    <button
                      onClick={addPortfolioItem}
                      className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900 transition"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Add item
                    </button>
                  </div>
                  {form.portfolioItems.map((item, i) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-zinc-200 p-4 flex flex-col gap-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-500">#{i + 1}</span>
                        <button
                          onClick={() => removePortfolioItem(item.id)}
                          className="text-xs text-red-400 hover:text-red-600 transition"
                        >
                          Remove
                        </button>
                      </div>
                      <Field label="Video / Content Title">
                        <input
                          value={item.title}
                          onChange={(e) => updatePortfolioItem(item.id, { title: e.target.value })}
                          placeholder="Hidden Waterfall Trail — Chiang Rai"
                          className={inputCls}
                        />
                      </Field>
                      <div className="grid grid-cols-3 gap-3">
                        <Field label="Platform">
                          <input
                            value={item.platform}
                            onChange={(e) =>
                              updatePortfolioItem(item.id, { platform: e.target.value })
                            }
                            placeholder="YouTube / TikTok"
                            className={inputCls}
                          />
                        </Field>
                        <Field label="Views">
                          <input
                            value={item.views}
                            onChange={(e) =>
                              updatePortfolioItem(item.id, { views: e.target.value })
                            }
                            placeholder="2.3M"
                            className={inputCls}
                          />
                        </Field>
                        <Field label="Engagement">
                          <input
                            value={item.engagement}
                            onChange={(e) =>
                              updatePortfolioItem(item.id, { engagement: e.target.value })
                            }
                            placeholder="8.4%"
                            className={inputCls}
                          />
                        </Field>
                      </div>
                      <Field label="Impact Description">
                        <textarea
                          rows={2}
                          value={item.description}
                          onChange={(e) =>
                            updatePortfolioItem(item.id, { description: e.target.value })
                          }
                          placeholder="What changed because of this video…"
                          className={textareaCls}
                        />
                      </Field>
                    </div>
                  ))}
                </>
              )}

              {/* ── TAB: Packages ── */}
              {activeTab === 'packages' && (
                <>
                  <p className="text-sm font-medium text-zinc-700">Content Packages</p>
                  <Field label="Selected Package (for proposal card)">
                    <select
                      value={form.selectedPackageId}
                      onChange={(e) => setField('selectedPackageId', e.target.value)}
                      className={inputCls}
                    >
                      <option value="">None selected</option>
                      {form.packages.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.name} — {pkg.videos} video{pkg.videos > 1 ? 's' : ''} · $
                          {pkg.price.toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {form.packages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className={`rounded-xl border p-4 flex flex-col gap-3 ${pkg.highlighted ? 'border-brand bg-amber-50/40' : 'border-zinc-200'}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-900 flex-1">
                          {pkg.name}
                        </span>
                        <label className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={pkg.highlighted}
                            onChange={(e) =>
                              updatePackage(pkg.id, { highlighted: e.target.checked })
                            }
                            className="accent-brand"
                          />
                          Highlight
                        </label>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <Field label="Package Name">
                          <input
                            value={pkg.name}
                            onChange={(e) => updatePackage(pkg.id, { name: e.target.value })}
                            className={inputCls}
                          />
                        </Field>
                        <Field label="# of Videos">
                          <input
                            type="number"
                            min={1}
                            value={pkg.videos}
                            onChange={(e) =>
                              updatePackage(pkg.id, { videos: parseInt(e.target.value) || 1 })
                            }
                            className={inputCls}
                          />
                        </Field>
                        <Field label="Price (USD)">
                          <input
                            type="number"
                            min={0}
                            value={pkg.price}
                            onChange={(e) =>
                              updatePackage(pkg.id, { price: parseInt(e.target.value) || 0 })
                            }
                            className={inputCls}
                          />
                        </Field>
                      </div>
                      <Field label="Timeline">
                        <input
                          value={pkg.timeline}
                          onChange={(e) => updatePackage(pkg.id, { timeline: e.target.value })}
                          placeholder="7–10 days"
                          className={inputCls}
                        />
                      </Field>
                      <Field label="Deliverables (one per line)">
                        <textarea
                          rows={4}
                          value={pkg.deliverables.join('\n')}
                          onChange={(e) =>
                            updatePackage(pkg.id, { deliverables: e.target.value.split('\n') })
                          }
                          className={textareaCls}
                        />
                      </Field>
                    </div>
                  ))}
                </>
              )}

              {/* ── TAB: Storyboard ── */}
              {activeTab === 'storyboard' && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-zinc-700">Storyboard Scenes</p>
                    <button
                      onClick={addScene}
                      className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900 transition"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Add scene
                    </button>
                  </div>
                  {form.storyboard.map((scene) => (
                    <div
                      key={scene.id}
                      className="rounded-xl border border-zinc-200 p-4 flex flex-col gap-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-zinc-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {scene.scene}
                        </span>
                        <span className="text-xs text-zinc-400 flex-1">Scene {scene.scene}</span>
                        <button
                          onClick={() => removeScene(scene.id)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Time / Duration">
                          <input
                            value={scene.time}
                            onChange={(e) => updateScene(scene.id, { time: e.target.value })}
                            placeholder="0:00–0:15"
                            className={inputCls}
                          />
                        </Field>
                        <Field label="Shot Type">
                          <input
                            value={scene.shotType}
                            onChange={(e) => updateScene(scene.id, { shotType: e.target.value })}
                            placeholder="Drone / Close-up / Interview…"
                            className={inputCls}
                          />
                        </Field>
                      </div>
                      <Field label="Scene Description">
                        <textarea
                          rows={2}
                          value={scene.description}
                          onChange={(e) => updateScene(scene.id, { description: e.target.value })}
                          placeholder="What happens in this shot…"
                          className={textareaCls}
                        />
                      </Field>
                      <Field label="Director Notes">
                        <input
                          value={scene.notes}
                          onChange={(e) => updateScene(scene.id, { notes: e.target.value })}
                          placeholder="Lighting, lens, timing notes…"
                          className={inputCls}
                        />
                      </Field>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Panel footer */}
            <div className="px-6 py-4 border-t border-zinc-200 flex justify-end gap-3 shrink-0">
              <button
                onClick={closePanel}
                className="h-9 px-4 rounded-lg border border-zinc-200 text-sm text-zinc-700 hover:bg-zinc-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="h-9 px-4 rounded-lg bg-brand text-zinc-900 text-sm font-medium hover:bg-brand-hover transition"
              >
                {editingId ? 'Save changes' : 'Create proposal'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-zinc-900 mb-2">Delete proposal?</h3>
            <p className="text-sm text-zinc-500 mb-5">This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="h-9 px-4 rounded-lg border border-zinc-200 text-sm text-zinc-700 hover:bg-zinc-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="h-9 px-4 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-zinc-600">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
