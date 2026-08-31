import nodemailer, {
  type Transporter,
} from "nodemailer";

import { EMAIL_VERIFICATION_CODE_TTL_MINUTES } from "@/lib/email-verification-constants";
import { PASSWORD_RESET_CODE_TTL_MINUTES } from "@/lib/password-reset-constants";

type VerificationEmailInput = {
  email: string;
  name: string;
  code: string;
};

type PasswordResetEmailInput = VerificationEmailInput;

type SmtpConfiguration = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

export class EmailDeliveryConfigurationError extends Error {}

let transporter: Transporter | null = null;

function readSmtpConfiguration(): SmtpConfiguration {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(
    process.env.SMTP_PORT?.trim(),
  );
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM?.trim();

  if (
    !host ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65_535 ||
    !user ||
    !pass ||
    !from
  ) {
    throw new EmailDeliveryConfigurationError(
      "SMTP configuration is incomplete.",
    );
  }

  const secureValue =
    process.env.SMTP_SECURE?.trim().toLowerCase();

  return {
    host,
    port,
    secure:
      secureValue === "true" ||
      (!secureValue && port === 465),
    user,
    pass,
    from,
  };
}

export function assertEmailDeliveryConfigured() {
  readSmtpConfiguration();
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );
}

function getTransporter() {
  if (transporter) return transporter;

  const configuration =
    readSmtpConfiguration();

  transporter = nodemailer.createTransport({
    host: configuration.host,
    port: configuration.port,
    secure: configuration.secure,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    auth: {
      user: configuration.user,
      pass: configuration.pass,
    },
  });

  return transporter;
}

export async function sendEmailVerificationCode({
  email,
  name,
  code,
}: VerificationEmailInput) {
  const configuration =
    readSmtpConfiguration();
  const safeName = escapeHtml(name);
  const safeCode = escapeHtml(code);

  await getTransporter().sendMail({
    from: configuration.from,
    to: email,
    subject:
      "رمز تأكيد البريد الإلكتروني | النادي الهندسي للطلاب",
    text: [
      "النادي الهندسي للطلاب",
      "",
      `مرحبًا ${name}،`,
      "",
      `رمز التحقق الخاص بك هو: ${code}`,
      "",
      `ينتهي هذا الرمز خلال ${EMAIL_VERIFICATION_CODE_TTL_MINUTES} دقائق.`,
      "",
      "إذا لم تطلب إنشاء هذا الحساب، تجاهل الرسالة.",
    ].join("\n"),
    html: `<!doctype html>
      <html lang="ar" dir="rtl">
        <body style="margin:0;background:#f3f8fc;font-family:Arial,sans-serif;color:#08233f">
          <div style="max-width:560px;margin:32px auto;padding:0 16px">
            <div style="overflow:hidden;border:1px solid #d8e6f2;border-radius:24px;background:#ffffff;box-shadow:0 18px 45px rgba(8,35,63,.10)">
              <div style="padding:24px;background:linear-gradient(135deg,#08233f,#0f72dc);color:#ffffff">
                <strong style="font-size:20px">النادي الهندسي للطلاب</strong>
              </div>
              <div style="padding:28px">
                <p style="margin:0 0 14px;font-size:17px">مرحبًا ${safeName}،</p>
                <p style="margin:0 0 20px;line-height:1.8;color:#526b83">رمز التحقق الخاص بك هو:</p>
                <div dir="ltr" style="margin:0 auto 22px;padding:18px;border:1px solid #b9ddfa;border-radius:16px;background:#eef8ff;color:#0f72dc;text-align:center;font-size:34px;font-weight:800;letter-spacing:10px">${safeCode}</div>
                <p style="margin:0 0 10px;line-height:1.8;color:#526b83">ينتهي هذا الرمز خلال ${EMAIL_VERIFICATION_CODE_TTL_MINUTES} دقائق.</p>
                <p style="margin:0;line-height:1.8;color:#7b8fa3;font-size:13px">إذا لم تطلب إنشاء هذا الحساب، تجاهل الرسالة.</p>
              </div>
            </div>
          </div>
        </body>
      </html>`,
  });
}

export async function sendPasswordResetCode({
  email,
  name,
  code,
}: PasswordResetEmailInput) {
  const configuration = readSmtpConfiguration();
  const safeName = escapeHtml(name);
  const safeCode = escapeHtml(code);

  await getTransporter().sendMail({
    from: configuration.from,
    to: email,
    subject: "رمز استعادة كلمة المرور | النادي الهندسي للطلاب",
    text: [
      "النادي الهندسي للطلاب",
      "",
      `مرحبًا ${name}،`,
      "",
      `رمز استعادة كلمة المرور الخاص بك هو: ${code}`,
      "",
      `ينتهي هذا الرمز خلال ${PASSWORD_RESET_CODE_TTL_MINUTES} دقائق.`,
      "",
      "إذا لم تطلب استعادة كلمة المرور، تجاهل هذه الرسالة.",
    ].join("\n"),
    html: `<!doctype html>
      <html lang="ar" dir="rtl">
        <body style="margin:0;background:#f3f8fc;font-family:Arial,sans-serif;color:#08233f">
          <div style="max-width:560px;margin:32px auto;padding:0 16px">
            <div style="overflow:hidden;border:1px solid #d8e6f2;border-radius:24px;background:#ffffff;box-shadow:0 18px 45px rgba(8,35,63,.10)">
              <div style="padding:24px;background:linear-gradient(135deg,#08233f,#0f72dc);color:#ffffff">
                <strong style="font-size:20px">النادي الهندسي للطلاب</strong>
              </div>
              <div style="padding:28px">
                <p style="margin:0 0 14px;font-size:17px">مرحبًا ${safeName}،</p>
                <p style="margin:0 0 20px;line-height:1.8;color:#526b83">استخدم الرمز التالي لاستعادة كلمة المرور:</p>
                <div dir="ltr" style="margin:0 auto 22px;padding:18px;border:1px solid #b9ddfa;border-radius:16px;background:#eef8ff;color:#0f72dc;text-align:center;font-size:34px;font-weight:800;letter-spacing:10px">${safeCode}</div>
                <p style="margin:0 0 10px;line-height:1.8;color:#526b83">ينتهي هذا الرمز خلال ${PASSWORD_RESET_CODE_TTL_MINUTES} دقائق.</p>
                <p style="margin:0;line-height:1.8;color:#7b8fa3;font-size:13px">إذا لم تطلب استعادة كلمة المرور، تجاهل هذه الرسالة.</p>
              </div>
            </div>
          </div>
        </body>
      </html>`,
  });
}
