/**
 * GitLab mention handler
 */

import { createReminder } from "../../reminders/reminder.service.js";
import { ensureRepositoryExists } from "../../utils/repository.helper.js";
import { ValidationError, withRetry } from "../../utils/errors.js";
import { checkGitLabPermissions } from "./permissions.js";
import { sendGitLabComment, sendGitLabErrorComment } from "./comments.js";
import {
  isValidCommand,
  isAdminCommand,
  extractCommandText,
  validateReminder,
} from "./validation.js";

/**
 * Handle RepoReply commands from GitLab issue comments
 */
export async function handleGitLabMention(payload, accessToken) {
  console.log(
    `\n[GitLab Mention] Processing: ${payload.project.path_with_namespace}#${payload.object_attributes.iid}`
  );

  const body = payload.object_attributes?.note;
  if (!body) return;

  // Check if this is a valid command
  if (!isValidCommand(body)) {
    return;
  }

  const isAdmin = isAdminCommand(body);

  try {
    // Permission Check
    const allowed = await checkGitLabPermissions(payload, accessToken);

    if (!allowed) {
      await sendGitLabErrorComment(
        payload,
        "❌ Reminder not created.\n\n" +
          "Only the issue author, project members, or contributors are permitted to create reminders for this issue.",
        accessToken
      );
      return;
    }

    // Extract command text
    const commandText = extractCommandText(body);

    // Validate reminder (includes rate limiting check)
    const parsed = await validateReminder({
      commandText,
      repo_id: payload.project.path_with_namespace,
      issue_number: payload.object_attributes.iid,
      skipRateLimit: isAdmin,
    });

    // Ensure Repository Exists (GitLab format)
    await ensureRepositoryExists({
      repository: {
        full_name: payload.project.path_with_namespace,
        owner: { login: payload.project.namespace },
      },
    });

    // Save Reminder with Retry
    const reminderData = {
      repo_id: payload.project.path_with_namespace,
      issue_number: payload.object_attributes.iid,
      message: `Scheduled reminder for @${payload.user.username} Please review when convenient.`,
      scheduled_at: parsed.remindAt,
      created_by: payload.user.username,
    };

    const reminder = await withRetry(
      () => createReminder(reminderData),
      3,
      1000
    );

    console.log(`[GitLab Mention] ✅ Reminder created: ${reminder.id}`);

    // Send confirmation comment
    await sendGitLabComment(
      payload,
      `Got it. I will remind you on **${parsed.remindAt.toLocaleString(
        "en-IN",
        { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }
      )}**.`,
      accessToken
    );
  } catch (error) {
    console.error("[GitLab Mention] ❌ Error:", {
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

    await sendGitLabErrorComment(payload, userMessage, accessToken);
  }
}
