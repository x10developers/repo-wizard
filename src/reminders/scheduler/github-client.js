/**
 * scheduler/github-client.js
 *
 * Purpose: GitHub API client operations
 * Handles comment posting, rate limiting, and error classification
 */

import { Octokit } from "@octokit/rest";
import { getInstallationToken } from "./github-auth.js";
import { CONFIG } from "./config.js";
import {
  checkCircuitBreaker,
  recordSuccess,
  recordFailure,
} from "./circuit-breaker.js";

/* -------------------- Post GitHub Comment -------------------- */
export async function postGitHubComment({ repo, issueNumber, message }) {
  /* -------------------- Circuit Breaker Check -------------------- */
  checkCircuitBreaker("github");

  try {
    /* -------------------- Get GitHub Client -------------------- */
    const token = await getInstallationToken(repo);
    const octokit = new Octokit({ auth: token });

    /* -------------------- Check Rate Limit -------------------- */
    // Check rate limit
    const { data: rateLimit } = await octokit.rateLimit.get();
    const remaining = rateLimit.rate.remaining;

    if (remaining < CONFIG.GITHUB_RATE_LIMIT_BUFFER) {
      const resetTime = new Date(rateLimit.rate.reset * 1000);
      const waitMs = resetTime.getTime() - Date.now();

      console.warn(
        `[RateLimit] ${remaining} requests remaining. Reset: ${resetTime.toISOString()}`
      );

      if (waitMs > 0 && waitMs < 5 * 60 * 1000) {
        await new Promise((resolve) => setTimeout(resolve, waitMs + 1000));
      } else {
        throw new Error("TEMPORARY: GitHub rate limit exhausted");
      }
    }

    /* -------------------- Post Comment to GitHub -------------------- */
    // Post comment
    const [owner, repoName] = repo.split("/");
    await octokit.issues.createComment({
      owner,
      repo: repoName,
      issue_number: issueNumber,
      body: message,
    });

    recordSuccess("github");
    return { success: true };
  } catch (err) {
    /* -------------------- Error Handling & Classification -------------------- */
    recordFailure("github");

    // Classify errors
    if (err.status === 404 || err.status === 410) {
      throw new Error(`PERMANENT: Issue not found (${err.status})`);
    }
    if (err.status === 401 || err.status === 403) {
      throw new Error(`PERMANENT: Authentication failed (${err.status})`);
    }
    if (err.status === 429) {
      throw new Error("TEMPORARY: Rate limit exceeded");
    }

    throw err;
  }
}
