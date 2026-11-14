// Enable Banking authentication: a JWT signed with the application's private key
// (RS256, kid = application id, at most 24 h valid). Accepts PKCS#8 keys
// ("BEGIN PRIVATE KEY") and PKCS#1 keys ("BEGIN RSA PRIVATE KEY", e.g. from openssl genrsa).

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlText = (s: string) => b64url(new TextEncoder().encode(s));

function pemBytes(pem: string): { der: Uint8Array; pkcs1: boolean } {
  const pkcs1 = /BEGIN RSA PRIVATE KEY/.test(pem);
  const body = pem.replace(/-----(BEGIN|END)[^-]+-----/g, "").replace(/\s+/g, "");
  return { der: Uint8Array.from(atob(body), c => c.charCodeAt(0)), pkcs1 };
}

/** DER length bytes */
function derLen(n: number): number[] {
  if (n < 0x80) return [n];
  const out: number[] = [];
  while (n > 0) { out.unshift(n & 0xff); n >>= 8; }
  return [0x80 | out.length, ...out];
}

/** Wraps a PKCS#1 RSA key ("BEGIN RSA PRIVATE KEY", e.g. from openssl genrsa) into PKCS#8 for WebCrypto */
function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  const algId = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const octet = [0x04, ...derLen(pkcs1.length), ...pkcs1];
  const body = [0x02, 0x01, 0x00, ...algId, ...octet];
  return new Uint8Array([0x30, ...derLen(body.length), ...body]);
}

export async function signJwt(appId: string, privateKeyPem: string): Promise<string> {
  const { der, pkcs1 } = pemBytes(privateKeyPem);
  const key = await crypto.subtle.importKey("pkcs8", (pkcs1 ? pkcs1ToPkcs8(der) : der) as BufferSource,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const head = b64urlText(JSON.stringify({ typ: "JWT", alg: "RS256", kid: appId }));
  const body = b64urlText(JSON.stringify({ iss: "enablebanking.com", aud: "api.enablebanking.com", iat: now, exp: now + 3600 }));
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${body}`)));
  return `${head}.${body}.${b64url(sig)}`;
}
