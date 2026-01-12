import { prisma } from "./prisma.js";

export async function getAdminTrends(days = 7) {
  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);

  const raw = await prisma.reminders.groupBy({
    by: ["sent_at"],
    where: {
      status: "sent",
      sent_at: { gte: start }
    },
    _count: { _all: true }
  });

  // Map DB results → yyyy-mm-dd
  const map = {};
  for (const row of raw) {
    const d = row.sent_at.toISOString().slice(0, 10);
    map[d] = (map[d] || 0) + row._count._all;
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
