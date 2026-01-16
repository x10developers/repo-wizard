/**
 * GitHub mention handler
 */

import { createReminder } from "../../reminders/reminder.service.js";
import { ensureRepositoryExists } from "../../utils/repository.helper.js";
import { ValidationError, withRetry } from "../../utils/errors.js";
import { checkGitHubPermissions } from "./permissions.js";
import { sendGitHubComment, sendGitHubErrorComment } from "./comments.js";
import {
  isValidCommand,
  isAdminCommand,
  extractCommandText,
  validateReminder,
} from "./validation.js";

/**
 * Handle RepoReply commands from GitHub issue comments
 */
export async function handleGitHubMention(payload, octokit) {
  console.log(
    `\n[GitHub Mention] Processing: ${payload.repository.full_name}#${payload.issue.number}`
  );

  const body = payload.comment?.body;
  if (!body) return;

  // Check if this is a valid command
  if (!isValidCommand(body)) {
    return;
  }

  const isAdmin = isAdminCommand(body);

  try {
    // Permission Check
    const allowed = await checkGitHubPermissions(payload, octokit);

    if (!allowed) {
      await sendGitHubErrorComment(
        octokit,
        payload,
        "❌ Reminder not created.\n\n" +
          "Only the issue author, repository collaborators, organization members, " +
          "or prior contributors are permitted to create reminders for this issue."
      );
      return;
    }

    // Extract command text
    const commandText = extractCommandText(body);

    // Validate reminder (includes rate limiting check)
    const parsed = await validateReminder({
      commandText,
      repo_id: payload.repository.full_name,
      issue_number: payload.issue.number,
      skipRateLimit: isAdmin,
    });

    // Ensure Repository Exists
    await ensureRepositoryExists(payload);

    // Save Reminder with Retry
    const reminderData = {
      repo_id: payload.repository.full_name,
      issue_number: payload.issue.number,
      message: `Scheduled reminder for @${payload.sender.login} Please review when convenient.`,
      scheduled_at: parsed.remindAt,
      created_by: payload.sender.login,
    };

    const reminder = await withRetry(
      () => createReminder(reminderData),
      3,
      1000
    );

    console.log(`[GitHub Mention] ✅ Reminder created: ${reminder.id}`);

    // Send confirmation comment
    await sendGitHubComment(
      octokit,
      payload,
      `Got it. I will remind you on **${parsed.remindAt.toLocaleString(
        "en-IN",
        { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }
      )}**.`
    );
  } catch (error) {
    console.error("[GitHub Mention] ❌ Error:", {
      name: error.name,
      message: error.message,
    });

    let userMessage = "❌ Failed to create reminder.\n\n";

    if (error instanceof ValidationError) {
      userMessage += error.message;
    } else if (error.name === "DatabaseError") {
      userMessage += "Database error occurred. Please try again in a moment.";
    } else if (error.code === "P2002") {
      userMessage += "A reminder already exists with these details.";
    } else {
      userMessage +=
        "An unexpected error occurred. Please contact support if this persists.";
    }

    await sendGitHubErrorComment(octokit, payload, userMessage);
  }
}
