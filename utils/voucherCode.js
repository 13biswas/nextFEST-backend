const { randomInt, createHmac } = require("node:crypto");

// 32 characters: 16 random characters provide 80 bits of entropy.
const VOUCHER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateVoucherCode() {
  return Array.from(
    { length: 16 },
    () => VOUCHER_ALPHABET[randomInt(VOUCHER_ALPHABET.length)],
  ).join("");
}

function hashVoucherCode(code) {
  const pepper = process.env.VOUCHER_CODE_PEPPER;

  if (!pepper) {
    throw new Error("VOUCHER_CODE_PEPPER is not configured");
  }

  return createHmac("sha256", pepper)
    .update(code.trim().toUpperCase())
    .digest("hex");
}

module.exports = { generateVoucherCode, hashVoucherCode };
