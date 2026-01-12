import express from "express";
import { getAdminTrends } from "../../../lib/adminTrends.js";

const router = express.Router();

// GET /admin/trends?days=7
router.get("/", async (req, res) => {
  const days = Number(req.query.days || 7);
  const data = await getReminderTrends(days);
  res.json(data);
});

export default router;
