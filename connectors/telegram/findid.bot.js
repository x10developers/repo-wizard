// connectors/telegram/findid.bot.js

/* -------------------- Find My ID Bot -------------------- */
// Simple bot that helps users find their Telegram chat ID

/**
 * Handle messages for the Find ID bot
 */
export async function handleFindIdCommand(message) {
  if (!message) return null;

  const chatId = message.chat.id;
  const userId = message.from.id;
  const chatType = message.chat.type;
  const username = message.from.username || "No username";
  const firstName = message.from.first_name || "User";
  const lastName = message.from.last_name || "";

  const text = message.text?.trim() || "";

  /* ---------- /start - Welcome message ---------- */
  if (text === "/start" || text === "/help") {
    return (
      `🔍 *Find My ID Bot*\n\n` +
      `This bot helps you find Telegram IDs.\n\n` +
      `*Available Commands:*\n` +
      `• \`/start\` - Show this message\n` +
      `• \`/myid\` - Get your user ID\n` +
      `• \`/chatid\` - Get this chat's ID\n` +
      `• \`/info\` - Get detailed information\n\n` +
      `💡 *Tip:* Forward a message from any chat to this bot to get that chat's ID!`
    );
  }

  /* ---------- /myid - Get user ID ---------- */
  if (text === "/myid") {
    return (
      `👤 *Your User ID*\n\n` +
      `🆔 ID: \`${userId}\`\n` +
      `👤 Name: ${firstName} ${lastName}\n` +
      `📝 Username: @${username}\n\n` +
      `You can copy the ID by tapping on it.`
    );
  }

  /* ---------- /chatid - Get chat ID ---------- */
  if (text === "/chatid") {
    const chatName = message.chat.title || `${firstName} ${lastName}`;

    return (
      `💬 *Chat Information*\n\n` +
      `🆔 Chat ID: \`${chatId}\`\n` +
      `📝 Chat Name: ${chatName}\n` +
      `🏷️ Type: ${chatType}\n\n` +
      `${chatType === "private" ? "(This is a private chat)" : ""}`
    );
  }

  /* ---------- /info - Detailed information ---------- */
  if (text === "/info") {
    const chatName = message.chat.title || `${firstName} ${lastName}`;

    return (
      `📊 *Detailed Information*\n\n` +
      `*User Details:*\n` +
      `• User ID: \`${userId}\`\n` +
      `• Name: ${firstName} ${lastName}\n` +
      `• Username: @${username}\n\n` +
      `*Chat Details:*\n` +
      `• Chat ID: \`${chatId}\`\n` +
      `• Chat Name: ${chatName}\n` +
      `• Chat Type: ${chatType}\n` +
      `• Language: ${message.from.language_code || "Unknown"}\n\n` +
      `*Message Details:*\n` +
      `• Message ID: ${message.message_id}\n` +
      `• Date: ${new Date(message.date * 1000).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      })}`
    );
  }

  /* ---------- Handle forwarded messages ---------- */
  if (message.forward_from_chat) {
    const forwardedChatId = message.forward_from_chat.id;
    const forwardedChatName = message.forward_from_chat.title || "Unknown";
    const forwardedChatType = message.forward_from_chat.type;

    return (
      `📨 *Forwarded Message Information*\n\n` +
      `🆔 Chat ID: \`${forwardedChatId}\`\n` +
      `📝 Chat Name: ${forwardedChatName}\n` +
      `🏷️ Type: ${forwardedChatType}\n\n` +
      `This is the ID of the chat where the message was forwarded from.`
    );
  }

  if (message.forward_from) {
    const forwardedUserId = message.forward_from.id;
    const forwardedUserName = message.forward_from.first_name || "Unknown";
    const forwardedUsername = message.forward_from.username || "No username";

    return (
      `📨 *Forwarded Message Information*\n\n` +
      `🆔 User ID: \`${forwardedUserId}\`\n` +
      `👤 Name: ${forwardedUserName}\n` +
      `📝 Username: @${forwardedUsername}\n\n` +
      `This is the ID of the user who sent the forwarded message.`
    );
  }

  /* ---------- Default response for any other message ---------- */
  return (
    `👋 Hi ${firstName}!\n\n` +
    `Your User ID: \`${userId}\`\n` +
    `This Chat ID: \`${chatId}\`\n\n` +
    `Use /help to see all available commands.`
  );
}

/**
 * Send a message using the Find ID bot
 */
export async function sendFindIdMessage(chatId, message) {
  const BOT_TOKEN = process.env.FINDID_BOT_TOKEN;

  if (!BOT_TOKEN) {
    console.error("[Find ID Bot] Token not configured");
    return false;
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "Markdown",
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      console.error("[Find ID Bot] API Error:", data);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[Find ID Bot] Error:", err.message);
    return false;
  }
}

/* -------------------- Export All Functions -------------------- */

export default {
  handleFindIdCommand,
  sendFindIdMessage,
};
