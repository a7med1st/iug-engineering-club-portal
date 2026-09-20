import assert from "node:assert/strict";
import {
  getLoginGuideDevice,
  getLoginGuideStartStep,
  getLoginGuideStorageKey,
  shouldAutoStartLoginGuide,
} from "../lib/login-guide";

assert.equal(
  shouldAutoStartLoginGuide({ authenticated: false, completed: false }),
  true,
  "a new signed-out visitor should see the login guide",
);

assert.equal(
  shouldAutoStartLoginGuide({ authenticated: false, completed: true }),
  false,
  "the guide should not restart after completion",
);

assert.equal(
  shouldAutoStartLoginGuide({ authenticated: true, completed: false }),
  false,
  "signed-in visitors should not see the login guide",
);

assert.equal(
  getLoginGuideStartStep({ mobile: false, pathname: "/" }),
  "desktop-login",
  "desktop visitors should start at the visible login button",
);

assert.equal(
  getLoginGuideStartStep({ mobile: true, pathname: "/" }),
  "mobile-menu",
  "mobile visitors should start by opening the navigation menu",
);

assert.equal(
  getLoginGuideStartStep({ mobile: true, pathname: "/login" }),
  "portal",
  "visitors already on the login page should start with account type",
);

assert.equal(getLoginGuideDevice(390), "mobile", "phones should have their own guide state");
assert.equal(getLoginGuideDevice(820), "tablet", "tablets should have their own guide state");
assert.equal(getLoginGuideDevice(1440), "desktop", "laptops should have their own guide state");
assert.equal(
  getLoginGuideStorageKey("mobile"),
  "engineering-club-login-guide-completed:mobile",
  "finishing the desktop guide must not suppress the phone guide",
);

console.log("Login guide behavior tests passed.");
