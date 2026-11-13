import { z } from "zod";
import argon2 from "argon2";
import { eq, and, gt, count, sql } from "drizzle-orm";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { db } from "../db/db.js";
import { users, refreshTokens } from "../db/schema.js";
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_OPTIONS,
} from "../auth/token.js";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
});

function matchesSecret(provided, configured) {
  if (typeof provided !== "string" || typeof configured !== "string" || !configured) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(configured);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function issueTokenPairWithExecutor(executor, userId, role, meta = {}) {
  const accessToken = signAccessToken({ sub: userId, role });
  const { raw, hash, expiresAt } = generateRefreshToken();
  const familyId = randomUUID();
  await executor.insert(refreshTokens).values({
    userId, tokenHash: hash, familyId, expiresAt,
    ip: meta.ip, userAgent: meta.userAgent,
  });
  return { accessToken, refreshToken: raw };
}

async function issueTokenPair(userId, role = "user", meta = {}) {
  const accessToken = signAccessToken({ sub: userId, role });
  const { raw, hash, expiresAt } = generateRefreshToken();
  const familyId = randomUUID();

  await db.insert(refreshTokens).values({
    userId,
    tokenHash: hash,
    familyId,
    expiresAt,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return { accessToken, refreshToken: raw };
}

export async function register(req, res, next) {
  try {
    const { email, password } = credentialsSchema.parse(req.body);
    if (!matchesSecret(req.get("x-ceo-bootstrap-key"), process.env.CEO_BOOTSTRAP_KEY)) {
      return res.status(403).json({ error: "CEO bootstrap credential is missing or invalid" });
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const { accessToken, refreshToken } = await db.transaction(async (tx) => {
      // Serialize first-account bootstrap attempts across concurrent requests.
      await tx.execute(sql`select pg_advisory_xact_lock(714203119)`);
      const [userCount] = await tx.select({ value: count() }).from(users);
      if (Number(userCount.value) > 0) {
        const error = new Error("CEO bootstrap has already been completed");
        error.status = 409;
        throw error;
      }

      const [user] = await tx.insert(users).values({ email, passwordHash, role: "ceo" }).returning();
      const pair = await issueTokenPairWithExecutor(tx, user.id, user.role, {
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });
      return pair;
    });

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
    return res.status(201).json({
      accessToken,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = credentialsSchema.parse(req.body);
    const user = await db.query.users.findFirst({ where: eq(users.email, email) });
    const hashToCheck = user?.passwordHash ?? "$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHQ$dGVzdA";
    const valid = await argon2.verify(hashToCheck, password).catch(() => false);

    if (!user || !valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const { accessToken, refreshToken } = await issueTokenPair(user.id, user.role, {
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
    return res.json({
      accessToken,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const raw = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!raw) return res.status(401).json({ error: "No refresh token" });

    const tokenHash = hashToken(raw);
    const existing = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.tokenHash, tokenHash),
    });
    if (!existing || existing.expiresAt < new Date() || existing.revoked) {
      return res.status(401).json({ error: "Invalid, expired, or already-used refresh token" });
    }

    const user = await db.query.users.findFirst({ where: eq(users.id, existing.userId) });
    if (!user) return res.status(401).json({ error: "User no longer exists" });

    const { accessToken, refreshToken: newRaw } = await db.transaction(async (tx) => {
      // Conditional revoke is the concurrency gate: exactly one request can rotate this token.
      const [claimed] = await tx.update(refreshTokens)
        .set({ revoked: true })
        .where(and(
          eq(refreshTokens.id, existing.id),
          eq(refreshTokens.revoked, false),
          gt(refreshTokens.expiresAt, new Date()),
        ))
        .returning({ id: refreshTokens.id });

      if (!claimed) {
        const error = new Error("Refresh token has already been used");
        error.status = 401;
        throw error;
      }

      const access = signAccessToken({ sub: user.id, role: user.role });
      const { raw: replacement, hash, expiresAt } = generateRefreshToken();
      const [newToken] = await tx.insert(refreshTokens).values({
        userId: user.id,
        tokenHash: hash,
        familyId: existing.familyId,
        expiresAt,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      }).returning({ id: refreshTokens.id });

      await tx.update(refreshTokens)
        .set({ replacedBy: newToken.id })
        .where(eq(refreshTokens.id, existing.id));
      return { accessToken: access, refreshToken: replacement };
    });


