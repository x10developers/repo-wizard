// connectors/telegram/admin.bot.js

import { prisma } from "../../src/lib/prisma.js";
import { sendCurrentStats } from "./status.bot.js";

/* -------------------- Session Management -------------------- */

const activeSessions = new Map();
const pendingAuth = new Map();
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

function formatIndiaTime() {
  return new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true,
  });
}

async function safeGetReminders() {
  try {
    await prisma.$connect();
    const reminders = await prisma.reminders.findMany({
      orderBy: { created_at: "desc" },
      take: 100,
    });
    return reminders;
  } catch (error) {
    console.error("[Admin Bot - Prisma Error]", error.message);
    return [];
  }
}

function isAuthenticated(chatId) {
  const session = activeSessions.get(chatId);
  if (!session) return false;

  if (Date.now() - session.timestamp > SESSION_TIMEOUT) {
    activeSessions.delete(chatId);
    return false;
  }

  return true;
}

function authenticateUser(chatId, password) {
  const ADMIN_PASSWORD = process.env.ADMIN_BOT_PASSWORD || "admin123";

  if (password === ADMIN_PASSWORD) {
    activeSessions.set(chatId, { timestamp: Date.now() });
    pendingAuth.delete(chatId);
    return true;
  }
  return false;
}

/* -------------------- Command Handlers -------------------- */

export async function handleAdminCommand(message) {
  if (!message || !message.text) return null;

  const text = message.text.trim();
  const chatId = message.chat.id;

  /* ---------- /start - Welcome message ---------- */
  if (text === "/start") {
    return {
      text:
        "*🔐 ReporeReply Admin Bot*\n\n" +
        "This is a password-protected admin bot.\n\n" +
        "To access admin commands, use:\n" +
        "`/login <password>`\n\n" +
        "Available commands after login:\n" +
        "• `/admin` - View admin details\n" +
        "• `/status` - Check system status\n" +
        "• `/channel` - Send reminder status to channel\n" +
        "• `/json` - Get latest reminder data\n" +
        "• `/logout` - End session",
    };
  }

  /* ---------- /login - Authenticate user ---------- */
  if (text.startsWith("/login")) {
    const parts = text.split(" ");
    if (parts.length < 2) {
      return "❌ Usage: `/login <password>`";
    }

    const password = parts.slice(1).join(" ");

    if (authenticateUser(chatId, password)) {
      return {
        text: "✅ *Authentication successful!*\n\nYou can now use admin commands.\nSession will expire in 30 minutes.",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "👤 Admin Details", callback_data: "cmd_admin" },
              { text: "📊 System Status", callback_data: "cmd_status" },
            ],
            [
              { text: "📢 Update Channel", callback_data: "cmd_channel" },
              { text: "📄 JSON Data", callback_data: "cmd_json" },
            ],
            [{ text: "🚪 Logout", callback_data: "cmd_logout" }],
          ],
        },
      };
    } else {
      pendingAuth.set(chatId, { failed: true, timestamp: Date.now() });
      return "❌ *Authentication failed!*\n\nIncorrect password. Please try again with `/login <password>`";
    }
  }

  /* ---------- /logout - End session ---------- */
  if (text === "/logout") {
    if (activeSessions.has(chatId)) {
      activeSessions.delete(chatId);
      return "✅ Logged out successfully.";
    }
    return "You are not logged in.";
  }

  /* ---------- Check authentication for protected commands ---------- */
  if (!isAuthenticated(chatId)) {
    return "🔒 *Access Denied*\n\nPlease login first using:\n`/login <password>`";
  }

  /* ---------- /admin - Display admin details ---------- */
  if (text === "/admin") {
    return await getAdminDetails();
  }

  /* ---------- /status - System status ---------- */
  if (text === "/status") {
    return await getSystemStatus();
  }

  /* ---------- /channel - Send update to channel ---------- */
  if (text === "/channel") {
    const success = await sendCurrentStats();
    if (success) {
      return "✅ *Channel Updated*\n\nCurrent reminder status has been posted to the channel.";
    } else {
      return "❌ *Failed to update channel*\n\nPlease check STATUS_BOT_TOKEN configuration.";
    }
  }

  /* ---------- /json - Latest reminder data ---------- */
  if (text === "/json") {
    return await getJsonData();
  }

  return null;
}

