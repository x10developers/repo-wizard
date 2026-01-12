import { prisma } from "./prisma.js";

export async function getAdminTrends(days = 7) {
  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);

  // Fetch all sent reminders in the date range
  const reminders = await prisma.reminders.findMany({
    where: {
      status: "sent",
      sent_at: { gte: start }
    },
    select: {
      sent_at: true
    }
  });

  // Map DB results → yyyy-mm-dd
  const map = {};
  for (const reminder of reminders) {
    if (reminder.sent_at) {
      const d = reminder.sent_at.toISOString().slice(0, 10);
      map[d] = (map[d] || 0) + 1;
    }
  }

  // Fill missing days
  const data = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);

    data.push({
      date: key,
      sent: map[key] || 0
    });
  }

  return data;
}