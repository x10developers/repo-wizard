/**
 * File: alerts/telegram.channel.js
 *
 * Purpose:
 * - Sends broadcast messages to a Telegram channel
 *
 * Notes:
 * - Uses native fetch (Node 18+)
 * - Controlled via TELEGRAM_CHANNEL_NOTIFICATIONS
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const ENABLED = process.env.TELEGRAM_CHANNEL_NOTIFICATIONS === "true";

export async function sendChannelMessage(text) {
  // Guard rails (no silent failure)
  if (!ENABLED) {
    console.log("[Telegram Channel] Skipped (notifications disabled)");
    return;
  }

  if (!BOT_TOKEN || !CHANNEL_ID) {
    console.warn(
      "[Telegram Channel] Missing config",
      { BOT_TOKEN: !!BOT_TOKEN, CHANNEL_ID }
    );
    return;
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHANNEL_ID,
          text,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      }
    );

    if (!res.ok) {
      console.error(
        "[Telegram Channel] Send failed:",
        await res.text()
      );
    }
  } catch (err) {
    console.error("[Telegram Channel] Error:", err.message);
  }
}