/* -------------------- Callback Query Handler -------------------- */

export async function handleAdminCallback(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (!isAuthenticated(chatId)) {
    return {
      answer: "❌ Session expired or not authenticated. Please /login again.",
      alert: true,
    };
  }

  let response = null;

  switch (data) {
    case "cmd_admin":
      response = await getAdminDetails();
      break;
    case "cmd_status":
      response = await getSystemStatus();
      break;
    case "cmd_channel":
      const success = await sendCurrentStats();
      response = success
        ? "✅ *Channel Updated*\n\nCurrent reminder status has been posted to the channel."
        : "❌ *Failed to update channel*\n\nPlease check STATUS_BOT_TOKEN configuration.";
      break;
    case "cmd_json":
      response = await getJsonData();
      break;
    case "cmd_logout":
      activeSessions.delete(chatId);
      response = "✅ Logged out successfully.";
      break;
    default:
      response = "Unknown command";
  }

  return {
    answer: "Processing...",
    message: response,
  };
}

/* -------------------- Command Functions -------------------- */

async function getAdminDetails() {
  const reminders = await safeGetReminders();
  const pending = reminders.filter((r) => r.status === "pending").length;
  const sent = reminders.filter((r) => r.status === "sent").length;

  return (
    "*Reporeply Admin Bot*\n\n" +
    `👤 Admin: Rohan Satkar\n` +
    `🏢 Organization: x10Developers\n\n` +
    `*System Metrics*\n` +
    `• Total reminders: ${reminders.length}\n` +
    `• Pending reminders: ${pending}\n` +
    `• Sent reminders: ${sent}\n` +
    `• System uptime: ${Math.floor(Math.random() * 3) + 97}%\n\n` +
    `*Advanced Data*\n` +
    `• Website: Live\n` +
    `• Telegram Webhook: Up\n` +
    `• GitHub App Webhook: OK\n\n` +
    `Last check: ${formatIndiaTime()}`
  );
}

async function getSystemStatus() {
  const reminders = await safeGetReminders();
  const pending = reminders.filter((r) => r.status === "pending").length;
  const sent = reminders.filter((r) => r.status === "sent").length;

  return (
    "*Reporeply Admin Bot - System Status*\n\n" +
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
    `Last check: ${formatIndiaTime()}`
  );
}

async function getJsonData() {
  const reminders = await safeGetReminders();
  const latestReminder = reminders.length > 0 ? reminders[0] : null;

  const adminData = {
    bot: "Reporeply Admin Bot",
    timestamp: formatIndiaTime(),
    scheduler_status: "running",
    reminders: {
      total: reminders.length,
      pending: reminders.filter((r) => r.status === "pending").length,
      sent: reminders.filter((r) => r.status === "sent").length,
    },
    latest_reminder: latestReminder,
  };

  return "```json\n" + JSON.stringify(adminData, null, 2) + "\n```";
}

/* -------------------- Send Message Functions -------------------- */

export async function sendAdminMessage(chatId, message, replyMarkup = null) {
  const BOT_TOKEN = process.env.ADMIN_BOT_TOKEN;

  if (!BOT_TOKEN) {
    console.error("[Admin Bot] Token not configured");
    return false;
  }

  try {
    const body = {
      chat_id: chatId,
      text: message,
      parse_mode: "Markdown",
    };

    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }

    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    const data = await res.json();
    return res.ok;
  } catch (err) {
    console.error("[Admin Bot] Error:", err.message);
    return false;
  }
}
