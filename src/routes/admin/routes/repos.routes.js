import express from "express";
import { getRepoMetrics } from "../../../lib/repoMetrics.js";

const router = express.Router();

router.get("/:repoId", async (req, res) => {
  const data = await getRepoMetrics(req.params.repoId);
  res.json(data);
});

export default router;
