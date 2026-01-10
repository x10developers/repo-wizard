// const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
// const ENABLED = process.env.TELEGRAM_CHANNEL_NOTIFICATIONS === "true";

// export async function sendChannelMessage(text) {
//   if (!ENABLED || !BOT_TOKEN || !CHANNEL_ID) {
//     console.warn("[Telegram Channel] Skipped (disabled or missing config)");
//     return;
//   }

//   try {
//     const res = await fetch(
//       `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
//       {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           chat_id: CHANNEL_ID,
//           text,
//           parse_mode: "Markdown",
//           disable_web_page_preview: true,
//         }),
//       }
//     );

//     if (!res.ok) {
//       console.error("[Telegram Channel]", await res.text());
//     }
//   } catch (err) {
//     console.error("[Telegram Channel]", err.message);
//   }
// }


//Claude

export async function sendChannelMessage(text) {
  // Load fresh from env each time
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
  const ENABLED = process.env.TELEGRAM_CHANNEL_NOTIFICATIONS === "true";

  console.log("[Telegram Channel] Config:", {
    ENABLED,
    hasBotToken: !!BOT_TOKEN,
    hasChannelId: !!CHANNEL_ID,
    channelId: CHANNEL_ID
  });

  if (!ENABLED) {
    console.warn("[Telegram Channel] Skipped - TELEGRAM_CHANNEL_NOTIFICATIONS is not 'true'");
    console.warn("[Telegram Channel] Current value:", process.env.TELEGRAM_CHANNEL_NOTIFICATIONS);
    return;
  }

  if (!BOT_TOKEN) {
    console.error("[Telegram Channel] Skipped - TELEGRAM_BOT_TOKEN is missing");
    return;
  }

  if (!CHANNEL_ID) {
    console.error("[Telegram Channel] Skipped - TELEGRAM_CHANNEL_ID is missing");
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

    const data = await res.json();

    if (!res.ok) {
      console.error("[Telegram Channel] API Error:", data);
    } else {
      console.log("[Telegram Channel] Message sent successfully");
    }
  } catch (err) {
    console.error("[Telegram Channel] Error:", err.message);
  }
}