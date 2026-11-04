import test from "node:test";
import assert from "node:assert/strict";
import { decideGoogleSignIn } from "../src/utils/googleAuthRules.js";

const payload = { sub: "g1", email: "a@b.c", email_verified: true };

test("rejects a payload without sub or email", () => {
  assert.equal(decideGoogleSignIn({ payload: {} }).action, "reject");
  assert.equal(decideGoogleSignIn({ payload: null }).action, "reject");
});

test("logs in a returning Google user by google_id", () => {
  const user = { google_id: "g1" };
  const r = decideGoogleSignIn({ payload, userByGoogleId: user });
  assert.equal(r.action, "login");
  assert.equal(r.user, user);
});

test("rejects an unverified Google email", () => {
  const r = decideGoogleSignIn({
    payload: { ...payload, email_verified: false },
    userByEmail: { isVerified: true },
  });
  assert.equal(r.action, "reject");
  assert.match(r.message, /not verified/);
});

test("creates a new user when the email is unknown", () => {
  assert.equal(decideGoogleSignIn({ payload }).action, "create");
});

test("links a verified local account and keeps its password", () => {
  const r = decideGoogleSignIn({ payload, userByEmail: { isVerified: true } });
  assert.equal(r.action, "link");
  assert.equal(r.resetPassword, false);
});

test("links an unverified local account and drops its password", () => {
  const r = decideGoogleSignIn({ payload, userByEmail: { isVerified: false } });
  assert.equal(r.action, "link");
  assert.equal(r.resetPassword, true);
});

test("rejects when the email belongs to another Google account", () => {
  const r = decideGoogleSignIn({
    payload,
    userByEmail: { isVerified: true, google_id: "other" },
  });
  assert.equal(r.action, "reject");
});
