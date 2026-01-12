/**
 * File: alerts/telegram.group.js
 *
 * Purpose:
 * - Send scheduled messages to Telegram group
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROUP_ID = process.env.TELEGRAM_GROUP_ID;
const ENABLED = process.env.TELEGRAM_GROUP_NOTIFICATIONS === "true";

export async function sendGroupMessage(text) {
  if (!ENABLED || !BOT_TOKEN || !GROUP_ID) return;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: GROUP_ID,
          text,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      }
    );

    if (!res.ok) {
      console.error("[Telegram Group]", await res.text());
    }
  } catch (err) {
    console.error("[Telegram Group]", err.message);
  }
}
