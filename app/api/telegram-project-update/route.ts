import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/app/_lib/firebase-admin';
import type { Project, PaymentInfo } from '@/app/dashboard/AppStore';
import {
  DEFAULT_TELEGRAM_TEMPLATE,
  type TelegramTemplate,
  type TelegramSectionConfig,
  type TelegramTimeline,
} from '@/app/_config/constants';

// ── Template resolver ─────────────────────────────────────────────────────────

function resolveTemplate(payment: PaymentInfo): TelegramTemplate {
  const s = payment.telegramTemplate;
  if (!s) return DEFAULT_TELEGRAM_TEMPLATE;
  const def = DEFAULT_TELEGRAM_TEMPLATE;
  const mergeSection = (key: keyof TelegramTemplate['sections']): TelegramSectionConfig => ({
    ...def.sections[key],
    ...s.sections?.[key],
  });
  return {
    headerEmoji: s.headerEmoji ?? def.headerEmoji,
    headerTitle: s.headerTitle ?? def.headerTitle,
    timeline: { ...def.timeline, ...s.timeline } as TelegramTimeline,
    sections: {
      delivered: mergeSection('delivered'),
      unconfirmed: mergeSection('unconfirmed'),
      awaitFilming: mergeSection('awaitFilming'),
      awaitRoughCut: mergeSection('awaitRoughCut'),
      awaitDraft: mergeSection('awaitDraft'),
      awaitMaster: mergeSection('awaitMaster'),
      awaitDeliver: mergeSection('awaitDeliver'),
    },
  };
}

// ── Helpers (mirrors TelegramProjectsButton logic) ────────────────────────────

