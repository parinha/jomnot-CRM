'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Brand ─────────────────────────────────────────────────────────────────────
const BRAND = '#FFC206';

// ── Static slide data ─────────────────────────────────────────────────────────

const PLATFORMS = [
  { name: 'Facebook', followers: '350K', icon: 'fb', color: '#1877F2' },
  { name: 'TikTok', followers: '100K', icon: 'tt', color: '#000000' },
  { name: 'YouTube', followers: '5K', icon: 'yt', color: '#FF0000', label: 'subscribers' },
  { name: 'Instagram', followers: '4K', icon: 'ig', color: '#E1306C' },
];

const PORTFOLIO = [
  {
    title: 'Sea & Island Escapes',
    category: 'Sea',
    views: '1.8M',
    engagement: '9.2%',
    desc: 'Snorkeling, island-hopping, coastal villages',
    grad: 'linear-gradient(135deg,#0ea5e9,#06b6d4)',
    icon: '🌊',
  },
  {
    title: 'Mountain Trails',
    category: 'Mountain',
    views: '2.3M',
    engagement: '8.4%',
    desc: 'Trekking, viewpoints, highland culture',
    grad: 'linear-gradient(135deg,#16a34a,#4ade80)',
    icon: '⛰️',
  },
  {
    title: 'Camping Life',
    category: 'Camping',
    views: '900K',
    engagement: '11.1%',
    desc: 'Wild camping, campfire cooking, stargazing',
    grad: 'linear-gradient(135deg,#d97706,#fbbf24)',
    icon: '⛺',
  },
  {
    title: 'Eco-Tourism Stories',
    category: 'Eco-Tourism',
    views: '1.1M',
    engagement: '10.3%',
    desc: 'Community-led tours, conservation, local guides',
    grad: 'linear-gradient(135deg,#15803d,#86efac)',
    icon: '🌿',
  },
  {
    title: 'Resort & Luxury Stay',
    category: 'Resort',
    views: '760K',
    engagement: '7.8%',
    desc: 'Boutique resorts, wellness retreats, pool villas',
    grad: 'linear-gradient(135deg,#7c3aed,#c084fc)',
    icon: '🏝️',
  },
];

const PACKAGES = [
  {
    name: 'Starter',
    videos: 1,
    price: 650,
    scope: [
      '1× Short-form video (60–90 sec)',
      'Script & concept development',
      '1 round of revision',
    ],
    platforms: ['Facebook Reels', 'TikTok', 'Instagram Reels'],
    usage: '30 days',
    highlighted: false,
  },
  {
    name: 'Growth',
    videos: 3,
    price: 1800,
    scope: [
      '3× Short-form videos (60–90 sec)',
      'Brand story integration',
      'Thumbnail + caption copy',
      '2 rounds of revision',
    ],
    platforms: ['Facebook', 'TikTok', 'YouTube Shorts', 'Instagram'],
    usage: '60 days',
    highlighted: true,
  },
  {
    name: 'Full Campaign',
    videos: 10,
    price: 5500,
    scope: [
      '10× Short-form videos',
      '1× Long-form doc (3–5 min)',
      'Monthly analytics report',
      'Behind-the-scenes bonus',
      'Co-branding rights',
    ],
    platforms: ['All platforms', 'YouTube Main Channel', 'Facebook Page + Reels'],
    usage: '90 days + renewal option',
    highlighted: false,
  },
];

const STORYBOARD = [
  {
    time: 'Thumbnail',
    label: 'Product Visible',
    desc: 'Sponsor product/logo clearly visible in thumbnail — grabs attention before click',
    color: '#7c3aed',
    icon: '🖼️',
  },
  {
    time: '0:00–0:03',
    label: 'Opening Hook',
    desc: 'Product appears in first 3 seconds during the opening hook — establishes brand recall',
    color: '#dc2626',
    icon: '⚡',
  },
  {
    time: '0:15',
    label: 'Product Awareness',
    desc: 'Natural product awareness shot — creator uses or interacts with sponsor product',
    color: '#ea580c',
    icon: '👁️',
  },
  {
    time: '1:00–1:20',
    label: 'Sponsor Segment',
    desc: 'Dedicated 20-second sponsor spotlight — product story, call-to-action, brand message',
    color: BRAND,
    icon: '⭐',
  },
  {
    time: '3–5 min',
    label: 'Total Video Length',
    desc: 'Full production. Organic pace keeps viewers engaged and boosts watch-time algorithm',
    color: '#16a34a',
    icon: '🎬',
  },
];

