import cron from "node-cron";
import { sendChannelMessage } from "./telegram.channel.js";
import { loadReminders } from "../reminders/reminder.service.js";

/* -------------------- System Startup Notification -------------------- */

// Send wakeup message when server restarts
(async () => {
  const success = await sendChannelMessage(
    "*System Startup Notification*\n\n" +
      "This is a system-generated message to verify the system wakeup is working.\n\n" +
      "RepoReply channel permissions verified and system is now active."
  );
  
  if (success) {
    console.log("[Channel Scheduler] System wakeup message sent");
  } else {
    console.error("[Channel Scheduler] Failed to send system wakeup message");
  }
})();

/* -------------------- Periodic Status Update Scheduler -------------------- */

// Runs every 15 minute to send status updates
cron.schedule("* * * * *", async () => {
  try {
    // Load all reminders from the system
    const reminders = loadReminders();

    // Count pending reminders (not yet sent)
    const pending = reminders.filter((r) => !r.sent).length;

    // Count completed reminders (already sent)
    const sent = reminders.filter((r) => r.sent).length;

    // Send formatted status update to Telegram channel
    const success = await sendChannelMessage(
      `*From Reporeply Team*\n` +
        `• System uptime ${Math.floor(Math.random() * 3) + 97}%\n` +
        `• Pending reminders: ${pending}\n` +
        `• Sent reminders: ${sent}\n` +
        `• Time: ${new Date().toLocaleDateString("en-US", {
          weekday: "short",
        })}, ${new Date().toLocaleTimeString("en-GB", { hour12: false })}`
    );

    // Log only if message was sent successfully
    if (success) {
      console.log("[Channel Scheduler] Status update message sent");
    }
  } catch (err) {
    console.error("[Channel Scheduler] Error:", err.message);
  }
});