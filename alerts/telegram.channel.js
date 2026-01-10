const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const ENABLED = process.env.TELEGRAM_CHANNEL_NOTIFICATIONS === "true";

export async function sendChannelMessage(text) {
  if (!ENABLED || !BOT_TOKEN || !CHANNEL_ID) return;

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
      console.error("[Telegram Channel]", await res.text());
    }
  } catch (err) {
    console.error("[Telegram Channel]", err.message);
  }
}
