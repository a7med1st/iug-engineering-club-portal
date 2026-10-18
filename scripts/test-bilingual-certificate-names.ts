import assert from "node:assert/strict";
import { certificateNameError, certificateNameLanguage, certificateNamesFromAnswers, CERTIFICATE_NAME_QUESTIONS } from "../lib/certificate-names";
import { certificateLanguage, certificateTemplateForm } from "../lib/certificate-language";

assert.equal(certificateLanguage(null), "ar");
assert.equal(certificateLanguage("en"), "en");
assert.equal(certificateLanguage("fr"), null);
assert.equal(certificateNameLanguage(" الاسم باللغة الإنجليزية "), "en");
assert.equal(certificateNameError("ar", "أحمد محمد"), null);
assert.equal(certificateNameError("en", "Ahmad Mohammed"), null);
assert.ok(certificateNameError("en", "أحمد محمد"));
assert.ok(certificateNameError("ar", "Ahmad Mohammed"));
assert.ok(certificateNameError("en", " "));
assert.deepEqual(certificateNamesFromAnswers([
  { question: { label: CERTIFICATE_NAME_QUESTIONS.ar.label }, value: "أحمد محمد" },
  { question: { label: CERTIFICATE_NAME_QUESTIONS.en.label }, value: "Ahmad Mohammed" },
  { question: { label: "ما اسم مشروعك؟" }, value: "Other name" },
], "الاسم في الحساب"), { ar: "أحمد محمد", en: "Ahmad Mohammed" });
assert.deepEqual(certificateNamesFromAnswers([], "اسم سابق"), { ar: "اسم سابق", en: "" });
const data = new FormData();
data.set("activityId", "activity-1");
data.set("ar.nameX", "200");
data.set("en.nameX", "600");
data.set("ar.nameBold", "on");
assert.equal(certificateTemplateForm(data, "ar").get("nameX"), "200");
assert.equal(certificateTemplateForm(data, "en").get("nameX"), "600");
assert.equal(certificateTemplateForm(data, "en").has("nameBold"), false);
assert.equal(certificateTemplateForm(data, "en").get("activityId"), "activity-1");
console.log("Bilingual certificate name and form isolation tests passed.");
