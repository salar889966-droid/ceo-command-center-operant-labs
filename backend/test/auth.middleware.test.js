import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = "test-only-jwt-secret-that-is-at-least-32-bytes-long";
process.env.SERVICE_API_KEY = "test-only-service-secret-that-is-at-least-32-bytes-long";

const jwt = (await import("jsonwebtoken")).default;
const { protect, protectService } = await import("../src/middlewares/auth.middleware.js");

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("human authentication rejects requests without a bearer token", () => {
  const req = { headers: {} };
  const res = responseRecorder();
  let called = false;
  protect(req, res, () => { called = true; });
  assert.equal(called, false);
  assert.equal(res.statusCode, 401);
});

test("human authentication accepts a valid access token", () => {
  const token = jwt.sign({ sub: "user-123", role: "ceo" }, process.env.JWT_SECRET, { expiresIn: "1m" });
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = responseRecorder();
  let called = false;
  protect(req, res, () => { called = true; });
  assert.equal(called, true);
  assert.deepEqual(req.user, { sub: "user-123", role: "ceo", authType: "user" });
});

test("service authentication rejects missing or incorrect credentials", () => {
  const req = { get: () => "incorrect" };
  const res = responseRecorder();
  let called = false;
  protectService(req, res, () => { called = true; });
  assert.equal(called, false);
  assert.equal(res.statusCode, 401);
});

test("service authentication creates a non-admin service identity", () => {
  const req = { get: () => process.env.SERVICE_API_KEY };
  const res = responseRecorder();
  let called = false;
  protectService(req, res, () => { called = true; });
  assert.equal(called, true);
  assert.deepEqual(req.user, { sub: "service-account", role: "service", authType: "service" });
});

test("an x-api-key cannot authenticate a human route", () => {
  const req = { headers: { "x-api-key": process.env.SERVICE_API_KEY } };
  const res = responseRecorder();
  let called = false;
  protect(req, res, () => { called = true; });
  assert.equal(called, false);
  assert.equal(res.statusCode, 401);
});
