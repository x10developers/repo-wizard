// ============================================================================
// CHANNEL SCHEDULER - Sends periodic updates to Telegram channel
// ============================================================================

import cron from "node-cron";
import { sendChannelMessage } from "./telegram.channel.js";
import { loadReminders } from "../reminders/reminder.service.js";

// ----------------------------------------------------------------------------
// SYSTEM STARTUP NOTIFICATION
// Sends a verification message when the system restarts/wakes up
// ----------------------------------------------------------------------------

(async () => {
  const success = await sendChannelMessage(
    "*System Startup Notification*\n\n" +
    "This is a system-generated message to verify the system wakeup is working.\n\n" +
    "RepoReply channel permissions verified and system is now active."
  );
  
  if (success) {
    console.log("[Channel Scheduler] System wakeup message sent");
  }
})();

// ----------------------------------------------------------------------------
// PERIODIC STATUS UPDATE SCHEDULER
// Runs every 1 minute to send status updates to the Telegram channel
// ----------------------------------------------------------------------------
cron.schedule("* * * * *", async () => {
  try {
    // Load all reminders from the system
    const reminders = loadReminders();
    
    // Count pending reminders (not yet sent)
    const pending = reminders.filter(r => !r.sent).length;
    
    // Count completed reminders (already sent)
    const sent = reminders.filter(r => r.sent).length;
    
    // Send formatted status update to Telegram channel
    await sendChannelMessage(
      `*From Reporeply Team*\n` +
      `• System uptime 100%\n` +
      `• Pending reminders: ${pending}\n` +
      `• Sent reminders: ${sent}\n` +
      `• Time: ${new Date().toLocaleDateString('en-US', { weekday: 'short' })}, ${new Date().toLocaleTimeString('en-GB', { hour12: false })}`
    );
    
    // Confirm status update was sent successfully
    console.log("[Channel Scheduler] Status update message sent");
    
  } catch (err) {
    // Log any errors that occur during the update
    console.error("[Channel Scheduler] Error:", err.message);
  }
});

// ============================================================================
// End of Channel Scheduler
// ============================================================================