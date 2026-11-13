import { timingSafeEqual } from "node:crypto";
import { verifyAccessToken } from "../auth/token.js";

function safeSecretMatch(provided, configured) {
  if (typeof provided !== "string" || typeof configured !== "string" || !configured) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(configured);
  return left.length === right.length && timingSafeEqual(left, right);
}

// Human session authentication only. A machine credential must never impersonate a CEO/admin.
export function protect(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing access token" });
  }

  try {
    const payload = verifyAccessToken(header.slice(7));
    if (!payload || typeof payload.sub !== "string" || !payload.sub) {
      return res.status(401).json({ error: "Invalid access token" });
    }
    req.user = { sub: payload.sub, role: payload.role ?? "user", authType: "user" };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired access token" });
  }
}

// Dedicated machine-to-machine authentication for trusted n8n callbacks.
// This identity is intentionally not an administrator and must only be mounted on
// explicitly selected integration endpoints.
export function protectService(req, res, next) {
  const provided = req.get("x-api-key");
  if (!safeSecretMatch(provided, process.env.SERVICE_API_KEY)) {
    return res.status(401).json({ error: "Invalid service credential" });
  }
  req.user = { sub: "service-account", role: "service", authType: "service" };
  return next();
}