function getTimelineInfo(deliverDate: string | undefined, tl: TelegramTimeline) {
  if (!deliverDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deliver = new Date(deliverDate);
  deliver.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((deliver.getTime() - today.getTime()) / 86400000);
  const isOverdue = daysLeft < 0;

  let emoji: string;
  if (isOverdue || daysLeft === 0) emoji = tl.overdue;
  else if (daysLeft <= 3) emoji = tl.urgent;
  else if (daysLeft <= 10) emoji = tl.soon;
  else emoji = tl.ok;

  const label = isOverdue
    ? `${Math.abs(daysLeft)}d late`
    : daysLeft === 0
      ? 'due today'
      : `${daysLeft}d left`;

  return { daysLeft, isOverdue, label, emoji };
}

function oneLiner(p: Project, tl: TelegramTimeline): string {
  const info = getTimelineInfo(p.deliverDate, tl);
  return info ? `${tl.noDate} ${p.name} (${info.emoji} ${info.label})` : `${tl.noDate} ${p.name}`;
}

const DIV = '━━━━━━━━━━━━';
const DIV_LIGHT = '──────────────';

function buildSummaryMessage(projects: Project[], tpl: TelegramTemplate): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateStr = today.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const isThisMonth = (d?: string) => {
    if (!d) return false;
    const dt = new Date(d);
    return dt.getFullYear() === today.getFullYear() && dt.getMonth() === today.getMonth();
  };

  const tl = tpl.timeline;
  const sortByUrgency = (a: Project, b: Project) =>
    (getTimelineInfo(a.deliverDate, tl)?.daysLeft ?? 9999) -
    (getTimelineInfo(b.deliverDate, tl)?.daysLeft ?? 9999);

  const active = (p: Project) => p.status === 'confirmed';

  const deliveredThisMonth = projects
    .filter((p) => p.status === 'completed' && isThisMonth(p.completedAt))
    .sort(sortByUrgency);
  const waitConfirm = projects.filter((p) => p.status === 'unconfirmed');
  const awaitFilming = projects.filter((p) => active(p) && !p.phases?.filming).sort(sortByUrgency);
  const awaitRoughCut = projects
    .filter((p) => active(p) && p.phases?.filming && !p.phases?.roughCut)
    .sort(sortByUrgency);
  const awaitDraft = projects
    .filter((p) => active(p) && p.phases?.roughCut && !p.phases?.draft)
    .sort(sortByUrgency);
  const awaitMaster = projects
    .filter((p) => active(p) && p.phases?.draft && !p.phases?.master)
    .sort(sortByUrgency);
  const awaitDeliver = projects
    .filter((p) => active(p) && p.phases?.master && !p.phases?.delivered)
    .sort(sortByUrgency);

  const allActive = [
    ...awaitFilming,
    ...awaitRoughCut,
    ...awaitDraft,
    ...awaitMaster,
    ...awaitDeliver,
  ];
  const veryLate = allActive.filter((p) => getTimelineInfo(p.deliverDate, tl)?.isOverdue);
  const almostLate = allActive.filter((p) => {
    const info = getTimelineInfo(p.deliverDate, tl);
    return info && !info.isOverdue && info.daysLeft <= 2;
  });

  const { sections: sec } = tpl;

  const hasAny = deliveredThisMonth.length > 0 || waitConfirm.length > 0 || allActive.length > 0;
  if (!hasAny) return `${tpl.headerEmoji} ${tpl.headerTitle} — ${dateStr}\n\nNo active projects.`;

  const ln: string[] = [];

  ln.push(`${tpl.headerEmoji} ${tpl.headerTitle} — ${dateStr}`);
  ln.push('');

  const summaryRows = [
    { cfg: sec.delivered, count: deliveredThisMonth.length },
    { cfg: sec.unconfirmed, count: waitConfirm.length },
    { cfg: sec.awaitFilming, count: awaitFilming.length },
    { cfg: sec.awaitRoughCut, count: awaitRoughCut.length },
    { cfg: sec.awaitDraft, count: awaitDraft.length },
    { cfg: sec.awaitMaster, count: awaitMaster.length },
    { cfg: sec.awaitDeliver, count: awaitDeliver.length },
  ].filter((r) => r.cfg.enabled && r.count > 0);
  for (const r of summaryRows) ln.push(`${r.cfg.emoji} ${r.count}  ${r.cfg.label}`);

  ln.push('');
  ln.push(DIV);

  if (sec.delivered.enabled && deliveredThisMonth.length > 0) {
    ln.push('');
    ln.push(`${sec.delivered.emoji}  ${sec.delivered.label} (${deliveredThisMonth.length})`);
    for (const p of deliveredThisMonth) ln.push(`     — ${p.name}`);
  }

  if (sec.unconfirmed.enabled && waitConfirm.length > 0) {
    ln.push('');
    ln.push(`${sec.unconfirmed.emoji}  ${sec.unconfirmed.label} (${waitConfirm.length})`);
    for (const p of waitConfirm) ln.push(`     — ${p.name}`);
  }

  const phaseSections = [
    { cfg: sec.awaitFilming, list: awaitFilming },
    { cfg: sec.awaitRoughCut, list: awaitRoughCut },
    { cfg: sec.awaitDraft, list: awaitDraft },
    { cfg: sec.awaitMaster, list: awaitMaster },
    { cfg: sec.awaitDeliver, list: awaitDeliver },
  ].filter((s) => s.cfg.enabled && s.list.length > 0);

  for (let i = 0; i < phaseSections.length; i++) {
    const { cfg, list } = phaseSections[i];
    ln.push('');
    ln.push(`${cfg.emoji}  ${cfg.label} (${list.length})`);
    for (const p of list) ln.push(`     ${oneLiner(p, tl)}`);
    if (cfg === sec.awaitMaster && i < phaseSections.length - 1) {
      ln.push('');
      ln.push(DIV_LIGHT);
    }
  }

  if (veryLate.length > 0 || almostLate.length > 0) {
    ln.push('');
    if (veryLate.length > 0)
      ln.push(
        `${tl.overdue}  Very late: ${veryLate.length} project${veryLate.length > 1 ? 's' : ''}`
      );
    if (almostLate.length > 0)
      ln.push(
        `${tl.urgent}  Almost late (≤2d): ${almostLate.length} project${almostLate.length > 1 ? 's' : ''}`
      );
  }

  return ln.join('\n');
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  const querySecret = req.nextUrl.searchParams.get('secret');

  const authorized =
    cronSecret && (authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret);

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [projectsSnap, paymentSnap] = await Promise.all([
      adminDb.collection('projects').get(),
      adminDb.doc('settings/payment').get(),
    ]);

    const projects = projectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Project);
    const payment = paymentSnap.exists ? (paymentSnap.data() as PaymentInfo) : null;

    const token = payment?.telegramBotToken?.trim();
    const chatId = payment?.projectTelegramChatId?.trim();

    if (!token || !chatId) {
      return NextResponse.json(
        { error: 'Telegram credentials not configured in settings' },
        { status: 400 }
      );
    }

    const tpl = resolveTemplate(payment ?? ({} as PaymentInfo));
    const text = buildSummaryMessage(projects, tpl);
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('text', text);
    formData.append('parse_mode', 'Markdown');
    if (payment?.projectTelegramTopicId?.trim()) {
      formData.append('message_thread_id', payment.projectTelegramTopicId.trim());
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.description ?? res.statusText }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
