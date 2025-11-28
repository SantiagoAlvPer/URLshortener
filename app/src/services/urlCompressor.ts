const BASE62_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function encodeBase62(num: number): string {
  if (num === 0) return BASE62_CHARS[0]!;
  let result = "";
  while (num > 0) {
    result = BASE62_CHARS[num % 62] + result;
    num = Math.floor(num / 62);
  }
  return result;
}

export function decodeBase62(str: string): number {
  let result = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char) {
      result = result * 62 + BASE62_CHARS.indexOf(char);
    }
  }
  return result;
}

export function hashUrl(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return encodeBase62(Math.abs(hash));
}

export function generateShortId(length: number = 6): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  const combined = timestamp + random;
  let encoded = encodeBase62(combined);
  return encoded.slice(-length);
}

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    
    const essentialParams = new Set([
      'v', 'video', 'id', 'list', 'playlist', 'channel', 't', 'time',
      'post', 'article', 'page', 'product', 'item', 's', 'q', 'search'
    ]);
    
    const paramsToRemove = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'ref', 'source', 'campaign', 'si'
    ];
    
    paramsToRemove.forEach(param => {
      if (!essentialParams.has(param)) {
        parsed.searchParams.delete(param);
      }
    });
    
    return parsed.toString();
  } catch {
    return url;
  }
}

export function analyzeUrlCompression(url: string): {
  original: string;
  normalized: string;
  canCompress: boolean;
  savings: number;
} {
  const normalized = normalizeUrl(url);
  const canCompress = normalized.length < url.length;
  const savings = url.length - normalized.length;
  
  return {
    original: url,
    normalized,
    canCompress,
    savings
  };
}

export function createCompressedUrl(originalUrl: string, shortId: string): string {
  try {
    const parsed = new URL(originalUrl);
    const domain = `${parsed.protocol}//${parsed.host}`;
    return `${domain}/${shortId}`;
  } catch {
    return originalUrl;
  }
}