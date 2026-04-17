/**
 * Telegram message builders — shared across API routes.
 * No external dependencies beyond types and constants.
 */

import type { Project, PaymentInfo } from '@/src/types';
import {
  DEFAULT_TELEGRAM_TEMPLATE,
  type TelegramTemplate,
  type TelegramSectionConfig,
  type TelegramTimeline,
} from '@/src/config/constants';

// ── Template ──────────────────────────────────────────────────────────────────

export function resolveTemplate(payment: PaymentInfo): TelegramTemplate {
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatConfirmedMonth(ym?: string): string | null {
  if (!ym) return null;
  const [year, month] = ym.split('-');
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function formatStatus(status: Project['status']): string {
  switch (status) {
    case 'unconfirmed':
      return 'Unconfirmed';
    case 'confirmed':
      return 'Confirmed';
    case 'on-hold':
      return 'On Hold';
    case 'completed':
      return 'Completed';
  }
}

export function getTimelineInfo(deliverDate: string | undefined, tl: TelegramTimeline) {
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

// ── New-project message ───────────────────────────────────────────────────────

export function buildNewProjectMessage(
  project: Project,
  totalActive: number,
  totalUnconfirmed: number
): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateStr = today.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const tl = DEFAULT_TELEGRAM_TEMPLATE.timeline;

  const ln: string[] = [];
  ln.push(`🆕 New Project Added — ${dateStr}`);
  ln.push('');
  ln.push(`📋  ${project.name}`);

  const monthLabel = formatConfirmedMonth(project.confirmedMonth);
  ln.push(`🏷  Status: ${formatStatus(project.status)}${monthLabel ? ` (${monthLabel})` : ''}`);

  if (project.filmingDate) {
    const d = new Date(project.filmingDate);
    ln.push(
      `📅  Filming: ${d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`
    );
  }

  if (project.deliverDate) {
    const info = getTimelineInfo(project.deliverDate, tl);
    if (info) {
      const deliverStr = new Date(project.deliverDate).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      ln.push(`🗓  Deliver: ${deliverStr}  (${info.emoji} ${info.label})`);
    }
  }

  if (project.note?.trim()) {
    const note = project.note.trim();
    ln.push('');
    ln.push(`📝  Notes: ${note.length > 120 ? note.slice(0, 120) + '…' : note}`);
  }

  ln.push('');
  ln.push('━━━━━━━━━━━━');
  ln.push(`💼  Total active: ${totalActive}  |  ⏳ Unconfirmed: ${totalUnconfirmed}`);

  return ln.join('\n');
}

// ── Projects-summary message ──────────────────────────────────────────────────

export function buildProjectsSummaryMessage(projects: Project[], tpl: TelegramTemplate): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateStr = today.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const tl = tpl.timeline;

  const isThisMonth = (d?: string) => {
    if (!d) return false;
    const dt = new Date(d);
    return dt.getFullYear() === today.getFullYear() && dt.getMonth() === today.getMonth();
  };

  const active = (p: Project) => p.status === 'confirmed';
  const sortByUrgency = (a: Project, b: Project) =>
    (getTimelineInfo(a.deliverDate, tl)?.daysLeft ?? 9999) -
    (getTimelineInfo(b.deliverDate, tl)?.daysLeft ?? 9999);

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
    const i = getTimelineInfo(p.deliverDate, tl);
    return i && !i.isOverdue && i.daysLeft <= 2;
  });

  const { sections: sec } = tpl;
  const hasAny = deliveredThisMonth.length > 0 || waitConfirm.length > 0 || allActive.length > 0;
  if (!hasAny) return `${tpl.headerEmoji} ${tpl.headerTitle} — ${dateStr}\n\nNo active projects.`;

  const oneLiner = (p: Project): string => {
    const info = getTimelineInfo(p.deliverDate, tl);
    return info ? `${tl.noDate} ${p.name} (${info.emoji} ${info.label})` : `${tl.noDate} ${p.name}`;
  };

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
  ln.push('━━━━━━━━━━━━');

  if (sec.delivered.enabled && deliveredThisMonth.length > 0) {
    ln.push('');
    ln.push(`${sec.delivered.emoji}  ${sec.delivered.label} (${deliveredThisMonth.length})`);
    for (const p of deliveredThisMonth) ln.push(`     ▸ ${p.name}`);
  }

  if (sec.unconfirmed.enabled && waitConfirm.length > 0) {
    ln.push('');
    ln.push(`${sec.unconfirmed.emoji}  ${sec.unconfirmed.label} (${waitConfirm.length})`);
    for (const p of waitConfirm) ln.push(`     ▸ ${p.name}`);
  }

  const phaseSections = [
    { cfg: sec.awaitFilming, list: awaitFilming },
    { cfg: sec.awaitRoughCut, list: awaitRoughCut },
    { cfg: sec.awaitDraft, list: awaitDraft },
    { cfg: sec.awaitMaster, list: awaitMaster },
    { cfg: sec.awaitDeliver, list: awaitDeliver },
  ].filter((s) => s.cfg.enabled && s.list.length > 0);

  for (const { cfg, list } of phaseSections) {
    ln.push('');
    ln.push(`${cfg.emoji}  ${cfg.label} (${list.length})`);
    for (const p of list) ln.push(`     ${oneLiner(p)}`);
  }

  if (veryLate.length > 0 || almostLate.length > 0) {
    ln.push('');
    ln.push('━━━━━━━━━━━━');
    if (veryLate.length > 0)
      ln.push(`Late: ${veryLate.length} project${veryLate.length > 1 ? 's' : ''}`);
    if (almostLate.length > 0)
      ln.push(`Due Soon (≤2d): ${almostLate.length} project${almostLate.length > 1 ? 's' : ''}`);
  }

  return ln.join('\n');
}

// ── Telegram sender ───────────────────────────────────────────────────────────

export async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
  threadId?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('text', text);
    formData.append('parse_mode', 'Markdown');
    if (threadId) formData.append('message_thread_id', threadId);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err.description ?? res.statusText };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
