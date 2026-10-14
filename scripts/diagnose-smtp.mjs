import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST?.trim();
console.log("Personal Gmail account:", /@(gmail\.com|googlemail\.com)$/i.test(process.env.SMTP_USER?.trim() ?? ""));
const port = Number(process.env.SMTP_PORT);
const secure = process.env.SMTP_SECURE?.trim().toLowerCase() === "true" || (!process.env.SMTP_SECURE?.trim() && port === 465);
console.log(JSON.stringify({ host: host ?? null, port: port || null, secure, credentialsConfigured: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS), senderConfigured: Boolean(process.env.SMTP_FROM) }));
if (!host || !port || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.error("SMTP configuration incomplete");
  process.exitCode = 1;
} else {
  const transport = nodemailer.createTransport({host, port, secure, auth: {user: process.env.SMTP_USER, pass: process.env.SMTP_PASS}, connectionTimeout:10000, greetingTimeout:10000, socketTimeout:15000});
  try { await transport.verify(); console.log("SMTP connection and authentication succeeded; no message sent."); }
  catch (error) { console.error(JSON.stringify({code:error.code,command:error.command,responseCode:error.responseCode})); process.exitCode = 1; }
  finally { transport.close(); }
}
