import express from "express";
import { handleMention } from "../../webhooks/mention/index.js";
import { 
  validateGitLabWebhook,
  getGitLabAuthUrl,
  exchangeGitLabCode,
  getGitLabUser
} from "../../../services/gitlab.service.js";
import { prisma } from "../../lib/prisma.js";

const router = express.Router();

/**
 * GitLab OAuth - Initiate authorization
 * Redirects user to GitLab for authorization
 */
router.get("/authorize", (req, res) => {
  try {
    // Generate random state for CSRF protection
    const state = Math.random().toString(36).substring(7);
    
    // Store state in session or temporary storage
    // For now, we'll use a simple approach
    const authUrl = getGitLabAuthUrl(state);
    
    console.log("[GitLab] Redirecting to authorization URL");
    res.redirect(authUrl);
  } catch (error) {
    console.error("[GitLab] Authorization error:", error);
    res.status(500).json({ error: "Failed to initiate GitLab authorization" });
  }
});

/**
 * GitLab OAuth - Callback
 * Handles the OAuth callback from GitLab
 */
router.get("/callback", async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({ error: "Authorization code missing" });
    }

    console.log("[GitLab] Received OAuth callback");

    // Exchange code for access token
    const tokens = await exchangeGitLabCode(code);
    
    // Get user info
    const user = await getGitLabUser(tokens.access_token);

    console.log(`[GitLab] User authenticated: ${user.username}`);

    // Store tokens in database
    // You'll need to create a gitlab_tokens table or extend users table
    await prisma.users.upsert({
      where: { id: `gitlab-${user.id}` },
      update: {
        username: user.username,
        // Store tokens securely (consider encryption)
      },
      create: {
        id: `gitlab-${user.id}`,
        username: user.username,
        type: "gitlab_user",
      },
    });

    // Redirect to success page or dashboard
    res.redirect(`https://coderxrohan.engineer/dashboard?gitlab=connected&user=${user.username}`);
  } catch (error) {
    console.error("[GitLab] OAuth callback error:", error);
    res.redirect(`https://coderxrohan.engineer/dashboard?error=gitlab_auth_failed`);
  }
});

/**
 * GitLab Webhook Handler
 * Receives webhooks from GitLab for issue comments
 */
router.post("/webhook", async (req, res) => {
  try {
    const signature = req.headers["x-gitlab-token"];
    const payload = req.body;

    // Validate webhook signature
    if (!validateGitLabWebhook(payload, signature)) {
      console.error("[GitLab] Invalid webhook signature");
      return res.status(401).json({ error: "Invalid signature" });
    }

    // Only process note (comment) events on issues
    if (payload.object_kind !== "note") {
      return res.status(200).json({ message: "Event ignored" });
    }

    // Only process issue notes (not MR or commit comments)
    if (payload.object_attributes?.noteable_type !== "Issue") {
      return res.status(200).json({ message: "Not an issue comment" });
    }

    console.log(
      `[GitLab] Webhook received: ${payload.project?.path_with_namespace}#${payload.object_attributes?.iid}`
    );

    // Get access token for this project/user
    // For now, you can use a bot token or fetch from database
    const accessToken = process.env.GITLAB_BOT_TOKEN; // Add this to .env

    // Handle the mention asynchronously
    handleMention({
      provider: "gitlab",
      payload,
      accessToken,
    }).catch((err) => {
      console.error("[GitLab] Webhook handler error:", err);
    });

    // Respond immediately to GitLab
    res.status(200).json({ message: "Webhook received" });
  } catch (error) {
    console.error("[GitLab] Webhook processing error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Health check endpoint
 */
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    provider: "gitlab",
    timestamp: new Date().toISOString(),
    oauth_configured: !!(process.env.GITLAB_CLIENT_ID && process.env.GITLAB_CLIENT_SECRET),
  });
});

/**
 * Disconnect GitLab integration
 */
router.post("/disconnect", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID required" });
    }

    // Remove GitLab tokens from database
    await prisma.users.update({
      where: { id: `gitlab-${userId}` },
      data: {
        // Clear tokens
      },
    });

    res.json({ message: "GitLab integration disconnected" });
  } catch (error) {
    console.error("[GitLab] Disconnect error:", error);
    res.status(500).json({ error: "Failed to disconnect GitLab" });
  }
});

export default router;