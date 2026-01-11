import { clerkClient } from "@clerk/clerk-sdk-node";

export async function clerkAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Missing auth token" });
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const session = await clerkClient.verifyToken(token);
    req.adminUser = session;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}
