class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function useSendProjectsTelegram() {
  async function sendAll(): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch('/api/telegram/send-all', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError(body.error ?? 'Failed to send Telegram message', res.status);
      }
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { ok: false, error: message };
    }
  }

  return { sendAll };
}
