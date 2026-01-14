/**
 * Comment posting utilities for GitHub and GitLab
 */

import { postGitLabComment } from "../../../services/gitlab.service.js";

/**
 * Send a comment on a GitHub issue
 */
export async function sendGitHubComment(octokit, payload, message) {
  try {
    await octokit.issues.createComment({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.issue.number,
      body: message,
    });
  } catch (err) {
    console.error("[GitHub] Failed to post comment:", err.message);
    throw err;
  }
}

/**
 * Send an error comment on a GitHub issue
 */
export async function sendGitHubErrorComment(octokit, payload, message) {
  try {
    await sendGitHubComment(octokit, payload, message);
  } catch (err) {
    console.error("[GitHub] Failed to post error comment:", err.message);
  }
}

/**
 * Send a comment on a GitLab issue
 */
export async function sendGitLabComment(payload, message, accessToken) {
  try {
    await postGitLabComment({
      projectId: payload.project.id,
      issueIid: payload.object_attributes.iid,
      message,
      accessToken,
    });
  } catch (err) {
    console.error("[GitLab] Failed to post comment:", err.message);
    throw err;
  }
}

/**
 * Send an error comment on a GitLab issue
 */
export async function sendGitLabErrorComment(payload, message, accessToken) {
  try {
    await sendGitLabComment(payload, message, accessToken);
  } catch (err) {
    console.error("[GitLab] Failed to post error comment:", err.message);
  }
}
