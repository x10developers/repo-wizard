/**
 * File: alerts/telegram.channel.js
 *
 * Purpose:
 * - Send broadcast-style updates to a Telegram channel
 * - Used by scheduler, webhook handlers, and system events
 */

const fetch = require("node-fetch");

const BOT_TOKEN = process.env.TG_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const ENABLED = process.env.TELEGRAM_CHANNEL_NOTIFICATIONS === "true";

if (!BOT_TOKEN) {
  console.warn("[Telegram Channel] TG_BOT_TOKEN not set");
}

if (!CHANNEL_ID) {
  console.warn("[Telegram Channel] TELEGRAM_CHANNEL_ID not set");
}

/**
 * Send a message to Telegram channel
 */
async function sendChannelMessage(text, options = {}) {
  if (!ENABLED) return;
  if (!BOT_TOKEN || !CHANNEL_ID) return;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHANNEL_ID,
          text,
          parse_mode: options.parseMode || "Markdown",
          disable_web_page_preview: true,
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("[Telegram Channel] Failed:", err);
    }
  } catch (error) {
    console.error("[Telegram Channel] Error:", error.message);
  }
}

module.exports = {
  sendChannelMessage,
};
