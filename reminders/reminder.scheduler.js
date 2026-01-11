/**
 * File: reminders/reminder.scheduler.js
 *
 * Purpose:
 * - Background worker to process due reminders from the database.
 *
 * Rules:
 * - Only process reminders that are:
 *   - status = "pending"
 *   - sentAt IS NULL
 *   - scheduledAt <= now
 *
 * Notes:
 * - Fully DB-based (no JSON)
 * - Safe to run multiple times
 * - Exits cleanly when nothing is due
 */

import "dotenv/config";
import { prisma } from "../lib/prisma.js";

async function runScheduler() {
  console.log("[Metric] scheduler.status=running");

  const now = new Date();

  const reminders = await prisma.reminder.findMany({
    where: {
      status: "pending",
      sentAt: null,
      scheduledAt: {
        lte: now
      }
    }
  });

  console.log(`[Metric] reminders.checked=${reminders.length}`);

  if (reminders.length === 0) {
    console.log("[Metric] reminders.none_due");
    return;
  }

  for (const reminder of reminders) {
    try {
      // TODO (next phase):
      // - Post GitHub comment
      // - Send Telegram / Email / Slack notification

      await prisma.reminder.update({
        where: { id: reminder.id },
        data: {
          status: "sent",
          sentAt: new Date()
        }
      });

      console.log(
        `[Metric] reminders.sent=1 repo=${reminder.repoId} issue=${reminder.issueNumber}`
      );
    } catch (err) {
      console.error(
        `[Error] reminder.failed id=${reminder.id}`,
        err
      );
    }
  }
}

runScheduler()
  .catch((err) => {
    console.error("[Fatal] scheduler.crashed", err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
