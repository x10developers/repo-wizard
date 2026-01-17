// connectors/telegram/system.bot.js

/* -------------------- System Event Bot -------------------- */
// Sends startup notifications to CHANNEL (public)
// Sends errors, database, shutdown, deployment → ADMIN ONLY (private)
// Uses SYSTEM_BOT_TOKEN → Sends to TELEGRAM_CHANNEL_ID or ADMIN_CHAT_ID

/**
 * Send startup message when server starts - TO CHANNEL (public)
 */
export async function sendStartupMessage() {
  const message =
    `*System Startup Notification*\n\n` +
    `This is a system-generated message to verify the system wakeup sequence.`;

  const success = await sendToChannel(message);

  if (success) {
    // Send follow-up confirmation
    await sendToChannel(
      `Automated check complete. System is operational & fully functional.`,
    );
  }

  return success;
}

/**
 * Send shutdown message when server stops - TO ADMIN ONLY
 */
export async function sendShutdownMessage() {
  const message =
    `ℹ️ *Server Shutdown*\n\n` +
    `🔴 ReporeReply system is going offline\n` +
    `⏰ Time: ${formatIndiaTime()}\n\n` +
    `Graceful shutdown initiated.`;

  return await sendToAdmin(message);
}

/**
 * Send error alert - TO ADMIN ONLY
 */
export async function sendErrorAlert(errorMessage, context = "") {
  const message =
    `🚨 *System Error Detected*\n\n` +
    `⚠️ Context: ${context || "Unknown"}\n` +
    `❌ Error: ${errorMessage}\n` +
    `⏰ Time: ${formatIndiaTime()}\n\n` +
    `Administrator attention required.`;

  return await sendToAdmin(message);
}

/**
 * Send database connection event - TO ADMIN ONLY
 */
export async function sendDatabaseEvent(eventType, details = "") {
  const emoji = eventType === "connected" ? "✅" : "❌";
  const status =
    eventType === "connected" ? "Database Connected" : "Database Disconnected";

  const message =
    `${emoji} *${status}*\n\n` +
    `📊 Database status changed\n` +
    `⏰ Time: ${formatIndiaTime()}\n` +
    (details ? `ℹ️ Details: ${details}\n` : "") +
    `\nSystem monitoring active.`;

  return await sendToAdmin(message);
}

/**
 * Send deployment notification - TO ADMIN ONLY
 */
export async function sendDeploymentNotification(version = "unknown") {
  const message =
    `📦 *New Deployment*\n\n` +
    `🆕 Version: ${version}\n` +
    `⏰ Deployed at: ${formatIndiaTime()}\n` +
    `✅ Application updated successfully\n\n` +
    `All services restarted.`;

  return await sendToAdmin(message);
}

/**
 * Send custom system message - TO ADMIN ONLY
 */
export async function sendCustomSystemMessage(title, details) {
  const message =
    `ℹ️ *${title}*\n\n` + `${details}\n` + `⏰ Time: ${formatIndiaTime()}`;

  return await sendToAdmin(message);
}

/* -------------------- Core Messaging Functions -------------------- */

/**
 * Send message to CHANNEL (public updates like startup notifications)
 */
async function sendToChannel(message) {
  const BOT_TOKEN = process.env.SYSTEM_BOT_TOKEN;
  const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

  if (!BOT_TOKEN) {
    console.warn("[System Bot] Missing SYSTEM_BOT_TOKEN");
    return false;
  }

  if (!CHANNEL_ID) {
    console.warn("[System Bot] Missing TELEGRAM_CHANNEL_ID");
    return false;
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHANNEL_ID,
          text: message,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      },
    );

    const data = await res.json();

    if (!res.ok) {
      console.error("[System Bot] API Error:", data);
      return false;
    }

    console.log("[System Bot] Message sent to channel");
    return true;
  } catch (err) {
    console.error("[System Bot] Error:", err.message);
    return false;
  }
}

/**
 * Send message to ADMIN ONLY (system events are private)
 */
async function sendToAdmin(message) {
  const BOT_TOKEN = process.env.SYSTEM_BOT_TOKEN;
  const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

  if (!BOT_TOKEN) {
    console.warn("[System Bot] Missing SYSTEM_BOT_TOKEN");
    return false;
  }

  if (!ADMIN_CHAT_ID) {
    console.error(
      "[System Bot] ⚠️ ADMIN_CHAT_ID not set! System messages will be lost!",
    );
    return false;
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: ADMIN_CHAT_ID,
          text: message,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      },
    );

    const data = await res.json();

    if (!res.ok) {
      console.error("[System Bot] API Error:", data);
      return false;
    }

    console.log("[System Bot] Message sent to admin");
    return true;
  } catch (err) {
    console.error("[System Bot] Error:", err.message);
    return false;
  }
}

/* -------------------- Helper Functions -------------------- */

function formatIndiaTime() {
  return new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true,
  });
}

/* -------------------- Export All Functions -------------------- */

export default {
  sendStartupMessage,
  sendShutdownMessage,
  sendErrorAlert,
  sendDatabaseEvent,
  sendDeploymentNotification,
  sendCustomSystemMessage,
};
