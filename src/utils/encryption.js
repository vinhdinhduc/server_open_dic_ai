const crypto = require("crypto");

// Encryption configuration
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;

// Lấy khóa mã hóa từ môi trường hoặc tạo khóa mặc định
// QUAN TRỌNG: Trong production, BẮT BUỘC dùng khóa bảo mật từ biến môi trường
const getEncryptionKey = () => {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    console.warn(
      "  WARNING: ENCRYPTION_KEY not found in environment variables. Using default key (NOT SECURE FOR PRODUCTION)",
    );
    // Khóa mặc định chỉ dùng cho môi trường development - BẮT BUỘC đổi ở production
    return crypto.scryptSync("default-encryption-key-change-me", "salt", 32);
  }

  // Suy ra khóa 32-byte từ khóa đã cung cấp
  return crypto.scryptSync(key, "salt", 32);
};

/**
 * Encrypt sensitive data
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted string in format: iv:authTag:encryptedData
 */
const encrypt = (text) => {
  if (!text) return text;

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    // Định dạng trả về: iv:authTag:encryptedData
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
};

/**
 * Decrypt sensitive data
 * @param {string} encryptedText - Encrypted string in format: iv:authTag:encryptedData
 * @returns {string} - Decrypted plain text
 */
const decrypt = (encryptedText) => {
  if (!encryptedText) return encryptedText;

  // Kiểm tra chuỗi đã được mã hóa chưa (có dấu hai chấm)
  if (!encryptedText.includes(":")) {
    // Chưa mã hóa thì trả về nguyên bản (để tương thích ngược)
    return encryptedText;
  }

  try {
    const key = getEncryptionKey();
    const parts = encryptedText.split(":");

    if (parts.length !== 3) {
      throw new Error("Invalid encrypted data format");
    }

    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt data");
  }
};

/**
 * Mask sensitive data for display
 * @param {string} text - Text to mask
 * @param {number} visibleChars - Number of characters to show at start and end
 * @returns {string} - Masked text
 */
const maskSensitiveData = (text, visibleChars = 4) => {
  if (!text || text.length <= visibleChars * 2) {
    return "****";
  }

  const start = text.substring(0, visibleChars);
  const end = text.substring(text.length - visibleChars);
  const masked = "*".repeat(Math.min(text.length - visibleChars * 2, 20));

  return `${start}${masked}${end}`;
};

/**
 * Check if a string is encrypted
 * @param {string} text - Text to check
 * @returns {boolean} - True if encrypted
 */
const isEncrypted = (text) => {
  if (!text || typeof text !== "string") return false;

  // Kiểm tra định dạng: iv:authTag:encryptedData
  const parts = text.split(":");
  return (
    parts.length === 3 &&
    parts[0].length === IV_LENGTH * 2 &&
    parts[1].length === AUTH_TAG_LENGTH * 2
  );
};

/**
 * List of config keys that should be encrypted
 */
const SENSITIVE_KEYS = [
  "ai.apiKey",
  "email.password",
  "email.smtp_password",
  "oauth.client_secret",
  "payment.api_secret",
  "jwt.secret",
  "database.password",
];

/**
 * Check if a config key should be encrypted
 * @param {string} key - Config key to check
 * @returns {boolean} - True if should be encrypted
 */
const shouldEncrypt = (key) => {
  return SENSITIVE_KEYS.some(
    (sensitiveKey) =>
      key === sensitiveKey ||
      key.toLowerCase().includes("key") ||
      key.toLowerCase().includes("secret") ||
      key.toLowerCase().includes("password") ||
      key.toLowerCase().includes("token"),
  );
};

module.exports = {
  encrypt,
  decrypt,
  maskSensitiveData,
  isEncrypted,
  shouldEncrypt,
  SENSITIVE_KEYS,
};
