/**
 * Simple in-memory rate limiter to space out API requests.
 * Ensures a minimum gap between consecutive calls to avoid hitting quota.
 */
const rateLimiter = {
  lastRequestTime: 0,
  minInterval: 2000, // 2 seconds minimum between requests
  quotaExhaustedUntil: 0, // timestamp until which we should wait

  async waitForSlot() {
    const now = Date.now();

    // If quota was exhausted, wait until the cooldown expires
    if (this.quotaExhaustedUntil > now) {
      const waitMs = this.quotaExhaustedUntil - now;
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }

    // Ensure minimum interval between requests
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < this.minInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minInterval - elapsed));
    }

    this.lastRequestTime = Date.now();
  },

  setQuotaCooldown(seconds) {
    this.quotaExhaustedUntil = Date.now() + (seconds * 1000);
  }
};

/**
 * Parse the retry-after duration from a 429 error response.
 * Attempts to extract seconds from the error message or uses a default.
 * @param {string} responseText - The raw response text.
 * @returns {number} - Seconds to wait before retrying.
 */
function parseRetryAfter(responseText) {
  try {
    const data = JSON.parse(responseText);
    const message = data?.error?.message || '';
    // Match patterns like "retry in 40.124893078s" or "retry after 40s"
    const match = message.match(/retry\s+(?:in|after)\s+([\d.]+)s/i);
    if (match) {
      return Math.ceil(parseFloat(match[1]));
    }

    // Check for Retry-After in quota violations
    const violations = data?.error?.details?.find(d => d['@type']?.includes('QuotaFailure'));
    if (violations) {
      return 60; // Default 60s for quota exhaustion
    }
  } catch (e) {
    // Ignore parse errors
  }
  return 45; // Default wait time
}

/**
 * Call the Gemini API with automatic retry, exponential backoff, and quota-aware rate limiting.
 * @param {object} payload - The request payload for Gemini API.
 * @param {string} apiKey - The Gemini API key.
 * @param {string} model - The model to use.
 * @param {function} [onRetry] - Optional callback when a retry is happening: (retryInfo) => void
 * @returns {string} - The text response from Gemini.
 */
export async function callGemini(payload, apiKey, model = 'gemini-2.5-flash', onRetry = null) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const maxRetries = 3; // Reduced from 5 to conserve quota
  const baseDelays = [2000, 5000, 15000];
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Wait for rate limiter slot
      await rateLimiter.waitForSlot();

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();

      // Handle 429 (Rate Limited / Quota Exceeded) specifically
      if (response.status === 429) {
        const retryAfterSec = parseRetryAfter(responseText);
        rateLimiter.setQuotaCooldown(retryAfterSec);

        // Check if this is a daily quota (not just rate limit)
        const isDailyQuota = responseText.includes('PerDay') || responseText.includes('free_tier');

        if (isDailyQuota) {
          throw new QuotaExhaustedError(
            `⚠️ 已達到免費方案每日配額上限（${model}）。\n` +
            `建議方案：\n` +
            `1. 等待約 ${retryAfterSec} 秒後重試\n` +
            `2. 切換到其他模型（如 Gemini 2.0 Flash）\n` +
            `3. 升級為付費方案以解除限制`,
            retryAfterSec
          );
        }

        // For transient rate limits, retry after waiting
        if (attempt < maxRetries) {
          const waitMs = retryAfterSec * 1000;
          if (onRetry) {
            onRetry({
              attempt: attempt + 1,
              maxRetries,
              waitSeconds: retryAfterSec,
              reason: 'rate_limit'
            });
          }
          await new Promise(resolve => setTimeout(resolve, waitMs));
          continue;
        }

        throw new QuotaExhaustedError(
          `API 請求頻率過高，已重試 ${maxRetries} 次仍失敗。請稍後再試。`,
          retryAfterSec
        );
      }

      if (!response.ok) {
        throw new Error(`API 錯誤 (${response.status}): ${responseText}`);
      }

      if (!responseText) {
        throw new Error("API 回傳了空資料");
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`API 解析失敗: ${response.status} - ${responseText.substring(0, 100)}`);
      }

      if (result.error) throw new Error(result.error.message);
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("AI 回傳了空白內容");
      return text;
    } catch (error) {
      // Don't retry QuotaExhaustedError (daily quota)
      if (error instanceof QuotaExhaustedError) {
        throw error;
      }

      lastError = error;
      if (attempt < maxRetries) {
        const delay = baseDelays[attempt] || baseDelays[baseDelays.length - 1];
        if (onRetry) {
          onRetry({
            attempt: attempt + 1,
            maxRetries,
            waitSeconds: Math.round(delay / 1000),
            reason: 'error'
          });
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw new Error(lastError ? lastError.message : "未知的連線錯誤");
}

/**
 * Custom error class for quota exhaustion.
 */
export class QuotaExhaustedError extends Error {
  constructor(message, retryAfterSeconds) {
    super(message);
    this.name = 'QuotaExhaustedError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Parse potentially markdown-wrapped JSON from AI response.
 * @param {string} text - Raw text from AI.
 * @returns {object} - Parsed JSON object.
 */
export function parseAIJson(text) {
  let cleanText = text.trim();
  if (cleanText.startsWith("```json")) {
    cleanText = cleanText.substring(7);
  } else if (cleanText.startsWith("```")) {
    cleanText = cleanText.substring(3);
  }
  if (cleanText.endsWith("```")) {
    cleanText = cleanText.substring(0, cleanText.length - 3);
  }
  cleanText = cleanText.trim();
  return JSON.parse(cleanText);
}

/**
 * Validate an API key by checking format only (no API call).
 * This avoids wasting quota on validation requests.
 * @param {string} apiKey - The Gemini API key to validate.
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function validateApiKey(apiKey, model = 'gemini-2.5-flash') {
  if (!apiKey || apiKey.trim().length < 10) {
    return { valid: false, error: '金鑰格式不正確' };
  }

  // Gemini API keys typically start with "AIza" and are ~39 characters
  const trimmed = apiKey.trim();
  if (trimmed.startsWith('AIza') && trimmed.length >= 35 && trimmed.length <= 50) {
    return { valid: true };
  }

  // If format doesn't match typical pattern, still allow but mark as uncertain
  if (trimmed.length >= 20) {
    return { valid: true };
  }

  return { valid: false, error: '金鑰格式不正確，請確認是否完整貼上' };
}
