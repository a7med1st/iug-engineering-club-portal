export const ALLOWED_EMAIL_DOMAINS = [
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
] as const;

export type EmailValidationFailureReason =
  | "INVALID_FORMAT"
  | "UNSUPPORTED_DOMAIN";

export type EmailValidationResult =
  | { valid: true; email: string }
  | {
      valid: false;
      email: string;
      reason: EmailValidationFailureReason;
    };

export const EMAIL_VALIDATION_MESSAGES: Record<
  EmailValidationFailureReason,
  string
> = {
  INVALID_FORMAT:
    "يرجى إدخال بريد إلكتروني صحيح.",
  UNSUPPORTED_DOMAIN:
    "يرجى استخدام بريد إلكتروني من مزود معتمد مثل Gmail أو Outlook.",
};

const allowedDomains = new Set<string>(
  ALLOWED_EMAIL_DOMAINS,
);

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hasValidEmailFormat(email: string) {
  if (!email || email.length > 254) {
    return false;
  }

  const firstAt = email.indexOf("@");
  const lastAt = email.lastIndexOf("@");

  if (
    firstAt <= 0 ||
    firstAt !== lastAt ||
    firstAt === email.length - 1
  ) {
    return false;
  }

  const localPart = email.slice(0, firstAt);
  const domain = email.slice(firstAt + 1);

  if (
    localPart.length > 64 ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..") ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(
      localPart,
    )
  ) {
    return false;
  }

  const domainLabels = domain.split(".");

  return (
    domainLabels.length >= 2 &&
    domainLabels.every(
      (label) =>
        label.length > 0 &&
        label.length <= 63 &&
        !label.startsWith("-") &&
        !label.endsWith("-") &&
        /^[a-z0-9-]+$/i.test(label),
    )
  );
}

export function isAllowedEmailDomain(email: string) {
  const normalized = normalizeEmail(email);
  const atIndex = normalized.lastIndexOf("@");

  if (
    atIndex <= 0 ||
    atIndex !== normalized.indexOf("@")
  ) {
    return false;
  }

  return allowedDomains.has(
    normalized.slice(atIndex + 1),
  );
}

export function validateEmail(
  email: string,
): EmailValidationResult {
  const normalized = normalizeEmail(email);

  if (!hasValidEmailFormat(normalized)) {
    return {
      valid: false,
      email: normalized,
      reason: "INVALID_FORMAT",
    };
  }

  if (!isAllowedEmailDomain(normalized)) {
    return {
      valid: false,
      email: normalized,
      reason: "UNSUPPORTED_DOMAIN",
    };
  }

  return {
    valid: true,
    email: normalized,
  };
}

export function getEmailValidationMessage(
  result: EmailValidationResult,
) {
  return result.valid
    ? null
    : EMAIL_VALIDATION_MESSAGES[result.reason];
}
