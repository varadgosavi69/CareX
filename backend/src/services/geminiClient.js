// Thin wrapper around the new Google Gen AI SDK (@google/genai).
//
// The old @google/generative-ai package is deprecated as of mid-2025.
// This uses the new unified SDK which supports AQ. auth keys issued by
// Google AI Studio (replacing the legacy AIzaSy format).
//
// Model: gemini-2.0-flash (current stable flash model for AQ. keys)
//
// Design:
//   - Single exported callGemini(prompt) keeps the surface minimal
//   - API key read from env at call time so tests can mock without a real key
//   - 20 s timeout prevents hung requests from blocking the server
//   - 1 retry on 429 (rate-limit) with a 2 s back-off
//   - Clear ApiError(503) on any failure so the error handler renders it cleanly

import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import ApiError from '../utils/ApiError.js';

const MODEL_NAME  = 'gemini-2.0-flash';
const TIMEOUT_MS  = 20_000;
const RETRY_DELAY = 2_000; // ms to wait before a single quota-error retry

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Send a text prompt to Gemini and return the generated text string.
 *
 * @param {string} prompt
 * @returns {Promise<string>}
 * @throws {ApiError} 503 if key is missing, request fails, or times out.
 */
export const callGemini = async (prompt) => {
  if (!env.geminiApiKey) {
    throw ApiError.serviceUnavailable(
      'Gemini API key is not configured. Set GEMINI_API_KEY in .env.'
    );
  }

  const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });

  const attempt = () =>
    Promise.race([
      ai.models.generateContent({ model: MODEL_NAME, contents: prompt }),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Gemini API timed out after ${TIMEOUT_MS / 1000}s`)),
          TIMEOUT_MS
        )
      ),
    ]);

  let result;
  try {
    result = await attempt();
  } catch (err) {
    // Single retry on quota / rate-limit (429)
    if (err?.message?.includes('429') || err?.message?.includes('quota')) {
      await sleep(RETRY_DELAY);
      try {
        result = await attempt();
      } catch (retryErr) {
        throw ApiError.serviceUnavailable(
          `Gemini API request failed: ${retryErr.message ?? 'Unknown error'}`
        );
      }
    } else {
      throw ApiError.serviceUnavailable(
        `Gemini API request failed: ${err.message ?? 'Unknown error'}`
      );
    }
  }

  // New SDK: response text is at result.text (string)
  const text = result?.text;
  if (!text || String(text).trim().length === 0) {
    throw ApiError.serviceUnavailable('Gemini API returned an empty response.');
  }

  return String(text).trim();
};
