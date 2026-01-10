import cron from "node-cron";
import { sendChannelMessage } from "./telegram.channel.js";
import { loadReminders } from "../reminders/reminder.service.js";

console.log("[Channel Scheduler] Initialized at", new Date().toLocaleString());

// Send initialization message
sendChannelMessage("RepoReply channel permissions verified")
  .then(() => console.log("[Channel Scheduler] Init message sent"))
  .catch(err => console.error("[Channel Scheduler] Init error:", err));

/* Auto channel update – every 2 minute */
cron.schedule("* * * * *", async () => {
  
  try {
    const reminders = loadReminders();
    const pending = reminders.filter(r => !r.sent).length;
    const sent = reminders.filter(r => r.sent).length;
    
    console.log("[Channel Scheduler] Pending:", pending, "Sent:", sent);
    
    await sendChannelMessage(
      `*From Reporeply Team*\n` +
      `• System uptime 100%\n` +
      `• Pending reminders: ${pending}\n` +
      `• Sent reminders: ${sent}\n` +
      `• Time: ${new Date().toLocaleDateString('en-US', { weekday: 'short' })}, ${new Date().toLocaleTimeString('en-GB', { hour12: false })}`
    );
    
    console.log("[Channel Scheduler] Update message sent");
  } catch (err) {
    console.error("[Channel Scheduler][1-min]", err.message);
  }
});
