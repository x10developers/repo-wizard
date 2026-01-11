import express from "express";
import { getAdminMetrics } from "../../../lib/adminMetrics.js";

const router = express.Router();

// GET /admin/metrics
router.get("/", async (_req, res) => {
  const data = await getAdminMetrics();
  res.json(data);
});

export default router;
