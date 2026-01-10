//Chat GPT CODE
// import cron from "node-cron";
// import { sendChannelMessage } from "./telegram.channel.js";
// import { loadReminders } from "../reminders/reminder.service.js";

// console.log("[Channel Scheduler] Initialized");
// sendChannelMessage("✅ RepoReply channel permissions verified");

// /* Auto channel update – every 10 minutes */
// cron.schedule("*/10 * * * *", async () => {
//   try {
//     const reminders = loadReminders();
//     const pending = reminders.filter(r => !r.sent).length;
//     if (pending === 0) return;

//     await sendChannelMessage(
//       `⏰ *Hourly RepoReply Update*\nPending reminders: ${pending}`
//     );
//   } catch (err) {
//     console.error("[Channel Scheduler][Hourly]", err.message);
//   }
// });

// /* Morning update */
// cron.schedule("0 6 * * *", async () => {
//   await sendChannelMessage(
//     "🌅 *Morning Update*\nRepoReply is actively monitoring repositories."
//   );
// });

// /* Night update */
// cron.schedule("0 23 * * *", async () => {
//   await sendChannelMessage(
//     "🌙 *Night Update*\nAll scheduled checks completed."
//   );
// });


import cron from "node-cron";
import { sendChannelMessage } from "./telegram.channel.js";
import { loadReminders } from "../reminders/reminder.service.js";

console.log("[Channel Scheduler] Initialized at", new Date().toLocaleString());

// Send initialization message
sendChannelMessage("✅ RepoReply channel permissions verified")
  .then(() => console.log("[Channel Scheduler] Init message sent"))
  .catch(err => console.error("[Channel Scheduler] Init error:", err));

/* Auto channel update – every 2 minute */
cron.schedule("* * * * *", async () => {
  console.log("[Channel Scheduler] 1-min check triggered at", new Date().toLocaleString());
  
  try {
    const reminders = loadReminders();
    const pending = reminders.filter(r => !r.sent).length;
    const sent = reminders.filter(r => r.sent).length;
    
    console.log("[Channel Scheduler] Pending:", pending, "Sent:", sent);
    
    await sendChannelMessage(
      `*From RepoReply Team*\n` +
      `• System uptime 100%\n` +
      `• Pending reminders: ${pending}\n` +
      `• Sent reminders: ${sent}\n` +
      `• Time: ${new Date().toLocaleTimeString()}`
    );
    
    console.log("[Channel Scheduler] Update message sent");
  } catch (err) {
    console.error("[Channel Scheduler][1-min]", err.message);
  }
});

console.log("[Channel Scheduler] Cron job registered - sending updates every 1 minute");