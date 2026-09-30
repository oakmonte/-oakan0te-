import { expect, test } from "bun:test";
import {
  decryptWith,
  encryptWith,
  FieldEncryptionError,
  importFieldKey,
  isEncrypted,
} from "./field-encryption.server";

function randomKey(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
}

test("round-trips, including non-ASCII text", async () => {
  const keys = [await importFieldKey(randomKey())];
  const text = "Ẹ káàbọ̀ 👋 — ₦12,500";
  const sealed = await encryptWith(keys, text, "messages.body:a");
  expect(isEncrypted(sealed)).toBe(true);
  expect(sealed).not.toContain("káàbọ̀");
  expect(await decryptWith(keys, sealed, "messages.body:a")).toBe(text);
});

test("the same plaintext never encrypts to the same value twice", async () => {
  const keys = [await importFieldKey(randomKey())];
  const a = await encryptWith(keys, "0123456789", "ctx");
  const b = await encryptWith(keys, "0123456789", "ctx");
  expect(a).not.toBe(b);
});

test("a value moved to another row does not decrypt", async () => {
  const keys = [await importFieldKey(randomKey())];
  const sealed = await encryptWith(keys, "0123456789", "store_payout_accounts.account_number:A");
  await expect(
    decryptWith(keys, sealed, "store_payout_accounts.account_number:B"),
  ).rejects.toBeInstanceOf(FieldEncryptionError);
});

test("tampered ciphertext is rejected", async () => {
  const keys = [await importFieldKey(randomKey())];
  const sealed = await encryptWith(keys, "secret", "ctx");
  // A character from the middle of the ciphertext: the last base64 character
  // can carry only padding bits, so changing it may not change a byte.
  const at = sealed.lastIndexOf(":") + 4;
  const swapped = sealed[at] === "A" ? "B" : "A";
  const tampered = sealed.slice(0, at) + swapped + sealed.slice(at + 1);
  await expect(decryptWith(keys, tampered, "ctx")).rejects.toBeInstanceOf(FieldEncryptionError);
});

test("old keys still decrypt after rotation; new writes use the new key", async () => {
  const oldKey = await importFieldKey(randomKey());
  const newKey = await importFieldKey(randomKey());
  const written = await encryptWith([oldKey], "token", "ctx");
  const rotated = [newKey, oldKey];
  expect(await decryptWith(rotated, written, "ctx")).toBe("token");
  const rewritten = await encryptWith(rotated, "token", "ctx");
  expect(rewritten.split(":")[2]).toBe(newKey.id);
  await expect(decryptWith([newKey], written, "ctx")).rejects.toBeInstanceOf(FieldEncryptionError);
});

test("legacy plaintext passes through unchanged", async () => {
  const keys = [await importFieldKey(randomKey())];
  expect(await decryptWith(keys, "shpat_legacy", "ctx")).toBe("shpat_legacy");
});

test("rejects a key of the wrong length", async () => {
  await expect(importFieldKey(btoa("too short"))).rejects.toBeInstanceOf(FieldEncryptionError);
});
