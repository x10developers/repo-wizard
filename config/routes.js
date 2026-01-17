import { asyncHandler } from "../src/utils/errors.js";
import { getInstallationOctokit } from "../services/github.service.js";
import { handleMention } from "../src/webhooks/mention/index.js";
import { handleDailyCron } from "../services/cron.service.js";
import gitlabRoutes from "../src/routes/auth/gitlab.routes.js";

// Import Telegram webhook setup
import { setupTelegramWebhooks } from "./telegram-webhooks.js";

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
      console.log(
        `[Webhook] Event: ${event}, Installation ID: ${installationId}`
      );

      if (!installationId) return res.sendStatus(200);

      const octokit = await getInstallationOctokit(installationId);

      if (
        event === "issue_comment" &&
        (action === "created" || action === "edited")
      ) {
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

  /* -------------------- Telegram Webhooks -------------------- */
  setupTelegramWebhooks(app);

  /* -------------------- Daily Cron -------------------- */
  app.post(
    "/cron/daily",
    asyncHandler(async (req, res) => {
      await handleDailyCron();
      res.send("Daily inactivity scan completed");
    })
  );
}

// Remove the sendMessageWithMarkup helper function if it exists at the bottom
