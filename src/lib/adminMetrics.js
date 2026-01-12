import { prisma } from "./prisma.js";

export async function getAdminMetrics() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [
    totalRepos,
    activeRepos,
    totalReminders,
    pendingReminders,
    sentToday,
    failedToday,
    deadReminders
  ] = await Promise.all([
    prisma.repositories.count(),
    prisma.repositories.count({ where: { is_active: true } }),
    prisma.reminders.count(),
    prisma.reminders.count({ where: { status: "pending" } }),
    prisma.reminders.count({
      where: { status: "sent", sent_at: { gte: today } }
    }),
    prisma.reminders.count({
      where: { status: "failed", created_at: { gte: today } }
    }),
    prisma.reminders.count({ where: { status: "dead" } })
  ]);

  return {
    totalRepos,
    activeRepos,
    totalReminders,
    pendingReminders,
    sentToday,
    failedToday,
    deadReminders
  };
}
