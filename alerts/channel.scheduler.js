/**
 * File: reminders/channel.scheduler.js
 *
 * Purpose:
 * - Dedicated scheduler for Telegram channel updates
 * - Sends hourly, morning, and night summaries
 * - Does NOT affect user notifications
 */

const cron = require("node-cron");
const { sendChannelMessage } = require("../alerts/telegram.channel");
const { loadReminders } = require("./reminder.service");

/* ---------------- Hourly Update ---------------- */
/* Runs every hour */
cron.schedule("0 * * * *", async () => {
  try {
    const reminders = loadReminders();
    if (!reminders || reminders.length === 0) return;

    const pending = reminders.filter(r => !r.sent).length;
    if (pending === 0) return;

    await sendChannelMessage(
      `⏰ *Hourly RepoReply Update*\nPending reminders: ${pending}`
    );
  } catch (err) {
    console.error("[Channel Scheduler][Hourly]", err.message);
  }
});

/* ---------------- Morning Update ---------------- */
/* Runs at 06:00 */
cron.schedule("0 6 * * *", async () => {
  try {
    await sendChannelMessage(
      "🌅 *Good Morning!*\nRepoReply is actively monitoring repositories."
    );
  } catch (err) {
    console.error("[Channel Scheduler][Morning]", err.message);
  }
});

/* ---------------- Night Update ---------------- */
/* Runs at 23:00 */
cron.schedule("0 23 * * *", async () => {
  try {
    await sendChannelMessage(
      "🌙 *Daily Wrap-up*\nAll scheduled checks completed successfully."
    );
  } catch (err) {
    console.error("[Channel Scheduler][Night]", err.message);
  }
});

console.log("[Channel Scheduler] Initialized");
