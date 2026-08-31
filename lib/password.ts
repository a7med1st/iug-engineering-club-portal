import bcrypt from "bcryptjs";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_BCRYPT_COST = 12;

export function validateNewPassword(
  password: string,
  confirmation: string,
) {
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    return `يجب أن تكون كلمة المرور بين ${PASSWORD_MIN_LENGTH} و${PASSWORD_MAX_LENGTH} حرفًا.`;
  }

  if (password !== confirmation) {
    return "كلمتا المرور غير متطابقتين.";
  }

  return null;
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, PASSWORD_BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
