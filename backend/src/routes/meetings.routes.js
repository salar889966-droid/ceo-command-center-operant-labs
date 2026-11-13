import express from "express";
import { addMeeting, getTodaysMeetings } from "../controllers/meetingController.js";
import { protect, protectService } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/", protectService, addMeeting);
router.get("/today", protect, getTodaysMeetings);

export default router;
