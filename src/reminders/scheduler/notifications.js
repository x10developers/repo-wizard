/**
 * scheduler/notifications.js
 *
 * Purpose: Notification handlers for Telegram and Email
 * Includes circuit breaker protection and timeout handling
 */

import { CONFIG } from "./config.js";
import {
  checkCircuitBreaker,
  recordSuccess,
  recordFailure,
} from "./circuit-breaker.js";

/* -------------------- Telegram Notification -------------------- */
export async function notifyTelegram(text) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    return;
  }

  try {
    /* -------------------- Circuit Breaker Check -------------------- */
    checkCircuitBreaker("telegram");

    /* -------------------- Send Telegram Message -------------------- */
    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: text.substring(0, 4096),
        parse_mode: "Markdown",
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.status}`);
    }

    recordSuccess("telegram");
  } catch (err) {
    /* -------------------- Error Handling -------------------- */
    recordFailure("telegram");
    console.error("[Telegram] Notification failed:", err.message);
  }
}

/* -------------------- Email Notification (Placeholder) -------------------- */
export async function notifyEmail(text) {
  // TODO: Implement email notifications
}
