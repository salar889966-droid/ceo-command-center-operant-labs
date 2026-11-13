import "dotenv/config";
import express from "express";
import morgan from "morgan";
import cors from "cors";
import hpp from "hpp";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth.routes.js";
import dashboardRouter from "./routes/dashboard.routes.js";
import approvalsRouter from "./routes/approvals.routes.js";
import meetingsRouter from "./routes/meetings.routes.js";
import notificationsRouter from "./routes/notifications.routes.js";
import { checkDatabase, closeDatabase } from "./db/db.js";

const app = express();
app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false);

const PORT = Number(process.env.PORT || 8000);
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function validateEnvironment() {
  const required = ["DATABASE_URL", "JWT_SECRET", "SERVICE_API_KEY", "FRONTEND_URL"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  if (Buffer.byteLength(process.env.JWT_SECRET) < 32) {
    throw new Error("JWT_SECRET must contain at least 32 bytes");
  }
  if (Buffer.byteLength(process.env.SERVICE_API_KEY) < 32) {
    throw new Error("SERVICE_API_KEY must contain at least 32 bytes");
  }
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-API-Key"],
  maxAge: 600,
}));

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(hpp());

app.use("/api", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 100 : 500,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
}));

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(cookieParser());

if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.status(200).json({ success: true, service: "ceo-command-center-api", status: "alive" });
});

app.get("/ready", async (_req, res) => {
  try {
    await checkDatabase();
    return res.status(200).json({ success: true, status: "ready", checks: { database: "ok" } });
  } catch {
    return res.status(503).json({ success: false, status: "not_ready", checks: { database: "failed" } });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/approvals", approvalsRouter);
app.use("/api/meetings", meetingsRouter);
app.use("/api/notifications", notificationsRouter);

app.use((_req, res) => res.status(404).json({ status: "error", message: "Route not found" }));

app.use((err, _req, res, _next) => {
  if (err?.name === "ZodError") {
    return res.status(400).json({
      status: "error",
      message: "Validation failed",
      errors: err.issues ?? err.errors ?? [],
    });
  }
  if (err?.message === "Origin is not allowed by CORS") {
    return res.status(403).json({ status: "error", message: "Origin not allowed" });
  }
  console.error("Unhandled request error:", err);
  return res.status(500).json({
    status: "error",
    message: "Something went wrong",
    ...(process.env.NODE_ENV === "development" ? { detail: err.message } : {}),
  });
});

let server;
async function start() {
  validateEnvironment();
  await checkDatabase();
  server = app.listen(PORT, () => {
    console.log(`CEO Command Center API listening on port ${PORT}`);
  });
}

async function shutdown(signal) {
  console.log(`${signal} received; shutting down gracefully`);
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await closeDatabase();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start().catch((error) => {
  console.error("Startup failed:", error.message);
  process.exit(1);
});

export default app;
