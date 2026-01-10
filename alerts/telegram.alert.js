/**
 * File: telegram.alert.js
 *
 * Purpose:
 * - Sends critical alerts to Telegram.
 *
 * Notes:
 * - Uses built-in fetch (Node.js 18+)
 * - Never throws errors (alerts must not crash the app)
 * - Safe for production use
 */

export async function sendTelegramAlert(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn("[Alert] Telegram credentials are missing");
    return;
  }

  const url = https://api.telegram.org/bot${token}/sendMessage;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000); // 8s safety timeout

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      console.error("[Alert] Telegram API error:", data);
    }
  } catch (err) {
    if (err.name === "AbortError") {
      console.error("[Alert] Telegram request timed out");
    } else {
      console.error("[Alert] Telegram alert failed:", err.message);
    }
  } finally {
    clearTimeout(timeout);
  }
}