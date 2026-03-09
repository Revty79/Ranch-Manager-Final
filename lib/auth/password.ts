import bcrypt from "bcryptjs";

const PASSWORD_SALT_ROUNDS = 12;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
