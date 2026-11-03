import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { PaymentInfo } from '@/src/types';

const A4_W_MM = 210;
const A4_H_MM = 297;

/**
 * Renders an A4 sheet element off-screen, rasterises it with html2canvas and
 * returns a PDF blob. Content taller than one A4 page is split across pages.
 */
export async function sheetToPdfBlob(sheet: ReactElement, scale: number): Promise<Blob> {
  const [html2canvas, { default: jsPDF }] = await Promise.all([
    import('html2canvas').then((m) => m.default),
    import('jspdf'),
  ]);

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;';
  document.body.appendChild(container);
  const root = createRoot(container);

  try {
    await new Promise<void>((resolve) => {
      root.render(sheet);
      setTimeout(resolve, 900);
    });

    const sheetEl = container.firstElementChild as HTMLElement;
    const canvas = await html2canvas(sheetEl, {
      useCORS: true,
      scale,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const imgH = (canvas.height / canvas.width) * A4_W_MM;
    const img = canvas.toDataURL('image/png', 1.0);
    const pages = Math.max(1, Math.ceil(imgH / A4_H_MM - 0.01));
    for (let i = 0; i < pages; i++) {
      if (i > 0) pdf.addPage();
      pdf.addImage(img, 'PNG', 0, -i * A4_H_MM, A4_W_MM, imgH);
    }
    return pdf.output('blob');
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}

/** Where quotations go on Telegram: the quote chat/topic, falling back to the invoice chat. */
export function quoteTelegramTarget(payment: PaymentInfo | null | undefined) {
  const token = payment?.telegramBotToken?.trim() ?? '';
  const quoteChat = payment?.telegramQuoteChatId?.trim() ?? '';
  const chatId = quoteChat || payment?.telegramChatId?.trim() || '';
  const topicId =
    payment?.telegramQuoteTopicId?.trim() ||
    (quoteChat ? '' : payment?.telegramTopicId?.trim()) ||
    '';
  return { token, chatId, topicId };
}

export async function sendTelegramDocument(opts: {
  token: string;
  chatId: string;
  topicId?: string;
  blob: Blob;
  filename: string;
  caption: string;
}): Promise<void> {
  const formData = new FormData();
  formData.append('chat_id', opts.chatId);
  formData.append('document', opts.blob, opts.filename);
  formData.append('caption', opts.caption);
  formData.append('parse_mode', 'Markdown');
  if (opts.topicId) formData.append('message_thread_id', opts.topicId);

  const res = await fetch(`https://api.telegram.org/bot${opts.token}/sendDocument`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    let description = res.statusText;
    try {
      const err = await res.json();
      description = err.description ?? description;
    } catch {}
    throw new Error(`Telegram error: ${description}`);
  }
}
