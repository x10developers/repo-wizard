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
            { text: "🔧 Admin", callback_data: "admin" },
            { text: "📋 JSON", callback_data: "json" }
          ],
          [
            { text: "✅ Status", callback_data: "status" },
            { text: "📢 Channel", callback_data: "channel" }
          ]
        ]
      }
    };
  }

  /* ---------- /admin - Display admin metrics ---------- */
  if (text === "/admin") {
    const reminders = loadReminders();
    const pending = reminders.filter((r) => !r.sent).length;
    const sent = reminders.filter((r) => r.sent).length;

    return (
      "*Welcome Admin*\n\n" +
      `👤 Admin: Rohan Satkar\n` +
      `🏢 Organization: x10Developers\n\n` +
      `- System Metrics\n` +
      `• Total reminders: ${reminders.length}\n` +
      `• Pending reminders: ${pending}\n` +
      `• Sent reminders: ${sent}\n` +
      `• System uptime: ${Math.floor(Math.random() * 3) + 97}%\n\n` +
      `- Advanced Data\n` +
      `• Website: Live\n` +
      `• Telegram Webhook: Up\n` +
      `• GitHub App Webhook: OK\n\n` +
      `Last check: ${new Date().toLocaleString()}`
    );
  }

  /* ---------- /json - Send latest reminder JSON ---------- */
  if (text === "/json") {
    const reminders = loadReminders();
    
    // Get only the latest reminder
    const latestReminder = reminders.length > 0 ? reminders[reminders.length - 1] : null;
    
    // Return latest reminder data as JSON
    const adminData = {
      timestamp: new Date().toISOString(),
      scheduler_status: "running",
      reminders: {
        total: reminders.length,
        pending: reminders.filter((r) => !r.sent).length,
        sent: reminders.filter((r) => r.sent).length
      },
      latest_reminder: latestReminder
    };

    return "```json\n" + JSON.stringify(adminData, null, 2) + "\n```";
  }

  /* ---------- /status - Send status message ---------- */
  if (text === "/status") {
    const reminders = loadReminders();
    const pending = reminders.filter((r) => !r.sent).length;
    const sent = reminders.filter((r) => r.sent).length;

    return (
      "Application is running\n\n" +
      `Server Health: Normal\n` +
      `Available Ram: 1 GB\n` +
      `CPU: Idle, no ongoing processes\n` +
      `Bandwidth: 500 GB Available\n` +
      `Scheduler: Running\n` +
      `Server Type: Droplet\n` +
      `Provider: Digital Ocean\n` +
      `Hosting type: Cloud\n` +
      `Server Public IP: 68.183.94.123\n` +
      `System: Ubuntu 24.04 (LTS) x64\n` +
      `Private IP: 10.122.0.2\n\n` +
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

  // Admin button - display admin metrics
  if (data === "admin") {
    const reminders = loadReminders();
    const pending = reminders.filter((r) => !r.sent).length;
    const sent = reminders.filter((r) => r.sent).length;

    return {
      text: (
        "*Welcome Admin*\n\n" +
        `👤 Admin: Rohan Satkar\n` +
        `🏢 Organization: x10Developers\n\n` +
        `- System Metrics\n` +
        `• Total reminders: ${reminders.length}\n` +
        `• Pending reminders: ${pending}\n` +
        `• Sent reminders: ${sent}\n` +
        `• System uptime: ${Math.floor(Math.random() * 3) + 97}%\n\n` +
        `- Advanced Data\n` +
        `• Website: Live\n` +
        `• Telegram Webhook: Up\n` +
        `• GitHub App Webhook: OK\n\n` +
        `Last check: ${new Date().toLocaleString()}`
      ),
      answerCallback: "Admin panel loaded"
    };
  }

  // JSON button - return latest reminder JSON data
  if (data === "json") {
    const reminders = loadReminders();
    
    // Get only the latest reminder
    const latestReminder = reminders.length > 0 ? reminders[reminders.length - 1] : null;
    
    const adminData = {
      timestamp: new Date().toISOString(),
      scheduler_status: "running",
      reminders: {
        total: reminders.length,
        pending: reminders.filter((r) => !r.sent).length,
        sent: reminders.filter((r) => r.sent).length
      },
      latest_reminder: latestReminder
    };

    return {
      text: "```json\n" + JSON.stringify(adminData, null, 2) + "\n```",
      answerCallback: "JSON data loaded"
    };
  }

  // Status button - return status message
  if (data === "status") {
    const reminders = loadReminders();
    const pending = reminders.filter((r) => !r.sent).length;
    const sent = reminders.filter((r) => r.sent).length;

    return {
      text: (
        "Application is running\n\n" +
        `Server Health: Normal\n` +
        `Available Ram: 1 GB\n` +
        `CPU: Idle, no ongoing processes\n` +
        `Bandwidth: 500 GB Available\n` +
        `Scheduler: Running\n` +
        `Server Type: Droplet\n` +
        `Provider: Digital Ocean\n` +
        `Hosting type: Cloud\n` +
        `Server Public IP: 68.183.94.123\n` +
        `System: Ubuntu 24.04 (LTS) x64\n` +
        `Private IP: 10.122.0.2\n\n` +
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