/**
 * File: mention.handler.js (DEBUG VERSION)
 * This version has extensive logging to find the exact error
 */

import { parseReminder } from "../reminders/reminder.parser.js";
import {
  createReminder,
  hasRecentReminder,
} from "../reminders/reminder.service.js";
import { ensureRepositoryExists } from "../utils/repository.helper.js";

/**
 * Check whether a user is allowed to set reminders.
 */
async function isAllowedUser(payload, octokit) {
  console.log("[Debug] Checking permissions for user:", payload.sender.login);
  
  const commenter = payload.sender.login;
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const issueAuthor = payload.issue.user.login;

  if (commenter === issueAuthor) {
    console.log("[Debug] User is issue author - allowed");
    return true;
  }
  if (commenter === owner) {
    console.log("[Debug] User is repo owner - allowed");
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
      console.log("[Debug] User is collaborator - allowed");
      return true;
    }
  } catch (err) {
    console.log("[Debug] Collaborator check failed:", err.message);
  }

  // Org member
  if (payload.repository.owner.type === "Organization") {
    try {
      await octokit.orgs.checkMembershipForUser({
        org: owner,
        username: commenter,
      });
      console.log("[Debug] User is org member - allowed");
      return true;
    } catch (err) {
      console.log("[Debug] Org member check failed:", err.message);
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
      console.log("[Debug] User is contributor - allowed");
      return true;
    }
  } catch (err) {
    console.log("[Debug] Contributor check failed:", err.message);
  }

  console.log("[Debug] User not allowed");
  return false;
}

/**
 * Handle RepoReply commands from issue comments
 */
export async function handleMention(payload, octokit) {
  console.log("\n========== NEW MENTION RECEIVED ==========");
  console.log("[Debug] Repository:", payload.repository.full_name);
  console.log("[Debug] Issue:", payload.issue.number);
  console.log("[Debug] User:", payload.sender.login);
  console.log("[Debug] Comment body:", payload.comment?.body);
  
  const body = payload.comment?.body;
  if (!body) {
    console.log("[Debug] No comment body - skipping");
    return;
  }

  const normalized = body.toLowerCase().trim();
  if (!normalized.startsWith("/reporeply")) {
    console.log("[Debug] Not a /reporeply command - skipping");
    return;
  }

  const isAdminCommand = normalized.startsWith("/reporeply admin");
  console.log("[Debug] Is admin command:", isAdminCommand);

  /* -------------------- Permission Check -------------------- */

  const allowed = await isAllowedUser(payload, octokit);

  if (!allowed) {
    console.log("[Debug] Permission denied");
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
    console.log("[Debug] Checking rate limit...");
    try {
      const limited = await hasRecentReminder({
        repo_id: payload.repository.full_name,
        issue_number: payload.issue.number,
        minutes: 10,
      });

      console.log("[Debug] Rate limited:", limited);

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

  console.log("[Debug] Command text for parsing:", commandText);

  /* -------------------- Parse Reminder -------------------- */

  const parsed = parseReminder(commandText);
  console.log("[Debug] Parsed result:", parsed);

  if (!parsed) {
    console.log("[Debug] Parsing failed - invalid format");
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

  /* -------------------- Minimum Reminder Time (15 minutes) -------------------- */

  const MIN_DELAY_MINUTES = 16;
  const DISPLAY_MINUTES = 15;
  const now = Date.now();
  const remindAtTime = new Date(parsed.remindAt).getTime();
  const minAllowedTime = now + MIN_DELAY_MINUTES * 60 * 1000;

  console.log("[Debug] Current time:", new Date(now));
  console.log("[Debug] Reminder time:", new Date(remindAtTime));
  console.log("[Debug] Minimum allowed time:", new Date(minAllowedTime));

  if (remindAtTime < minAllowedTime) {
    console.log("[Debug] Reminder time too soon");
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

  const MAX_DAYS_AHEAD = 8;
  const maxAllowedTime = now + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000;

  console.log("[Debug] Maximum allowed time:", new Date(maxAllowedTime));

  if (remindAtTime > maxAllowedTime) {
    console.log("[Debug] Reminder time too far in future");
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

  /* -------------------- Ensure Repository Exists -------------------- */

  console.log("[Debug] Ensuring repository exists in database...");
  try {
    await ensureRepositoryExists(payload);
  } catch (error) {
    console.error("[Error] Failed to ensure repository exists:", error);
    await octokit.issues.createComment({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.issue.number,
      body:
        "❌ Failed to initialize repository.\n\n" +
        "Please contact the bot administrator.",
    });
    return;
  }

  /* -------------------- Save Reminder -------------------- */

  const reminderData = {
    repo_id: payload.repository.full_name,
    issue_number: payload.issue.number,
    message: `🔔 Reminder for @${payload.sender.login}`,
    scheduled_at: parsed.remindAt,
    created_by: payload.sender.login, // ✅ Track who created it
  };

  console.log("[Debug] Attempting to create reminder with data:", reminderData);

  try {
    const reminder = await createReminder(reminderData);
    
    console.log("[Success] ✅ Reminder created successfully!");
    console.log("[Success] Reminder ID:", reminder.id);
    console.log("[Success] Scheduled for:", reminder.scheduled_at);

    /* -------------------- Confirmation -------------------- */

    await octokit.issues.createComment({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.issue.number,
      body:
        "✅ Reminder scheduled successfully.\n\n" +
        `You will be notified here on **${parsed.remindAt.toLocaleString()}**.`,
    });
    
  } catch (error) {
    console.error("\n========== REMINDER CREATION FAILED ==========");
    console.error("[Error] Full error object:", error);
    console.error("[Error] Error name:", error.name);
    console.error("[Error] Error message:", error.message);
    console.error("[Error] Error stack:", error.stack);
    
    // Check for specific Prisma errors
    if (error.code) {
      console.error("[Error] Prisma error code:", error.code);
    }
    if (error.meta) {
      console.error("[Error] Prisma error meta:", error.meta);
    }
    
    console.error("========================================\n");
    
    await octokit.issues.createComment({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.issue.number,
      body:
        "❌ Failed to create reminder.\n\n" +
        `Error: ${error.message}\n\n` +
        "Please check the server logs and try again.",
    });
  }
}