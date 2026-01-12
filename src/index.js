/**
 * File: index.js
 *
 * Purpose:
 * - Main entry point of the RepoReply server.
 *
 * Responsibilities:
 * - Starts the Express server.
 * - Receives GitHub webhook events.
 * - Authenticates GitHub App requests.
 * - Routes events to the correct handlers.
 * - Triggers inactivity checks and automation.
 *
 * Why this file exists:
 * - Central bootstrap file.
 * - Keeps all feature logic delegated to other modules.
 */

import dotenv from "dotenv";
dotenv.config(); // MUST be first

import cors from "cors";

import adminRoutes from "./routes/admin.routes.js";

//end
import express from "express";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { Octokit } from "@octokit/rest";
import { fileURLToPath } from "url";
import { handleTelegramCommand } from "./alerts/telegram.commands.js";
import { handleMention } from "./webhooks/mention.handler.js";
import { logReminderIntegrity } from "./reminders/reminder.service.js";
import "./alerts/channel.scheduler.js";
import "./reminders/reminder.scheduler.js";
import "./alerts/group.scheduler.js";

const app = express();
const PORT = process.env.PORT || 3000;

/* -------------------- Environment Checks -------------------- */
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.warn("[WARN] TELEGRAM_BOT_TOKEN is not set");
}

/* -------------------- ESM dirname fix -------------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* -------------------- Startup Integrity -------------------- */

logReminderIntegrity();

/* -------------------- Configuration -------------------- */

const INACTIVITY_DAYS = 30;
const GRACE_PERIOD_DAYS = 7;
const MS_IN_DAY = 24 * 60 * 60 * 1000;

/* -------------------- App Setup -------------------- */

// const app = express();
// app.use(express.json());
// app.use("/admin", adminRoutes);
// const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: "https://reporeply-frontend.vercel.app",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

app.use(express.json());


app.use(express.json());
app.use("/admin", adminRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

/* -------------------- Health Check -------------------- */

app.get("/", (req, res) => {
  res.status(200).send("RepoReply server is running");
});

/* -------------------- Auth Helpers -------------------- */

function createAppJWT() {
  const privateKey = fs.readFileSync(
    process.env.GITHUB_PRIVATE_KEY_PATH,
    "utf8"
  );

  const now = Math.floor(Date.now() / 1000);

  return jwt.sign(
    {
      iat: now - 30,
      exp: now + 540,
      iss: Number(process.env.GITHUB_APP_ID),
    },
    privateKey,
    { algorithm: "RS256" }
  );
}

async function getInstallationOctokit(installationId) {
  const appJWT = createAppJWT();
  const appOctokit = new Octokit({ auth: appJWT });

  const { data } = await appOctokit.request(
    "POST /app/installations/{installation_id}/access_tokens",
    { installation_id: installationId }
  );

  return new Octokit({ auth: data.token });
}

/* -------------------- Inactivity Helpers -------------------- */

function daysSince(date) {
  return Math.floor((Date.now() - new Date(date).getTime()) / MS_IN_DAY);
}

async function hasInactivityWarning(octokit, owner, repo, issueNumber) {
  const comments = await octokit.paginate(octokit.issues.listComments, {
    owner,
    repo,
    issue_number: issueNumber,
    per_page: 100,
  });

  return comments.some(
    (c) => c.user?.type === "Bot" && c.body?.includes("inactive for")
  );
}

/* -------------------- Inactivity Logic -------------------- */

async function scanInactiveIssues(octokit, owner, repo) {
  const issues = await octokit.paginate(octokit.issues.listForRepo, {
    owner,
    repo,
    state: "open",
    per_page: 100,
  });

  for (const issue of issues) {
    if (issue.pull_request) continue;

    const labels = issue.labels.map((l) =>
      typeof l === "string" ? l : l.name
    );

    if (labels.includes("do-not-close")) continue;

    const inactiveDays = daysSince(issue.updated_at);

    if (inactiveDays >= INACTIVITY_DAYS) {
      const warned = await hasInactivityWarning(
        octokit,
        owner,
        repo,
        issue.number
      );

      if (!warned) {
        await octokit.issues.createComment({
          owner,
          repo,
          issue_number: issue.number,
          body:
            `This issue has been inactive for ${INACTIVITY_DAYS} days.\n\n` +
            `If no further activity occurs, it will be automatically closed in ${GRACE_PERIOD_DAYS} days.`,
        });
        continue;
      }
    }

    if (inactiveDays >= INACTIVITY_DAYS + GRACE_PERIOD_DAYS) {
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: issue.number,
        body:
          "Closing this issue due to prolonged inactivity.\n\n" +
          "If this is still relevant, please reopen with updated information.",
      });

      await octokit.issues.update({
        owner,
        repo,
        issue_number: issue.number,
        state: "closed",
      });
    }
  }
}

