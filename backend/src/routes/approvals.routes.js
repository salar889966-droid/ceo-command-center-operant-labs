import express from "express";
import { addApproval, getTodayApprovals, getAllApprovals, updateApprovalStatus } from "../controllers/approvals.controller.js";
import { protect, protectService } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", protect, getTodayApprovals);
router.get("/all", protect, getAllApprovals);
router.patch("/:id", protect, updateApprovalStatus);
// n8n may create approval requests, but its service identity cannot read or decide approvals.
router.post("/", protectService, addApproval);

export default router;
