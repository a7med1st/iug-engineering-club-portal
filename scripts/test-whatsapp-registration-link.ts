import assert from "node:assert/strict";
import { normalizeWhatsAppRegistrationLink } from "../lib/whatsapp-registration-link";

assert.equal(normalizeWhatsAppRegistrationLink(""), null);
assert.equal(
  normalizeWhatsAppRegistrationLink(" https://chat.whatsapp.com/AbCd "),
  "https://chat.whatsapp.com/AbCd",
);
assert.equal(normalizeWhatsAppRegistrationLink("https://wa.me/970500000000"), "https://wa.me/970500000000");
assert.throws(() => normalizeWhatsAppRegistrationLink("https://chat.whatsapp.com.evil.test/invite"));
assert.throws(() => normalizeWhatsAppRegistrationLink("javascript:alert(1)"));
