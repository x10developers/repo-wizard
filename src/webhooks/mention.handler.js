import { parseReminder } from "../reminders/reminder.parser.js";
import {
  createReminder,
  hasRecentReminder,
} from "../reminders/reminder.service.js";
import { ensureRepositoryExists } from "../utils/repository.helper.js";
import { ValidationError, withRetry } from "../utils/errors.js";

/**
 * Check whether a user is allowed to set reminders.
 */
async function isAllowedUser(payload, octokit) {
  const commenter = payload.sender.login;
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const issueAuthor = payload.issue.user.login;

  if (commenter === issueAuthor) {
    return true;
  }
  if (commenter === owner) {
    return true;
  }

  // Repo collaborator
  try {
    const { data } = await octokit.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username: commenter,
    });

    if (["admin", "maintain", "write", "triage"].includes(data.permission)) {
      return true;
    }
  } catch (err) {
    // Permission check failed - continue checking other methods
  }

  // Org member
  if (payload.repository.owner.type === "Organization") {
    try {
      await octokit.orgs.checkMembershipForUser({
        org: owner,
        username: commenter,
      });
      return true;
    } catch (err) {
      // Not an org member
    }
  }

  // Contributor
  try {
    const commits = await octokit.repos.listCommits({
      owner,
      repo,
      author: commenter,
      per_page: 1,
    });

    if (commits.data.length > 0) {
      return true;
    }
  } catch (err) {
    // Not a contributor
  }

  return false;
}

/**
 * Send error comment to GitHub issue
 */
async function sendErrorComment(octokit, payload, message) {
  try {
    await octokit.issues.createComment({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.issue.number,
      body: message,
    });
  } catch (err) {
    console.error("[GitHub] Failed to post error comment:", err.message);
  }
}

/**
 * Handle RepoReply commands from issue comments
 */
export async function handleMention(payload, octokit) {
  console.log(
    `\n[Mention] Processing: ${payload.repository.full_name}#${payload.issue.number}`
  );

  const body = payload.comment?.body;
  if (!body) {
    return;
  }


   /* -------------------- Mention Catch -------------------- */
  const normalized = body.toLowerCase().trim();
  const allowedPrefixes = [
    "/reporeply",
    "@reporeply",
    "reporeply",
    ".reporeply",
    ",reporeply",
    "#reporeply",
  ];

  if (!allowedPrefixes.some((prefix) => normalized.startsWith(prefix))) {
    return;
  }

  const isAdminCommand = normalized.startsWith("/reporeply admin");

  try {
    /* -------------------- Permission Check -------------------- */

    const allowed = await isAllowedUser(payload, octokit);

    if (!allowed) {
      await sendErrorComment(
        octokit,
        payload,
        "❌ Reminder not created.\n\n" +
          "Only the issue author, repository collaborators, organization members, " +
          "or prior contributors are permitted to create reminders for this issue."
      );
      return;
    }

    /* -------------------- Rate Limit (10 minutes) -------------------- */

    if (!isAdminCommand) {
      try {
        const limited = await hasRecentReminder({
          repo_id: payload.repository.full_name,
          issue_number: payload.issue.number,
          minutes: 10,
        });

        if (limited) {
          await sendErrorComment(
            octokit,
            payload,
            "⏱️ Reminder request limited.\n\n" +
              "A reminder was created recently for this issue. " +
              "Please wait at least 10 minutes before creating another reminder."
          );
          return;
        }
      } catch (err) {
        console.error("[Error] Rate limit check failed:", err);
        // Continue anyway - don't block on rate limit errors
      }
    }

    /* -------------------- Prepare Command for Parsing -------------------- */

    const commandText = body
      .replace(/^\/reporeply\s+admin/i, "")
      .replace(/^\/reporeply/i, "")
      .trim();

    /* -------------------- Parse Reminder -------------------- */

    const parsed = parseReminder(commandText);

    if (!parsed) {
      throw new ValidationError(
        "Unable to create reminder.\n\n" +
          "The reminder format could not be understood.\n\n" +
          "Examples:\n" +
          "- /reporeply notify me tomorrow at 5pm\n" +
          "- /reporeply remind me in 10 minutes\n" +
          "- /reporeply alert me next Monday"
      );
    }

    /* -------------------- Minimum Reminder Time (15 minutes) -------------------- */

    const MIN_DELAY_MINUTES = 16;
    const DISPLAY_MINUTES = 15;
    const now = Date.now();
    const remindAtTime = new Date(parsed.remindAt).getTime();
    const minAllowedTime = now + MIN_DELAY_MINUTES * 60 * 1000;

    if (remindAtTime < minAllowedTime) {
      throw new ValidationError(
        "⏰ Reminder could not be scheduled.\n\n" +
          `Reminders must be scheduled at least ${DISPLAY_MINUTES} minutes in advance.\n\n` +
          "Please choose a later time and try again."
      );
    }

    /* -------------------- Maximum Reminder Window (7 days) -------------------- */

    const MAX_DAYS_AHEAD = 8;
    const maxAllowedTime = now + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000;

    if (remindAtTime > maxAllowedTime) {
      throw new ValidationError(
        "📅 Reminder could not be scheduled.\n\n" +
          "Reminders can only be created for up to 7 days in advance.\n\n" +
          "Please choose a date within the next week and try again."
      );
    }

    /* -------------------- Ensure Repository Exists -------------------- */

    await ensureRepositoryExists(payload);

    /* -------------------- Save Reminder with Retry -------------------- */

    const reminderData = {
      repo_id: payload.repository.full_name,
      issue_number: payload.issue.number,
      message: `🔔 Reminder for @${payload.sender.login}`,
      scheduled_at: parsed.remindAt,
      created_by: payload.sender.login,
    };

    const reminder = await withRetry(
      () => createReminder(reminderData),
      3,
      1000
    );

    console.log(`[Mention] ✅ Reminder created: ${reminder.id}`);

    /* -------------------- Confirmation -------------------- */

    await octokit.issues.createComment({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.issue.number,
      body: `Got it. I will remind you on **${parsed.remindAt.toLocaleString()}**.`,
    });
  } catch (error) {
    console.error("[Mention] ❌ Error:", {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack,
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

    await sendErrorComment(octokit, payload, userMessage);
  }
}
