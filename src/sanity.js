import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  const reminderCount = await prisma.reminders.count();
  console.log("Reminders:", reminderCount);
}

run().finally(() => prisma.$disconnect());
