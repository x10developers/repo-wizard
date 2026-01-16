/**
 * scheduler/github-auth.js
 *
 * Purpose: GitHub App authentication and token management
 * Handles JWT generation, installation tokens, and caching
 */

import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { Octokit } from "@octokit/rest";
import { prisma } from "../../lib/prisma.js";
import { CONFIG } from "./config.js";
import { state } from "./state.js";

/* -------------------- Installation Token Retrieval -------------------- */
export async function getInstallationToken(repoFullName) {
  /* -------------------- Check Token Cache -------------------- */
  // Check cache
  const cached = state.tokenCache.get(repoFullName);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  /* -------------------- Get Installation ID from Database -------------------- */
  // Get installation_id
  const repo = await prisma.repositories.findUnique({
    where: { id: repoFullName },
    select: { installation_id: true },
  });

  if (!repo?.installation_id) {
    throw new Error(
      `PERMANENT: No installation_id for repository ${repoFullName}`
    );
  }

  /* -------------------- Read Private Key -------------------- */
  // Read private key
  let privateKey;
  if (process.env.GITHUB_PRIVATE_KEY_PATH) {
    const keyPath = path.resolve(
      process.cwd(),
      process.env.GITHUB_PRIVATE_KEY_PATH
    );
    privateKey = fs.readFileSync(keyPath, "utf8");
  } else if (process.env.GITHUB_PRIVATE_KEY) {
    privateKey = process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, "\n");
  } else {
    throw new Error(
      "PERMANENT: No GITHUB_PRIVATE_KEY or GITHUB_PRIVATE_KEY_PATH found"
    );
  }

  /* -------------------- Generate JWT for GitHub App -------------------- */
  // Generate JWT
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 10,
    exp: now + 600,
    iss: process.env.GITHUB_APP_ID,
  };

  const token = jwt.sign(payload, privateKey, { algorithm: "RS256" });
  const appOctokit = new Octokit({ auth: token });

  /* -------------------- Get Installation Token -------------------- */
  // Get installation token
  const installationId = Number(repo.installation_id);
  const { data: installation } =
    await appOctokit.apps.createInstallationAccessToken({
      installation_id: installationId,
    });

  /* -------------------- Cache Token -------------------- */
  // Cache token
  state.tokenCache.set(repoFullName, {
    token: installation.token,
    expiresAt: Date.now() + CONFIG.TOKEN_CACHE_DURATION_MS,
  });

  return installation.token;
}
