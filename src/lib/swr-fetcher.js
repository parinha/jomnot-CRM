/**
 * Centralized SWR fetcher using native Fetch.
 * Throws ApiError on any non-2xx response so SWR exposes it via `error`.
 */

export class ApiError extends Error {
  /** @param {string} message @param {number} status */
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * @param {string} url
 * @returns {Promise<unknown>}
 */
export async function fetcher(url) {
  const res = await fetch(url);

  if (!res.ok) {
    let message;
    try {
      const body = await res.json();
      message = body?.error ?? res.statusText;
    } catch {
      message = res.statusText;
    }
    throw new ApiError(message || `HTTP ${res.status}`, res.status);
  }

  return res.json();
}
