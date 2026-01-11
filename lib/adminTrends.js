import { prisma } from "./prisma.js";

export async function getReminderTrends(days = 7) {
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - days);

  const result = await prisma.$queryRaw`
    SELECT
      DATE(sent_at) as date,
      COUNT(*)::int as sent
    FROM reminders
    WHERE status = 'sent'
      AND sent_at >= ${from}
    GROUP BY DATE(sent_at)
    ORDER BY date ASC
  `;

  return result;
}
