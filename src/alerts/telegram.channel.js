/* -------------------- Telegram Channel Messaging -------------------- */

/**
 * Sends a message to the Telegram channel
 * @param {string} text - The message text to send (supports Markdown formatting)
 * @returns {Promise<boolean>} - Returns true if message sent successfully
 */
export async function sendChannelMessage(text) {
  // Load environment variables
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
  const ENABLED = process.env.TELEGRAM_CHANNEL_NOTIFICATIONS === "true";

  // Validate configuration - return false if any required value is missing
  if (!ENABLED || !BOT_TOKEN || !CHANNEL_ID) {
    return false;
  }

  try {
    // Send message to Telegram Bot API
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

    const data = await res.json();

    // Check if message was sent successfully
    if (!res.ok) {
      console.error("[Telegram Channel] API Error:", data);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[Telegram Channel] Error:", err.message);
    return false;
  }
}