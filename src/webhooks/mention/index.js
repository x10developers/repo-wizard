/**
 * Main entry point for mention handling
 * Routes requests to GitHub or GitLab handlers
 */

import { handleGitHubMention } from "./github.handler.js";
import { handleGitLabMention } from "./gitlab.handler.js";

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
