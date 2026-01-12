/**
 * File: mention.handler.js
 *
 * Purpose:
 * - Handles RepoReply commands posted as issue comments.
 * - Entry point for `/reporeply` commands.
 *
 * Features:
 * - Permission checks (author / repo member / org member / contributor)
 * - 5-minute rate limit per user per issue
 * - `/reporeply admin` bypasses rate limit only
 * - Natural language reminder parsing
 * - Minimum and maximum reminder time validation
 * - Professional, consistent bot responses
 */

import { parseReminder } from "../reminders/reminder.parser.js";
import {
  createReminder,
  hasRecentReminder,
} from "../reminders/reminder.service.js";

/**
 * Check whether a user is allowed to set reminders.
 */
async function isAllowedUser(payload, octokit) {
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
  } catch {}

  // Org member
  if (payload.repository.owner.type === "Organization") {
    try {
      await octokit.orgs.checkMembershipForUser({
        org: owner,
        username: commenter,
      });
      return true;
    } catch {}
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
  } catch {}

  return false;
}

/**
 * Handle RepoReply commands from issue comments
 */
export async function handleMention(payload, octokit) {
  const body = payload.comment?.body;
  if (!body) return;

  const normalized = body.toLowerCase().trim();
  if (!normalized.startsWith("/reporeply")) return;

  const isAdminCommand = normalized.startsWith("/reporeply admin");

  /* -------------------- Permission Check -------------------- */

  const allowed = await isAllowedUser(payload, octokit);

  if (!allowed) {
    await octokit.issues.createComment({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.issue.number,
      body:
        "Reminder not created.\n\n" +
        "Only the issue author, repository collaborators, organization members, " +
        "or prior contributors are permitted to create reminders for this issue.",
    });
    return;
  }

  /* -------------------- Rate Limit (10 minutes) -------------------- */

  if (!isAdminCommand) {
    const limited = hasRecentReminder({
      repo: payload.repository.full_name,
      issue: payload.issue.number,
      user: payload.sender.login,
      minutes: 10,
    });

    if (limited) {
      await octokit.issues.createComment({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issue_number: payload.issue.number,
        body:
          "Reminder request limited.\n\n" +
          "A reminder was created recently for this issue. " +
          "Please wait at least 10 minutes before creating another reminder.",
      });
      return;
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
    await octokit.issues.createComment({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.issue.number,
      body:
        "Unable to create reminder.\n\n" +
        "The reminder format could not be understood.\n\n" +
        "Examples:\n" +
        "- /reporeply notify me tomorrow at 5pm\n" +
        "- /reporeply remind me in 10 minutes\n" +
        "- /reporeply alert me next Monday",
    });
    return;
  }

  /* -------------------- Minimum Reminder Time (5 minutes) -------------------- */

  const MIN_DELAY_MINUTES = 16; // internal buffer
  const DISPLAY_MINUTES = 15; // user-facing value
  const now = Date.now();
  const remindAtTime = new Date(parsed.remindAt).getTime();
  const minAllowedTime = now + MIN_DELAY_MINUTES * 60 * 1000;

  if (remindAtTime < minAllowedTime) {
    await octokit.issues.createComment({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.issue.number,
      body:
        "Reminder could not be scheduled.\n\n" +
        `Reminders must be scheduled at least ${DISPLAY_MINUTES} minutes in advance.\n\n` +
        "Please choose a later time and try again.",
    });
    return;
  }

  /* -------------------- Maximum Reminder Window (7 days) -------------------- */

  const MAX_DAYS_AHEAD = 8; // 7 days + 1 date
  const maxAllowedTime = now + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000;

  if (remindAtTime > maxAllowedTime) {
    await octokit.issues.createComment({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.issue.number,
      body:
        "Reminder could not be scheduled.\n\n" +
        "Reminders can only be created for up to 7 days in advance.\n\n" +
        "Please choose a date within the next week and try again.",
    });
    return;
  }

  /* -------------------- Save Reminder -------------------- */

  await createReminder({
    repo: payload.repository.full_name,
    issue: payload.issue.number,
    user: payload.sender.login,
    remindAt: parsed.remindAt,
    installationId: payload.installation.id,
  });

  /* -------------------- Confirmation -------------------- */

  await octokit.issues.createComment({
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    issue_number: payload.issue.number,
    body:
      "Reminder scheduled successfully.\n\n" +
      `You will be notified here on ${parsed.remindAt.toLocaleString()}.`,
  });
}
