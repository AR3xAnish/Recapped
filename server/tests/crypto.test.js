const test = require("node:test");
const assert = require("node:assert");
require("dotenv").config();
const { encrypt, decrypt } = require("../services/crypto");

test("Crypto Service: Encrypt & Decrypt Flow", () => {
  const originalText = "xoxb-mock-bot-token-12345-abcde";

  // 1. Encryption returns a hex string or different text
  const encryptedText = encrypt(originalText);
  assert.ok(encryptedText);
  assert.notStrictEqual(encryptedText, originalText);

  // 2. Decryption recovers the original text
  const decryptedText = decrypt(encryptedText);
  assert.strictEqual(decryptedText, originalText);

  // 3. Decrypting modified cipher text throws an error
  assert.throws(() => {
    decrypt("invalid-encrypted-text");
  });
});
