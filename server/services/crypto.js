const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Standard for GCM

function encrypt(text) {
  const rawKey = process.env.NOTION_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error("NOTION_ENCRYPTION_KEY is not defined in environment.");
  }

  // Derive a 32-byte key from the raw key using SHA-256
  const key = crypto.createHash("sha256").update(rawKey).digest();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();

  // Return IV, auth tag, and encrypted payload as hex separated by colons
  return iv.toString("hex") + ":" + tag.toString("hex") + ":" + encrypted;
}

function decrypt(text) {
  const rawKey = process.env.NOTION_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error("NOTION_ENCRYPTION_KEY is not defined in environment.");
  }

  const key = crypto.createHash("sha256").update(rawKey).digest();
  const parts = text.split(":");
  if (parts.length < 3) {
    throw new Error("Invalid encrypted text format.");
  }

  const iv = Buffer.from(parts[0], "hex");
  const tag = Buffer.from(parts[1], "hex");
  const encryptedText = Buffer.from(parts[2], "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

module.exports = {
  encrypt,
  decrypt,
};
