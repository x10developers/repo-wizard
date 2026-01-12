import { prisma } from "../lib/prisma.js";

async function main() {
  try {
    await prisma.$connect();
    console.log("✅ DB CONNECTED");

    const result = await prisma.$queryRaw`SELECT 1`;
    console.log("✅ QUERY OK:", result);

    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ DB CONNECTION FAILED");
    console.error(err);
    process.exit(1);
  }
}

main();
