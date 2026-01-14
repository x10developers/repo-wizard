import { asyncHandler } from "../src/utils/errors.js";
import { getInstallationOctokit } from "../services/github.service.js";
import { handleMention } from "../src/webhooks/mention.handler.js";
import { handleTelegramCommand } from "../src/alerts/telegram.commands.js";
import { handleDailyCron } from "../services/cron.service.js";
import gitlabRoutes from "../src/routes/auth/gitlab.routes.js";

export function setupRoutes(app) {
  // Health checks
  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/", (req, res) => {
    res.status(200).send("RepoReply server is running");
  });

  /* -------------------- GitHub webhook -------------------- */

  app.post(
    "/webhook",
    asyncHandler(async (req, res) => {
      const event = req.headers["x-github-event"];
      const action = req.body?.action;

      if (req.body?.sender?.type === "Bot") {
        return res.sendStatus(200);
      }

      const installationId = req.body.installation?.id;
      if (!installationId) return res.sendStatus(200);

      const octokit = await getInstallationOctokit(installationId);

      if (event === "issue_comment" && action === "created") {
        await handleMention({
          provider: "github",
          payload: req.body,
          octokit,
        });
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

      res.sendStatus(200);
    })
  );

  /* -------------------- GitLab Routes -------------------- */

  app.use("/gitlab", gitlabRoutes);
  app.use("/auth/gitlab", gitlabRoutes);

  /* -------------------- Telegram webhook -------------------- */

  app.post("/telegram/webhook", async (req, res) => {
    res.sendStatus(200);

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
  });

  /* -------------------- Daily Cron -------------------- */

  app.post(
    "/cron/daily",
    asyncHandler(async (req, res) => {
      await handleDailyCron();
      res.send("Daily inactivity scan completed");
    })
  );
}
