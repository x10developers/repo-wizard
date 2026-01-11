import express from "express";

console.log("✅ admin.routes.js loaded");

import metricsRoutes from "./admin/routes/metrics.routes.js";
import trendsRoutes from "./admin/routes/trends.routes.js";
import reposRoutes from "./admin/routes/repos.routes.js";

const router = express.Router();

// /admin/metrics
router.use("/metrics", metricsRoutes);

// /admin/trends
router.use("/trends", trendsRoutes);

// /admin/repos/:repoId
router.use("/repos", reposRoutes);

export default router;
