// Thin wrapper around the Google Generative AI SDK (gemini-1.5-flash).
//
// Design decisions:
//   - Single exported function callGemini(prompt) keeps the surface minimal
//   - API key is read from env.geminiApiKey at call time (not at module load)
//     so tests can mock this module without needing a real key
//   - A configurable timeout (default 15 s) prevents hanging requests
//   - When the key is absent the function throws a clear error rather than
//     crashing with an SDK internal message
//   - Safety settings are left at SDK defaults (BLOCK_MEDIUM_AND_ABOVE) — no
//     need to loosen them for clinical text summarisation

import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env.js';
import ApiError from '../utils/ApiError.js';

const MODEL_NAME     = 'gemini-1.5-flash';
const TIMEOUT_MS     = 15_000; // 15 seconds

/**
 * Send a text prompt to Gemini and return the generated text.
 *
 * @param {string} prompt  The full prompt string to send.
 * @returns {Promise<string>} The model's text response.
 * @throws {ApiError} 503 if the API key is missing or the request fails/times out.
 */
export const callGemini = async (prompt) => {
  if (!env.geminiApiKey) {
    throw ApiError.serviceUnavailable(
      'Gemini API key is not configured. Set GEMINI_API_KEY in .env.'
    );
  }

  const genAI = new GoogleGenerativeAI(env.geminiApiKey);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  // Race the SDK call against a timeout so a slow/hung API response
  // doesn't block the server indefinitely.
  const apiCall = model.generateContent(prompt);
  const timeout = new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error(`Gemini API timed out after ${TIMEOUT_MS / 1000}s`)),
      TIMEOUT_MS
    )
  );

  let result;
  try {
    result = await Promise.race([apiCall, timeout]);
  } catch (err) {
    throw ApiError.serviceUnavailable(
      `Gemini API request failed: ${err.message ?? 'Unknown error'}`
    );
  }

  const text = result?.response?.text?.();
  if (!text) {
    throw ApiError.serviceUnavailable(
      'Gemini API returned an empty response.'
    );
  }

  return text.trim();
};