/* -------------------- Webhook Handler -------------------- */

app.post("/webhook", async (req, res) => {
  const event = req.headers["x-github-event"];
  const action = req.body?.action;

  if (req.body?.sender?.type === "Bot") {
    return res.sendStatus(200);
  }

  try {
    const installationId = req.body.installation?.id;
    if (!installationId) return res.sendStatus(200);

    const octokit = await getInstallationOctokit(installationId);

    if (event === "issue_comment" && action === "created") {
      await handleMention(req.body, octokit);
    }

    if (event === "issues" && action === "opened") {
      await octokit.issues.createComment({
        owner: req.body.repository.owner.login,
        repo: req.body.repository.name,
        issue_number: req.body.issue.number,
        body:
          "Thank you for opening this issue. " +
          "We have started monitoring this issue.",
      });
    }
  } catch (err) {
    console.error("Webhook failed:", err.message);
  }

  res.sendStatus(200);
});

/* -------------------- Telegram Bot Webhook -------------------- */

app.post(
  "/telegram/webhook",
  express.json({ limit: "1mb" }),
  async (req, res) => {
    res.sendStatus(200); // respond FIRST

    try {
      const message = req.body?.message;
      if (!message) return;

      const reply = await handleTelegramCommand(message);
      if (!reply) return;

      await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: message.chat.id,
            text: reply,
          }),
        }
      );
    } catch (err) {
      console.error("Telegram webhook failed:", err.message);
    }
  }
);
``;
/* -------------------- Daily Cron Endpoint -------------------- */

app.post("/cron/daily", async (req, res) => {
  try {
    const appJWT = createAppJWT();
    const appOctokit = new Octokit({ auth: appJWT });

    const { data: installations } = await appOctokit.request(
      "GET /app/installations"
    );

    for (const installation of installations) {
      const octokit = await getInstallationOctokit(installation.id);
      const repos = await octokit.paginate(
        octokit.apps.listReposAccessibleToInstallation,
        { per_page: 100 }
      );

      for (const repo of repos) {
        await scanInactiveIssues(octokit, repo.owner.login, repo.name);
      }
    }

    res.send("Daily inactivity scan completed");
  } catch (err) {
    console.error("Daily cron failed:", err.message);
    res.sendStatus(500);
  }
});

/* -------------------- Server& Telgram Wakeup Message -------------------- */

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`Server running on http://localhost:${PORT}`);

  // Send system startup notification to Telegram
  const { sendChannelMessage } = await import("./alerts/telegram.channel.js");

  // First message - System startup notification
  const success1 = await sendChannelMessage(
    "*System Startup Notification*\n\n" +
      "This is a system-generated message to verify the system wakeup sequence."
  );

  // Second message - System active broadcast
  const success2 = await sendChannelMessage(
    "Automated check complete. System is operational & fully functional."
  );

  // Log if both messages were sent successfully
  if (success1 && success2) {
    console.log("[Server] System wakeup messages sent to Telegram");
  } else {
    // Send failure notification to Telegram
    await sendChannelMessage(
      "*System Startup Warning*\n\n" +
        "Failed to send one or more startup messages.\n" +
        "Please check system configuration."
    );
    console.error("[Server] Failed to send system wakeup messages");
  }
});
