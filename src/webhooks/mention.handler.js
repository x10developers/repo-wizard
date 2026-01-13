import { parseReminder } from "../reminders/reminder.parser.js";
import {
  createReminder,
  hasRecentReminder,
} from "../reminders/reminder.service.js";
import { ensureRepositoryExists } from "../utils/repository.helper.js";
import { ValidationError, withRetry } from "../utils/errors.js";
import {
  postGitLabComment,
  hasGitLabPermission,
  getGitLabIssueAuthor,
  isGitLabContributor,
} from "../services/gitlab.service.js";

/**
 * Check whether a user is allowed to set reminders (GitHub)
 */
async function isAllowedUserGitHub(payload, octokit) {
  const commenter = payload.sender.login;
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const issueAuthor = payload.issue.user.login;

  if (commenter === issueAuthor) return true;
  if (commenter === owner) return true;

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
    // Permission check failed
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

    if (commits.data.length > 0) return true;
  } catch (err) {
    // Not a contributor
  }

  return false;
}

/**
 * Check whether a user is allowed to set reminders (GitLab)
 */
async function isAllowedUserGitLab(payload, accessToken) {
  const commenter = payload.user.username;
  const projectId = payload.project.id;
  const issueAuthor = await getGitLabIssueAuthor({
    projectId,
    issueIid: payload.object_attributes.iid,
    accessToken,
  });

  // Issue author can always set reminders
  if (commenter === issueAuthor) return true;

  // Check if user is project member with sufficient permissions
  const hasPerm = await hasGitLabPermission({
    projectId,
    username: commenter,
    accessToken,
  });
  if (hasPerm) return true;

  // Check if user is a contributor
  const isContrib = await isGitLabContributor({
    projectId,
    username: commenter,
    accessToken,
  });
  if (isContrib) return true;

  return false;
}

/**
 * Send error comment (GitHub)
 */
async function sendErrorCommentGitHub(octokit, payload, message) {
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
 * Send error comment (GitLab)
 */
async function sendErrorCommentGitLab(payload, message, accessToken) {
  try {
    await postGitLabComment({
      projectId: payload.project.id,
      issueIid: payload.object_attributes.iid,
      message,
      accessToken,
    });
  } catch (err) {
    console.error("[GitLab] Failed to post error comment:", err.message);
  }
}

/**
 * Handle RepoReply commands from GitHub issue comments
 */
async function handleGitHubMention(payload, octokit) {
  console.log(
    `\n[GitHub Mention] Processing: ${payload.repository.full_name}#${payload.issue.number}`
  );

  const body = payload.comment?.body;
  if (!body) return;

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
    // Permission Check
    const allowed = await isAllowedUserGitHub(payload, octokit);

    if (!allowed) {
      await sendErrorCommentGitHub(
        octokit,
        payload,
        "❌ Reminder not created.\n\n" +
          "Only the issue author, repository collaborators, organization members, " +
          "or prior contributors are permitted to create reminders for this issue."
      );
      return;
    }

    // Rate Limit (10 minutes)
    if (!isAdminCommand) {
      try {
        const limited = await hasRecentReminder({
          repo_id: payload.repository.full_name,
          issue_number: payload.issue.number,
          minutes: 10,
        });

        if (limited) {
          await sendErrorCommentGitHub(
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
      }
    }

    // Prepare Command for Parsing
    const commandText = body
      .replace(/^\/reporeply\s+admin/i, "")
      .replace(/^\/reporeply/i, "")
      .trim();

    // Parse Reminder
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

    // Minimum Reminder Time (15 minutes)
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

    // Maximum Reminder Window (7 days)
    const MAX_DAYS_AHEAD = 8;
    const maxAllowedTime = now + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000;

    if (remindAtTime > maxAllowedTime) {
      throw new ValidationError(
        "📅 Reminder could not be scheduled.\n\n" +
          "Reminders can only be created for up to 7 days in advance.\n\n" +
          "Please choose a date within the next week and try again."
      );
    }

    // Ensure Repository Exists
    await ensureRepositoryExists(payload);

    // Save Reminder with Retry
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

    console.log(`[GitHub Mention] ✅ Reminder created: ${reminder.id}`);

    // Confirmation
    await octokit.issues.createComment({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.issue.number,
      body: `Got it. I will remind you on **${parsed.remindAt.toLocaleString()}**.`,
    });
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

    await sendErrorCommentGitHub(octokit, payload, userMessage);
  }
}

/**
 * Handle RepoReply commands from GitLab issue comments
 */
async function handleGitLabMention(payload, accessToken) {
  console.log(
    `\n[GitLab Mention] Processing: ${payload.project.path_with_namespace}#${payload.object_attributes.iid}`
  );

  const body = payload.object_attributes?.note;
  if (!body) return;

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
    // Permission Check
    const allowed = await isAllowedUserGitLab(payload, accessToken);

    if (!allowed) {
      await sendErrorCommentGitLab(
        payload,
        "❌ Reminder not created.\n\n" +
          "Only the issue author, project members, or contributors are permitted to create reminders for this issue.",
        accessToken
      );
      return;
    }

    // Rate Limit (10 minutes)
    if (!isAdminCommand) {
      try {
        const limited = await hasRecentReminder({
          repo_id: payload.project.path_with_namespace,
          issue_number: payload.object_attributes.iid,
          minutes: 10,
        });

        if (limited) {
          await sendErrorCommentGitLab(
            payload,
            "⏱️ Reminder request limited.\n\n" +
              "A reminder was created recently for this issue. " +
              "Please wait at least 10 minutes before creating another reminder.",
            accessToken
          );
          return;
        }
      } catch (err) {
        console.error("[Error] Rate limit check failed:", err);
      }
    }

    // Prepare Command for Parsing
    const commandText = body
      .replace(/^\/reporeply\s+admin/i, "")
      .replace(/^\/reporeply/i, "")
      .trim();

    // Parse Reminder
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

    // Minimum Reminder Time (15 minutes)
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

    // Maximum Reminder Window (7 days)
    const MAX_DAYS_AHEAD = 8;
    const maxAllowedTime = now + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000;

    if (remindAtTime > maxAllowedTime) {
      throw new ValidationError(
        "📅 Reminder could not be scheduled.\n\n" +
          "Reminders can only be created for up to 7 days in advance.\n\n" +
          "Please choose a date within the next week and try again."
      );
    }

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
      message: `🔔 Reminder for @${payload.user.username}`,
      scheduled_at: parsed.remindAt,
      created_by: payload.user.username,
    };

    const reminder = await withRetry(
      () => createReminder(reminderData),
      3,
      1000
    );

    console.log(`[GitLab Mention] ✅ Reminder created: ${reminder.id}`);

    // Confirmation
    await postGitLabComment({
      projectId: payload.project.id,
      issueIid: payload.object_attributes.iid,
      message: `Got it. I will remind you on **${parsed.remindAt.toLocaleString()}**.`,
      accessToken,
    });
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

    await sendErrorCommentGitLab(payload, userMessage, accessToken);
  }
}

/**
 * Main handler - routes to GitHub or GitLab based on provider
 */
export async function handleMention({
  provider,
  payload,
  octokit,
  accessToken,
}) {
  if (provider === "github") {
    return handleGitHubMention(payload, octokit);
  } else if (provider === "gitlab") {
    return handleGitLabMention(payload, accessToken);
  } else {
    console.error(`[Mention] Unknown provider: ${provider}`);
  }
}
