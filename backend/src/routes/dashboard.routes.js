import express from "express";
import { getDashboardStats, getLatestBriefing, addBriefing } from "../controllers/dashboard.controller.js";
import { protect, protectService } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/stats", protect, getDashboardStats);
router.get("/briefing", protect, getLatestBriefing);
// Executive briefing ingestion is an integration callback, not a public human endpoint.
router.post("/briefing", protectService, addBriefing);

export default router;
