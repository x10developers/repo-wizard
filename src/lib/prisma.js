import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  log: ["error"], // optional: change to ["query", "error"] for debugging
});
