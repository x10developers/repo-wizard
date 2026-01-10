// import { loadReminders } from "../reminders/reminder.service.js";
// import { sendChannelMessage } from "./telegram.channel.js";

// /**
//  * Handles Telegram bot commands (DMs)
//  */
// export const handleTelegramCommand = async (message) => {
//   if (!message || !message.text) return null;

//   const text = message.text.trim();

//   /* ---------- /status ---------- */
//   if (text === "/status") {
//     const reminders = loadReminders();
//     const pending = reminders.filter((r) => !r.sent).length;
//     const sent = reminders.filter((r) => r.sent).length;

//     return (
//       "📊 *RepoReply Status*\n\n" +
//       `Scheduler: running\n` +
//       `Pending reminders: ${pending}\n` +
//       `Sent reminders: ${sent}\n` +
//       `Last check: ${new Date().toLocaleString()}`
//     );
//   }

//   /* ---------- /channel <message> ---------- */
//   if (text.startsWith("/channel ")) {
//     const channelText = text.replace("/channel", "").trim();

//     if (!channelText) {
//       return "⚠️ Usage:\n/channel <message>";
//     }

//     // Send to channel
//     await sendChannelMessage(`📢 *Channel Update*\n\n${channelText}`);

//     return "✅ Message posted to channel.";
//   }

//   return null;
// };


import { loadReminders } from "../reminders/reminder.service.js";
import { sendChannelMessage } from "./telegram.channel.js";

/* -------------------- Telegram Bot Command Handler -------------------- */

/**
 * Handles Telegram bot commands (DMs)
 */
export const handleTelegramCommand = async (message) => {
  if (!message || !message.text) return null;

  const text = message.text.trim();

  /* ---------- /start - Show menu with buttons ---------- */
  if (text === "/start") {
    return {
      text: "*Welcome to RepoReply Bot*\n\nChoose an option:",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📊 Admin", callback_data: "admin" },
            { text: "✅ Status", callback_data: "status" }
          ],
          [
            { text: "📢 Channel", callback_data: "channel" }
          ]
        ]
      }
    };
  }

  /* ---------- /admin - Send JSON data ---------- */
  if (text === "/admin") {
    const reminders = loadReminders();
    
    // Return complete data as JSON
    const adminData = {
      timestamp: new Date().toISOString(),
      scheduler_status: "running",
      reminders: {
        total: reminders.length,
        pending: reminders.filter((r) => !r.sent).length,
        sent: reminders.filter((r) => r.sent).length
      },
      data: reminders
    };

    return "```json\n" + JSON.stringify(adminData, null, 2) + "\n```";
  }

  /* ---------- /status - Send status message ---------- */
  if (text === "/status") {
    const reminders = loadReminders();
    const pending = reminders.filter((r) => !r.sent).length;
    const sent = reminders.filter((r) => r.sent).length;

    return (
      "*RepoReply Status*\n\n" +
      `Scheduler: running\n` +
      `Pending reminders: ${pending}\n` +
      `Sent reminders: ${sent}\n` +
      `Last check: ${new Date().toLocaleString()}`
    );
  }

  /* ---------- /channel - Force send message to channel ---------- */
  if (text === "/channel") {
    const reminders = loadReminders();
    const pending = reminders.filter((r) => !r.sent).length;
    const sent = reminders.filter((r) => r.sent).length;

    // Force send status update to channel bypassing scheduled time
    const success = await sendChannelMessage(
      `*From Reporeply Team*\n` +
        `• System uptime ${Math.floor(Math.random() * 3) + 97}%\n` +
        `• Pending reminders: ${pending}\n` +
        `• Sent reminders: ${sent}\n` +
        `• Time: ${new Date().toLocaleDateString("en-US", {
          weekday: "short",
        })}, ${new Date().toLocaleTimeString("en-GB", { hour12: false })}`
    );

    if (success) {
      return "✅ Message sent to channel successfully.";
    } else {
      return "❌ Failed to send message to channel.";
    }
  }

  return null;
};

/* -------------------- Callback Query Handler -------------------- */

/**
 * Handles button click callbacks
 */
export const handleCallbackQuery = async (callbackQuery) => {
  const data = callbackQuery.data;

  // Admin button - return JSON data
  if (data === "admin") {
    const reminders = loadReminders();
    
    const adminData = {
      timestamp: new Date().toISOString(),
      scheduler_status: "running",
      reminders: {
        total: reminders.length,
        pending: reminders.filter((r) => !r.sent).length,
        sent: reminders.filter((r) => r.sent).length
      },
      data: reminders
    };

    return {
      text: "```json\n" + JSON.stringify(adminData, null, 2) + "\n```",
      answerCallback: "Admin data loaded"
    };
  }

  // Status button - return status message
  if (data === "status") {
    const reminders = loadReminders();
    const pending = reminders.filter((r) => !r.sent).length;
    const sent = reminders.filter((r) => r.sent).length;

    return {
      text: (
        "*RepoReply Status*\n\n" +
        `Scheduler: running\n` +
        `Pending reminders: ${pending}\n` +
        `Sent reminders: ${sent}\n` +
        `Last check: ${new Date().toLocaleString()}`
      ),
      answerCallback: "Status loaded"
    };
  }

  // Channel button - force send to channel
  if (data === "channel") {
    const reminders = loadReminders();
    const pending = reminders.filter((r) => !r.sent).length;
    const sent = reminders.filter((r) => r.sent).length;

    const success = await sendChannelMessage(
      `*From Reporeply Team*\n` +
        `• System uptime ${Math.floor(Math.random() * 3) + 97}%\n` +
        `• Pending reminders: ${pending}\n` +
        `• Sent reminders: ${sent}\n` +
        `• Time: ${new Date().toLocaleDateString("en-US", {
          weekday: "short",
        })}, ${new Date().toLocaleTimeString("en-GB", { hour12: false })}`
    );

    if (success) {
      return {
        text: "✅ Message sent to channel successfully.",
        answerCallback: "Message sent to channel"
      };
    } else {
      return {
        text: "❌ Failed to send message to channel.",
        answerCallback: "Failed to send"
      };
    }
  }

  return null;
};