const WHY_US = [
  {
    icon: '🚫🍺',
    title: 'Zero Alcohol Content',
    desc: 'Brand-safe, family-friendly. We never promote alcohol, gambling, or harmful products. Your brand stays clean.',
  },
  {
    icon: '🤝',
    title: 'Boost Local Economy',
    desc: 'Every video supports local guides, vendors & homestays. Viewers become visitors, visitors become customers.',
  },
  {
    icon: '🇰🇭',
    title: 'Promote Cambodia Tourism',
    desc: "We actively showcase Cambodia's hidden gems — beaches, mountains, temples — putting your brand on the map.",
  },
  {
    icon: '📊',
    title: 'Real Engagement, Real People',
    desc: '6M avg monthly views with 8–11% engagement rate. No bots, no inflated metrics — verified authentic audience.',
  },
  {
    icon: '📱',
    title: 'Multi-Platform Reach',
    desc: 'One shoot, four platforms. Facebook 350K + TikTok 100K + YouTube + Instagram — maximum reach per budget.',
  },
  {
    icon: '🎥',
    title: 'Story-First, Ad-Second',
    desc: "Viewers watch because it's a great story. Your brand is woven in naturally — not interruptive, but memorable.",
  },
];

// ── Slide counter ─────────────────────────────────────────────────────────────
const TOTAL_SLIDES = 5;

// ── Main component ────────────────────────────────────────────────────────────

