import express from "express";

const router = express.Router();

// GET /admin/trends?days=7
router.get("/", async (req, res) => {
  try {
    
    // Try to import the function
    const { getAdminTrends } = await import("../../../lib/adminTrends.js");
    
    const days = Number(req.query.days || 7);
    
    const data = await getAdminTrends(days);
    
    res.json(data);
  } catch (error) {
    console.error("❌ Error in /admin/trends:", error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
});

export default router;