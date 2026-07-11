const crypto = require("crypto");

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

// Derive a 32-byte key from whatever string is configured (or fallback)
const rawKey =
  process.env.NOTION_ENCRYPTION_KEY || "recapped_default_notion_encryption_secret_key";
const ENCRYPTION_KEY = crypto.createHash("sha256").update(rawKey).digest();

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(text) {
  try {
    const textParts = text.split(":");
    const iv = Buffer.from(textParts.shift(), "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("[Crypto] Decryption failed, returning original text:", err.message);
    return text;
  }
}

module.exports = {
  encrypt,
  decrypt,
};