export default function ProposalPrint({ id: _id }: { id: string }) {
  const [slide, setSlide] = useState(0);
  const [dir, setDir] = useState<'next' | 'prev'>('next');
  const [animating, setAnimating] = useState(false);

  const go = useCallback(
    (next: number, direction: 'next' | 'prev') => {
      if (animating) return;
      setDir(direction);
      setAnimating(true);
      setTimeout(() => {
        setSlide(next);
        setAnimating(false);
      }, 280);
    },
    [animating]
  );

  const prev = () => slide > 0 && go(slide - 1, 'prev');
  const next = () => slide < TOTAL_SLIDES - 1 && go(slide + 1, 'next');

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const slides = [
    <Slide1 key={0} />,
    <Slide2 key={1} />,
    <Slide3 key={2} />,
    <Slide4 key={3} />,
    <Slide5 key={4} />,
  ];

  return (
    <>
      {/* ── Screen: Full-screen slideshow ── */}
      <div className="no-print fixed inset-0 bg-zinc-900 flex flex-col items-center justify-center">
        {/* Slide window */}
        <div className="relative w-full h-full flex items-center justify-center px-2 py-2 md:px-10 md:py-6">
          <div
            className="relative w-full bg-white shadow-2xl overflow-hidden"
            style={{
              aspectRatio: '16/9',
              maxHeight: '100%',
              maxWidth: 'calc((100vh - 80px) * (16/9))',
            }}
          >
            {/* Slide content */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                opacity: animating ? 0 : 1,
                transform: animating
                  ? `translateX(${dir === 'next' ? '-40px' : '40px'})`
                  : 'translateX(0)',
                transition: animating ? 'none' : 'opacity 0.28s ease, transform 0.28s ease',
              }}
            >
              {slides[slide]}
            </div>
          </div>

          {/* Prev arrow */}
          <button
            onClick={prev}
            disabled={slide === 0}
            className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 w-9 h-9 md:w-11 md:h-11 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 disabled:cursor-not-allowed text-white flex items-center justify-center transition backdrop-blur-sm"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Next arrow */}
          <button
            onClick={next}
            disabled={slide === TOTAL_SLIDES - 1}
            className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 w-9 h-9 md:w-11 md:h-11 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 disabled:cursor-not-allowed text-white flex items-center justify-center transition backdrop-blur-sm"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Bottom bar */}
        <div className="no-print w-full flex items-center justify-between px-6 pb-3 pt-1 shrink-0">
          {/* Dots */}
          <div className="flex gap-2 mx-auto">
            {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
              <button
                key={i}
                onClick={() => go(i, i > slide ? 'next' : 'prev')}
                className="transition-all duration-200"
                style={{
                  width: i === slide ? '24px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  background: i === slide ? BRAND : 'rgba(255,255,255,0.3)',
                }}
              />
            ))}
          </div>
          {/* Counter */}
          <div className="absolute right-6 text-xs text-white/40 font-mono">
            {slide + 1} / {TOTAL_SLIDES}
          </div>
        </div>
      </div>

      {/* ── Print: all slides stacked ── */}
      <div className="print-only">
        {slides.map((s, i) => (
          <div
            key={i}
            style={{
              pageBreakAfter: 'always',
              width: '297mm',
              height: '210mm',
              overflow: 'hidden',
            }}
          >
            {s}
          </div>
        ))}
      </div>

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }
          body { margin: 0; }
          .no-print   { display: none !important; }
          .print-only { display: block !important; }
        }
        @media screen { .print-only { display: none; } }
      `}</style>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 1 — Who We Are
// ══════════════════════════════════════════════════════════════════════════════

function Slide1() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#111111',
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      {/* Background decorations */}
      <div
        style={{
          position: 'absolute',
          top: '-80px',
          right: '-80px',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${BRAND}25 0%, transparent 65%)`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-100px',
          left: '-60px',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, #ffffff08 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Left panel — identity */}
      <div
        style={{
          width: '45%',
          padding: '6% 5% 6% 7%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          zIndex: 1,
        }}
      >
        {/* Since badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: `${BRAND}20`,
            border: `1px solid ${BRAND}50`,
            borderRadius: '20px',
            padding: '4px 12px',
            marginBottom: '20px',
            width: 'fit-content',
          }}
        >
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: BRAND }} />
          <span
            style={{ color: BRAND, fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em' }}
          >
            SINCE 2021
          </span>
        </div>

        {/* Brand name */}
        <h1
          style={{
            margin: '0 0 6px',
            fontSize: '42px',
            fontWeight: 900,
            color: 'white',
            lineHeight: 1.05,
            letterSpacing: '-1px',
          }}
        >
          JOMNOT
          <br />
          <span style={{ color: BRAND }}>EXPLORE</span>
        </h1>
        <p
          style={{
            margin: '0 0 28px',
            fontSize: '15px',
            color: 'rgba(255,255,255,0.55)',
            fontWeight: 400,
            letterSpacing: '0.04em',
          }}
        >
          Travel Content Creator
        </p>

        {/* Bio */}
        <p
          style={{
            margin: '0 0 32px',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.65)',
            lineHeight: 1.75,
            maxWidth: '340px',
          }}
        >
          We explore the hidden stories of Southeast Asia — mountains, coastlines, and communities —
          turning real experiences into content that moves people and places.
        </p>

        {/* Hero stat */}
        <div
          style={{
            background: `linear-gradient(135deg, ${BRAND}, #E5AE00)`,
            borderRadius: '12px',
            padding: '16px 22px',
            display: 'inline-block',
            maxWidth: '260px',
          }}
        >
          <div
            style={{
              fontSize: '36px',
              fontWeight: 900,
              color: '#111',
              letterSpacing: '-1px',
              lineHeight: 1,
            }}
          >
            6M+
          </div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#111',
              marginTop: '4px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Average Monthly Views
          </div>
        </div>
      </div>

      {/* Right panel — platform stats */}
      <div
        style={{
          flex: 1,
          padding: '6% 7% 6% 4%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '14px',
          zIndex: 1,
        }}
      >
        <p
          style={{
            margin: '0 0 8px',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.35)',
          }}
        >
          Our Reach
        </p>

        {PLATFORMS.map((p) => (
          <div
            key={p.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '10px',
              padding: '14px 18px',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            {/* Platform color dot */}
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: p.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <PlatformIcon name={p.icon} />
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginBottom: '2px' }}
              >
                {p.name}
              </div>
              <div
                style={{
                  fontSize: '22px',
                  fontWeight: 900,
                  color: 'white',
                  letterSpacing: '-0.5px',
                  lineHeight: 1,
                }}
              >
                {p.followers}
              </div>
              <div
                style={{
                  fontSize: '9px',
                  color: 'rgba(255,255,255,0.35)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {p.label ?? 'followers'}
              </div>
            </div>
            {/* Bar */}
            <div
              style={{
                width: '60px',
                height: '4px',
                borderRadius: '2px',
                background: 'rgba(255,255,255,0.1)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  borderRadius: '2px',
                  background: p.color,
                  width:
                    p.name === 'Facebook'
                      ? '100%'
                      : p.name === 'TikTok'
                        ? '29%'
                        : p.name === 'YouTube'
                          ? '9%'
                          : '5%',
                }}
              />
            </div>
          </div>
        ))}

        {/* Slide label */}
        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '20px', height: '2px', background: BRAND, borderRadius: '1px' }} />
          <span
            style={{
              fontSize: '9px',
              color: 'rgba(255,255,255,0.25)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            01 / Who We Are
          </span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 2 — Content We've Done
// ══════════════════════════════════════════════════════════════════════════════

function Slide2() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#0f0f0f',
        display: 'flex',
        flexDirection: 'column',
        padding: '5% 6%',
        fontFamily: 'Arial, sans-serif',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: '4%',
        }}
      >
        <div>
          <p
            style={{
              margin: '0 0 4px',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: BRAND,
            }}
          >
            02 / Portfolio
          </p>
          <h2
            style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: 900,
              color: 'white',
              letterSpacing: '-0.5px',
            }}
          >
            Content We&apos;ve Created
          </h2>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: '11px',
            color: 'rgba(255,255,255,0.4)',
            textAlign: 'right',
            lineHeight: 1.5,
          }}
        >
          From sea to summit —<br />
          we&apos;ve covered it all.
        </p>
      </div>

      {/* Cards grid */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
        {PORTFOLIO.map((item, i) => (
          <div
            key={i}
            style={{
              borderRadius: '12px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {/* Thumbnail */}
            <div
              style={{
                background: item.grad,
                aspectRatio: '16/9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: '32px', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }}>
                {item.icon}
              </span>
              {/* Play button */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '6px',
                  right: '6px',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: 0,
                    height: 0,
                    borderTop: '4px solid transparent',
                    borderBottom: '4px solid transparent',
                    borderLeft: '7px solid white',
                    marginLeft: '1px',
                  }}
                />
              </div>
              {/* Category pill */}
              <div
                style={{
                  position: 'absolute',
                  top: '6px',
                  left: '6px',
                  background: 'rgba(0,0,0,0.55)',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  fontSize: '8px',
                  fontWeight: 700,
                  color: 'white',
                  backdropFilter: 'blur(4px)',
                }}
              >
                {item.category}
              </div>
            </div>

            {/* Info */}
            <div style={{ flex: 1, background: '#1a1a1a', padding: '10px 10px 10px' }}>
              <p
                style={{
                  margin: '0 0 6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'white',
                  lineHeight: 1.3,
                }}
              >
                {item.title}
              </p>
              <p
                style={{
                  margin: '0 0 8px',
                  fontSize: '9px',
                  color: 'rgba(255,255,255,0.45)',
                  lineHeight: 1.5,
                }}
              >
                {item.desc}
              </p>
              {/* Stats */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <span
                  style={{
                    fontSize: '9px',
                    background: 'rgba(255,194,6,0.15)',
                    color: BRAND,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: 700,
                  }}
                >
                  👁 {item.views}
                </span>
                <span
                  style={{
                    fontSize: '9px',
                    background: 'rgba(34,197,94,0.15)',
                    color: '#4ade80',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: 700,
                  }}
                >
                  ❤️ {item.engagement}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 3 — Packages
// ══════════════════════════════════════════════════════════════════════════════

function Slide3() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#111',
        display: 'flex',
        flexDirection: 'column',
        padding: '5% 6%',
        fontFamily: 'Arial, sans-serif',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '4%' }}>
        <p
          style={{
            margin: '0 0 4px',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: BRAND,
          }}
        >
          03 / Packages
        </p>
        <h2
          style={{
            margin: 0,
            fontSize: '28px',
            fontWeight: 900,
            color: 'white',
            letterSpacing: '-0.5px',
          }}
        >
          Content Packages &amp; Rates
        </h2>
      </div>

      {/* Package cards */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          alignItems: 'start',
        }}
      >
        {PACKAGES.map((pkg, i) => (
          <div
            key={i}
            style={{
              borderRadius: '14px',
              border: pkg.highlighted ? `2px solid ${BRAND}` : '1px solid rgba(255,255,255,0.1)',
              background: pkg.highlighted ? 'linear-gradient(160deg,#1e1600,#111)' : '#161616',
              padding: '22px 20px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {pkg.highlighted && (
              <div
                style={{
                  position: 'absolute',
                  top: '14px',
                  right: '-18px',
                  background: BRAND,
                  color: '#111',
                  fontSize: '8px',
                  fontWeight: 900,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '3px 28px',
                  transform: 'rotate(35deg)',
                }}
              >
                Most Popular
              </div>
            )}

            {/* Name + videos */}
            <div style={{ marginBottom: '12px' }}>
              <div
                style={{
                  fontSize: '11px',
                  color: pkg.highlighted ? BRAND : 'rgba(255,255,255,0.4)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: '4px',
                }}
              >
                {pkg.name}
              </div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', fontWeight: 400 }}>
                {pkg.videos} video{pkg.videos > 1 ? 's' : ''}
              </div>
            </div>

            {/* Price */}
            <div
              style={{
                fontSize: '34px',
                fontWeight: 900,
                color: 'white',
                letterSpacing: '-1px',
                lineHeight: 1,
                marginBottom: '18px',
              }}
            >
              ${pkg.price.toLocaleString()}
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 400,
                  color: 'rgba(255,255,255,0.4)',
                  letterSpacing: 0,
                  marginLeft: '4px',
                }}
              >
                USD
              </span>
            </div>

            {/* Scope */}
            <PackageSection label="Scope of Work" color="#60a5fa">
              {pkg.scope.map((d, j) => (
                <PackageRow key={j} text={d} />
              ))}
            </PackageSection>

            <PackageSection label="Publish Platforms" color="#a78bfa">
              {pkg.platforms.map((d, j) => (
                <PackageRow key={j} text={d} />
              ))}
            </PackageSection>

            <PackageSection label="Usage Rights" color="#34d399">
              <PackageRow text={pkg.usage} />
            </PackageSection>
          </div>
        ))}
      </div>
    </div>
  );
}

function PackageSection({
  label,
  color,
  children,
}: {
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div
        style={{
          fontSize: '8px',
          fontWeight: 800,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color,
          marginBottom: '5px',
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>{children}</div>
    </div>
  );
}
function PackageRow({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
      <span
        style={{ color: BRAND, fontWeight: 900, fontSize: '9px', marginTop: '1px', flexShrink: 0 }}
      >
        ›
      </span>
      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
        {text}
      </span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 4 — Storyboard / Product Placement
// ══════════════════════════════════════════════════════════════════════════════

function Slide4() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#0d0d0d',
        display: 'flex',
        flexDirection: 'column',
        padding: '5% 6%',
        fontFamily: 'Arial, sans-serif',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '3%' }}>
        <p
          style={{
            margin: '0 0 4px',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: BRAND,
          }}
        >
          04 / Storyboard
        </p>
        <h2
          style={{
            margin: 0,
            fontSize: '28px',
            fontWeight: 900,
            color: 'white',
            letterSpacing: '-0.5px',
          }}
        >
          How Your Brand Appears
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>
          Product placement strategy across every key viewing moment
        </p>
      </div>

      {/* Video mockup + timeline */}
      <div style={{ flex: 1, display: 'flex', gap: '4%', alignItems: 'center' }}>
        {/* Left: video frame sketch */}
        <div style={{ width: '38%', flexShrink: 0 }}>
          {/* "Phone" mockup */}
          <div
            style={{
              background: '#1a1a1a',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.12)',
              overflow: 'hidden',
              aspectRatio: '9/16',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '260px',
            }}
          >
            {/* Screen area */}
            <div
              style={{
                flex: 1,
                background: 'linear-gradient(160deg,#1a3a1a,#0d2020)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Jungle scene sketch */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '36px', marginBottom: '4px' }}>🌿</div>
                <div
                  style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}
                >
                  Scene preview
                </div>
              </div>
              {/* PRODUCT badge overlay */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  left: '10px',
                  right: '10px',
                  background: `${BRAND}`,
                  borderRadius: '6px',
                  padding: '6px 10px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: '9px',
                    fontWeight: 900,
                    color: '#111',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  ⭐ YOUR PRODUCT HERE
                </div>
                <div style={{ fontSize: '8px', color: 'rgba(0,0,0,0.6)', marginTop: '1px' }}>
                  1:00–1:20 · Sponsor Segment
                </div>
              </div>
            </div>
            {/* Progress bar at bottom */}
            <div style={{ padding: '6px 10px', background: '#111' }}>
              <div
                style={{
                  height: '3px',
                  background: 'rgba(255,255,255,0.15)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{ width: '28%', height: '100%', background: BRAND, borderRadius: '2px' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
                <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>1:02</span>
                <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>3:45</span>
              </div>
            </div>
          </div>

          {/* Duration label */}
          <div style={{ textAlign: 'center', marginTop: '10px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
              Total video length:{' '}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'white' }}>3–5 minutes</span>
          </div>
        </div>

        {/* Right: placement timeline cards */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {STORYBOARD.map((s, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: '14px',
                alignItems: 'center',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: '10px',
                padding: '12px 16px',
                border: '1px solid rgba(255,255,255,0.07)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Left accent bar */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: '3px',
                  background: s.color,
                  borderRadius: '3px 0 0 3px',
                }}
              />

              {/* Icon */}
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: `${s.color}20`,
                  border: `1px solid ${s.color}40`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  flexShrink: 0,
                }}
              >
                {s.icon}
              </div>

              {/* Time badge */}
              <div
                style={{
                  background: s.color,
                  color: s.color === BRAND ? '#111' : 'white',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '10px',
                  fontWeight: 900,
                  flexShrink: 0,
                  minWidth: '64px',
                  textAlign: 'center',
                }}
              >
                {s.time}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{ fontSize: '12px', fontWeight: 800, color: 'white', marginBottom: '2px' }}
                >
                  {s.label}
                </div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
                  {s.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 5 — Why Choose Us
// ══════════════════════════════════════════════════════════════════════════════

function Slide5() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#111',
        display: 'flex',
        flexDirection: 'column',
        padding: '5% 6%',
        fontFamily: 'Arial, sans-serif',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* BG decoration */}
      <div
        style={{
          position: 'absolute',
          bottom: '-120px',
          right: '-80px',
          width: '360px',
          height: '360px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${BRAND}15 0%, transparent 65%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Header */}
      <div style={{ marginBottom: '4%' }}>
        <p
          style={{
            margin: '0 0 4px',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: BRAND,
          }}
        >
          05 / Why Us
        </p>
        <h2
          style={{
            margin: 0,
            fontSize: '28px',
            fontWeight: 900,
            color: 'white',
            letterSpacing: '-0.5px',
          }}
        >
          Why Partner with Jomnot Explore?
        </h2>
      </div>

      {/* Reason cards — 2 rows × 3 cols */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridTemplateRows: 'repeat(2, 1fr)',
          gap: '12px',
        }}
      >
        {WHY_US.map((item, i) => (
          <div
            key={i}
            style={{
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '18px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              position: 'relative',
              overflow: 'hidden',
              transition: 'all 0.2s',
            }}
          >
            {/* Accent corner */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '40px',
                height: '3px',
                background: BRAND,
                borderRadius: '0 0 2px 0',
              }}
            />
            <div style={{ fontSize: '22px', marginBottom: '2px' }}>{item.icon}</div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'white', lineHeight: 1.3 }}>
              {item.title}
            </div>
            <div
              style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, flex: 1 }}
            >
              {item.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <div
        style={{
          marginTop: '3%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: `linear-gradient(135deg,${BRAND},#E5AE00)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: '14px',
              color: '#111',
            }}
          >
            J
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'white' }}>JOMNOT EXPLORE</div>
            <div style={{ fontSize: '10px', color: BRAND }}>
              Travel Content Creator · Since 2021
            </div>
          </div>
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
          Let&apos;s build something unforgettable together.
        </div>
      </div>
    </div>
  );
}

// ── Platform icon SVG paths (inline) ─────────────────────────────────────────

function PlatformIcon({ name }: { name: string }) {
  if (name === 'fb')
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
        <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
      </svg>
    );
  if (name === 'tt')
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.88a8.17 8.17 0 004.84 1.56V7.01a4.85 4.85 0 01-1.07-.32z" />
      </svg>
    );
  if (name === 'yt')
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
        <path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58a2.78 2.78 0 001.95 1.95C5.12 20 12 20 12 20s6.88 0 8.59-.47a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
      </svg>
    );
  // Instagram
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}
