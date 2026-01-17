import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { prisma } from "./lib/prisma.js";
import { logReminderIntegrity } from "./reminders/reminder.service.js";
import { setupMiddleware } from "../config/middleware.js";
import { setupRoutes } from "../config/routes.js";
import { setupErrorHandlers } from "../config/errorHandlers.js";
import { startServer } from "../config/server.js";

// Import the new bot system (adjust path based on your structure)
import bots from "../connectors/telegram/index.js";

// Import reminder scheduler (keep your existing reminder logic)
import "./reminders/reminder.scheduler.js";

const app = express();
const PORT = process.env.PORT || 3000;

/* -------------------- Environment Checks -------------------- */
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.warn("[WARN] TELEGRAM_BOT_TOKEN is not set");
}

/* -------------------- Database Connection -------------------- */
async function ensurePrismaConnection() {
  try {
    await prisma.$connect();
    console.log("[Database] Connected successfully");

    // Send database connection event to channel
    if (bots?.system?.sendDatabaseEvent) {
      await bots.system.sendDatabaseEvent(
        "connected",
        "PostgreSQL connection established"
      );
    }

    return true;
  } catch (error) {
    console.error("[Database] Connection failed:", error.message);

    // Send database error to channel
    if (bots?.system?.sendError) {
      await bots.system.sendError(error.message, "Database Connection");
    }

    throw error;
  }
}

await ensurePrismaConnection().catch((err) => {
  console.error("[Startup] Failed to connect to database:", err);
  process.exit(1);
});

/* -------------------- Startup Integrity -------------------- */
try {
  await logReminderIntegrity();
  console.log("[Startup] Integrity check passed");
} catch (err) {
  console.error("[Startup] Integrity check failed:", err.message);
  if (bots?.system?.sendError) {
    await bots.system.sendError(err.message, "Startup Integrity Check");
  }
}

/* -------------------- App Setup -------------------- */
setupMiddleware(app);
setupRoutes(app);
setupErrorHandlers(app);

/* -------------------- Initialize Telegram Bots -------------------- */
console.log("[Telegram] Initializing bots...");
if (bots && bots.initializeBots) {
  await bots.initializeBots().catch((err) => {
    console.error("[Telegram] Bot initialization failed:", err.message);
  });
} else {
  console.warn("[Telegram] Bot system not properly loaded");
}

/* -------------------- Start Server -------------------- */
startServer(app, PORT);

console.log(`[Server] ReporeReply started on port ${PORT}`);

/* -------------------- Graceful Shutdown -------------------- */
async function gracefulShutdown(signal) {
  console.log(`[Shutdown] ${signal} received`);

  try {
    // Shutdown bots (sends shutdown message to channel)
    if (bots && bots.shutdownBots) {
      await bots.shutdownBots();
    }

    // Disconnect from database
    await prisma.$disconnect();
    console.log("[Shutdown] Database disconnected");

    console.log("[Shutdown] Graceful shutdown complete");
    process.exit(0);
  } catch (err) {
    console.error("[Shutdown] Error during shutdown:", err.message);
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught errors
process.on("uncaughtException", async (err) => {
  console.error("[Error] Uncaught Exception:", err);
  if (bots?.system?.sendError) {
    await bots.system.sendError(err.message, "Uncaught Exception");
  }
  process.exit(1);
});

process.on("unhandledRejection", async (reason, promise) => {
  console.error("[Error] Unhandled Rejection at:", promise, "reason:", reason);
  if (bots?.system?.sendError) {
    await bots.system.sendError(String(reason), "Unhandled Rejection");
  }
});
