/**
 * Permission checking logic for GitHub and GitLab
 */

import {
  hasGitLabPermission,
  getGitLabIssueAuthor,
  isGitLabContributor,
} from "../../../services/gitlab.service.js";

/**
 * Check whether a user is allowed to set reminders (GitHub)
 */
export async function checkGitHubPermissions(payload, octokit) {
  const commenter = payload.sender.login;
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const issueAuthor = payload.issue.user.login;

  // Issue author can always set reminders
  if (commenter === issueAuthor) return true;

  // Repository owner can always set reminders
  if (commenter === owner) return true;

  // Check if user is a repository collaborator
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
    // Permission check failed, continue to next check
  }

  // Check if user is an organization member
  if (payload.repository.owner.type === "Organization") {
    try {
      await octokit.orgs.checkMembershipForUser({
        org: owner,
        username: commenter,
      });
      return true;
    } catch (err) {
      // Not an org member, continue to next check
    }
  }

  // Check if user is a contributor (has commits)
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
export async function checkGitLabPermissions(payload, accessToken) {
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
