import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { ensurePrismaConnection } from "./lib/prisma.js";
import { logReminderIntegrity } from "./reminders/reminder.service.js";
import { setupMiddleware } from "../config/middleware.js";
import { setupRoutes } from "../config/routes.js";
import { setupErrorHandlers } from "../config/errorHandlers.js";
import { startServer } from "../config/server.js";

// Import schedulers (auto-run on import)
import "./alerts/channel.scheduler.js";
import "./reminders/reminder.scheduler.js";

const app = express();
const PORT = process.env.PORT || 3000;

/* -------------------- Environment Checks -------------------- */
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.warn("[WARN] TELEGRAM_BOT_TOKEN is not set");
}

/* -------------------- Database Connection -------------------- */
await ensurePrismaConnection().catch((err) => {
  console.error("[Startup] Failed to connect to database:", err);
  process.exit(1);
});

/* -------------------- Startup Integrity -------------------- */
try {
  await logReminderIntegrity();
} catch (err) {
  console.error("[Startup] Integrity check failed:", err.message);
}

/* -------------------- App Setup -------------------- */
setupMiddleware(app);
setupRoutes(app);
setupErrorHandlers(app);

/* -------------------- Start Server -------------------- */
startServer(app, PORT);

/* -------------------- Prisma Start -------------------- */

process.on("SIGTERM", async () => {
  console.log("[Shutdown] SIGTERM received");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[Shutdown] SIGINT received");
  await prisma.$disconnect();
  process.exit(0);
});
