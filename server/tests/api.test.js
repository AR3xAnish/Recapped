const test = require("node:test");
const assert = require("node:assert");
require("dotenv").config();
const http = require("node:http");
const app = require("../server");

test("API Endpoint Integration Tests", async (t) => {
  // Start server on an ephemeral port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://localhost:${port}`;

  // Test 1: Verify protected test endpoint fails without authorization
  await t.test("GET /api/protected-test should fail with 401 Access Denied", async () => {
    const res = await fetch(`${baseUrl}/api/protected-test`);
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.error, "Access denied. No authorization header provided.");
  });

  // Test 2: Verify non-existent public route returns 404
  await t.test("GET /invalid-route should return 404", async () => {
    const res = await fetch(`${baseUrl}/invalid-route`);
    assert.strictEqual(res.status, 404);
  });

  // Test 3: Verify notion callback returns redirection on missing state/parameters
  await t.test("GET /api/integrations/notion/callback returns 302 redirect", async () => {
    const res = await fetch(`${baseUrl}/api/integrations/notion/callback`, {
      redirect: "manual", // Prevent automatic following of redirects to inspect status
    });
    assert.strictEqual(res.status, 302);
    const location = res.headers.get("location");
    assert.ok(location.includes("/settings?error="));
  });

  // Close server and database connections
  const mongoose = require("mongoose");
  await mongoose.disconnect();
  global._mongooseConn = { conn: null, promise: null };
  await new Promise((resolve) => server.close(resolve));
});
