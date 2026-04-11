import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/app/_lib/firebase-admin';
import type { Project, PaymentInfo } from '@/app/dashboard/AppStore';

// ── Helpers (mirrors TelegramProjectsButton logic) ────────────────────────────

function getTimelineInfo(deliverDate?: string) {
  if (!deliverDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deliver = new Date(deliverDate);
  deliver.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((deliver.getTime() - today.getTime()) / 86400000);
  const isOverdue = daysLeft < 0;

  let emoji: string;
  if (isOverdue || daysLeft === 0) emoji = '🔴';
  else if (daysLeft <= 3) emoji = '🟠';
  else if (daysLeft <= 10) emoji = '🟡';
  else emoji = '🟢';

  const label = isOverdue
    ? `${Math.abs(daysLeft)}d late`
    : daysLeft === 0
      ? 'due today'
      : `${daysLeft}d left`;

  return { daysLeft, isOverdue, label, emoji };
}

function oneLiner(p: Project): string {
  const tl = getTimelineInfo(p.deliverDate);
  return tl ? `${tl.emoji} ${tl.label} — ${p.name}` : `▸ ${p.name}`;
}

const DIV = '━━━━━━━━━━━━';
const DIV_LIGHT = '──────────────';

function buildSummaryMessage(projects: Project[]): string {
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

  const sortByUrgency = (a: Project, b: Project) =>
    (getTimelineInfo(a.deliverDate)?.daysLeft ?? 9999) -
    (getTimelineInfo(b.deliverDate)?.daysLeft ?? 9999);

  const active = (p: Project) => p.status === 'confirmed' || p.status === 'in-progress';

  const deliveredThisMonth = projects
    .filter((p) => p.status === 'completed' && isThisMonth(p.completedAt))
    .sort(sortByUrgency);
  const waitConfirm = projects.filter((p) => p.status === 'draft');
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
  const veryLate = allActive.filter((p) => getTimelineInfo(p.deliverDate)?.isOverdue);
  const almostLate = allActive.filter((p) => {
    const tl = getTimelineInfo(p.deliverDate);
    return tl && !tl.isOverdue && tl.daysLeft <= 2;
  });

  const hasAny = deliveredThisMonth.length > 0 || waitConfirm.length > 0 || allActive.length > 0;
  if (!hasAny) return `📊 PROJECT UPDATE — ${dateStr}\n\nNo active projects.`;

  const ln: string[] = [];

  ln.push(`📊 PROJECT UPDATE — ${dateStr}`);
  ln.push('');

  const summary = [
    { emoji: '✅', label: 'Delivered this month', count: deliveredThisMonth.length },
    { emoji: '⬜', label: 'Unconfirmed', count: waitConfirm.length },
    { emoji: '🎬', label: 'Await Filming', count: awaitFilming.length },
    { emoji: '✂️', label: 'Await Rough Cut', count: awaitRoughCut.length },
    { emoji: '📝', label: 'Await Draft/VO', count: awaitDraft.length },
    { emoji: '🎯', label: 'Await Master', count: awaitMaster.length },
    { emoji: '🏁', label: 'Await Mark as Completed', count: awaitDeliver.length },
  ].filter((r) => r.count > 0);
  for (const r of summary) ln.push(`${r.emoji} ${r.count}  ${r.label}`);

  ln.push('');
  ln.push(DIV);

  if (deliveredThisMonth.length > 0) {
    ln.push('');
    ln.push(`✅  Delivered this month (${deliveredThisMonth.length})`);
    for (const p of deliveredThisMonth) ln.push(`     — ${p.name}`);
  }

  if (waitConfirm.length > 0) {
    ln.push('');
    ln.push(`⬜  Wait Project Confirm (${waitConfirm.length})`);
    for (const p of waitConfirm) ln.push(`     — ${p.name}`);
  }

  const phaseSections = [
    { emoji: '🎬', label: 'Await Filming', list: awaitFilming },
    { emoji: '✂️', label: 'Await Rough Cut', list: awaitRoughCut },
    { emoji: '📝', label: 'Await Draft/VO', list: awaitDraft },
    { emoji: '🎯', label: 'Await Master', list: awaitMaster },
    { emoji: '🏁', label: 'Await Mark as Completed', list: awaitDeliver },
  ].filter((s) => s.list.length > 0);

  for (let i = 0; i < phaseSections.length; i++) {
    const { emoji, label, list } = phaseSections[i];
    ln.push('');
    ln.push(`${emoji}  ${label} (${list.length})`);
    for (const p of list) ln.push(`     ${oneLiner(p)}`);
    if (label === 'Await Master' && i < phaseSections.length - 1) {
      ln.push('');
      ln.push(DIV_LIGHT);
    }
  }

  if (veryLate.length > 0 || almostLate.length > 0) {
    ln.push('');
    if (veryLate.length > 0)
      ln.push(`🔴  Very late: ${veryLate.length} project${veryLate.length > 1 ? 's' : ''}`);
    if (almostLate.length > 0)
      ln.push(
        `🟠  Almost late (≤2d): ${almostLate.length} project${almostLate.length > 1 ? 's' : ''}`
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

    const text = buildSummaryMessage(projects);
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
