// config/telegram-webhooks.js

import { admin, findId } from "../connectors/telegram/index.js";

export function setupTelegramWebhooks(app) {
  /* -------------------- Admin Bot Webhook -------------------- */
  app.post("/webhook/admin-bot", async (req, res) => {
    try {
      const { message, callback_query } = req.body;

      // Handle callback queries (button presses)
      if (callback_query) {
        const response = await admin.handleCallback(callback_query);

        if (response) {
          // Answer the callback query
          await answerCallbackQuery(
            callback_query.id,
            response.answer,
            response.alert
          );

          // Send the response message if any
          if (response.message) {
            await admin.sendMessage(
              callback_query.message.chat.id,
              response.message
            );
          }
        }

        res.sendStatus(200);
        return;
      }

      // Handle regular messages
      if (message) {
        const response = await admin.handleCommand(message);

        if (response) {
          // Check if response is an object with reply_markup (for inline keyboards)
          if (typeof response === "object" && response.text) {
            await admin.sendMessage(
              message.chat.id,
              response.text,
              response.reply_markup
            );
          } else {
            // Simple text response
            await admin.sendMessage(message.chat.id, response);
          }
        }
      }

      res.sendStatus(200);
    } catch (err) {
      console.error("[Admin Bot Webhook] Error:", err.message);
      res.sendStatus(200); // Always return 200 to Telegram
    }
  });

  /* -------------------- Find ID Bot Webhook -------------------- */
  app.post("/webhook/findid-bot", async (req, res) => {
    try {
      const { message } = req.body;

      if (message) {
        const response = await findId.handleCommand(message);

        if (response) {
          await findId.sendMessage(message.chat.id, response);
        }
      }

      res.sendStatus(200);
    } catch (err) {
      console.error("[Find ID Bot Webhook] Error:", err.message);
      res.sendStatus(200); // Always return 200 to Telegram
    }
  });

  /* -------------------- Webhook Setup Endpoint (run once) -------------------- */
  app.post("/admin/setup-webhooks", async (req, res) => {
    try {
      const baseUrl = process.env.BASE_URL || "https://your-domain.com";
      const results = [];

      // Setup Admin Bot webhook
      if (process.env.ADMIN_BOT_TOKEN) {
        const adminWebhook = await fetch(
          `https://api.telegram.org/bot${process.env.ADMIN_BOT_TOKEN}/setWebhook`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: `${baseUrl}/webhook/admin-bot`,
            }),
          }
        );
        const adminData = await adminWebhook.json();
        results.push({
          bot: "Admin Bot",
          success: adminData.ok,
          data: adminData,
        });
      }

      // Setup Find ID Bot webhook
      if (process.env.FINDID_BOT_TOKEN) {
        const findIdWebhook = await fetch(
          `https://api.telegram.org/bot${process.env.FINDID_BOT_TOKEN}/setWebhook`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: `${baseUrl}/webhook/findid-bot`,
            }),
          }
        );
        const findIdData = await findIdWebhook.json();
        results.push({
          bot: "Find ID Bot",
          success: findIdData.ok,
          data: findIdData,
        });
      }

      res.json({
        message: "Webhooks setup completed",
        results,
      });
    } catch (err) {
      console.error("[Webhook Setup] Error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  console.log("[Routes] Telegram webhook routes configured");
}

/* -------------------- Helper Functions -------------------- */

async function answerCallbackQuery(callbackQueryId, text, showAlert = false) {
  const BOT_TOKEN = process.env.ADMIN_BOT_TOKEN;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: text,
          show_alert: showAlert || false,
        }),
      }
    );

    return await res.json();
  } catch (err) {
    console.error("[Callback Answer] Error:", err.message);
  }
}
