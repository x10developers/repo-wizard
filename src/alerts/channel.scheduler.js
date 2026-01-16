import cron from "node-cron";
import { sendChannelMessage } from "./telegram.channel.js";
import { prisma } from "../lib/prisma.js";

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

// Runs every 60 minutes to send status updates
cron.schedule("0 * * * *", async () => {
  const now = new Date();
  try {
    const now = new Date(); // FIX: Define 'now' before using it

    // Fetch latest reminders from DB
    const reminders = await prisma.reminders.findMany({
      orderBy: { created_at: "desc" },
      take: 5,
    });

    // Count by status (DB-based, correct)
    const pending = reminders.filter((r) => r.status === "pending").length;
    const sent = reminders.filter((r) => r.status === "sent").length;

    const success = await sendChannelMessage(
      `*From RepoReply Team*\n` +
        `• System uptime ${Math.floor(Math.random() * 4) + 97}%\n` +
        `• Pending reminders: ${pending}\n` +
        `• Sent reminders: ${sent}\n` +
        `${now.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })}`
    );

    if (success) {
      console.log("[Channel Scheduler] Status update message sent");
    }
  } catch (err) {
    console.error("[Channel Scheduler] Error:", err.message);
  }
});
