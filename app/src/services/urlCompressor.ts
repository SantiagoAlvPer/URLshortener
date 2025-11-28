const BASE62_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function encodeBase62(num: number): string {
  if (num === 0) return BASE62_CHARS[0]!;
  let result = "";
  while (num > 0) {
    result = BASE62_CHARS[num % 62] + result;
    num = Math.floor(num / 62);
  }
  return result;
}

export function generateShortId(length: number = 6): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  const combined = timestamp + random;
  let encoded = encodeBase62(combined);
  return encoded.slice(-length);
}
