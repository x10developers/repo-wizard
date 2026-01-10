import cron from "node-cron";
import { sendChannelMessage } from "./telegram.channel.js";
import { loadReminders } from "../reminders/reminder.service.js";

console.log("[Channel Scheduler] Initialized");

/* Hourly update */
cron.schedule("0 * * * *", async () => {
  try {
    const reminders = loadReminders();
    const pending = reminders.filter(r => !r.sent).length;
    if (pending === 0) return;

    await sendChannelMessage(
      `⏰ *Hourly RepoReply Update*\nPending reminders: ${pending}`
    );
  } catch (err) {
    console.error("[Channel Scheduler][Hourly]", err.message);
  }
});

/* Morning update */
cron.schedule("0 6 * * *", async () => {
  await sendChannelMessage(
    "🌅 *Morning Update*\nRepoReply is actively monitoring repositories."
  );
});

/* Night update */
cron.schedule("0 23 * * *", async () => {
  await sendChannelMessage(
    "🌙 *Night Update*\nAll scheduled checks completed."
  );
});
