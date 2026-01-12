import express from "express";
import { getAdminMetrics } from "../../../lib/adminMetrics.js";

console.log("✅ metrics.routes.js loaded");

const router = express.Router();

// GET /admin/metrics
router.get("/", async (_req, res) => {
  try {
    const data = await getAdminMetrics();
    res.json(data);
  } catch (error) {
    console.error("❌ Error in /admin/metrics:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;