// connectors/telegram/index.js

/* -------------------- Central Bot Manager -------------------- */

import {
  handleAdminCommand,
  handleAdminCallback,
  sendAdminMessage,
} from "./admin.bot.js";

import {
  sendStartupMessage,
  sendShutdownMessage,
  sendErrorAlert,
  sendDatabaseEvent,
  sendDeploymentNotification,
  sendCustomSystemMessage,
} from "./system.bot.js";

import {
  startStatusScheduler,
  stopStatusScheduler,
  sendImmediateStatus,
  sendStartupToChannel,
  sendDailySummary,
  sendCustomStatus,
  sendCurrentStats,
} from "./status.bot.js";

import { handleFindIdCommand, sendFindIdMessage } from "./findid.bot.js";

/* -------------------- Export Individual Bots -------------------- */

export const admin = {
  handleCommand: handleAdminCommand,
  handleCallback: handleAdminCallback,
  sendMessage: sendAdminMessage,
};

export const system = {
  sendStartup: sendStartupMessage,
  sendShutdown: sendShutdownMessage,
  sendError: sendErrorAlert,
  sendDatabaseEvent: sendDatabaseEvent,
  sendDeployment: sendDeploymentNotification,
  sendCustom: sendCustomSystemMessage,
};

export const status = {
  startScheduler: startStatusScheduler,
  stopScheduler: stopStatusScheduler,
  sendNow: sendImmediateStatus,
  sendStartup: sendStartupToChannel,
  sendDailySummary: sendDailySummary,
  sendCustom: sendCustomStatus,
  sendCurrentStats: sendCurrentStats,
};

export const findId = {
  handleCommand: handleFindIdCommand,
  sendMessage: sendFindIdMessage,
};

/* -------------------- Convenience Functions -------------------- */

export async function initializeBots() {
  console.log("[Telegram Bots] Initializing all bots...");

  // Start status scheduler
  status.startScheduler();

  // Send startup to admin (System Bot)
  await system.sendStartup();

  // Send startup to channel (Status Bot)
  await status.sendStartup();

  console.log("[Telegram Bots] All bots initialized successfully");
}

export async function shutdownBots() {
  console.log("[Telegram Bots] Shutting down all bots...");
  status.stopScheduler();
  await system.sendShutdown();
  console.log("[Telegram Bots] All bots shut down successfully");
}

/* -------------------- Default Export -------------------- */

export default {
  admin,
  system,
  status,
  findId,
  initializeBots,
  shutdownBots,
};
