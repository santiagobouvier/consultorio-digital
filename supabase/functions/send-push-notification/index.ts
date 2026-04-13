import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.4/cors";

/**
 * Send push notification to a user's registered devices.
 *
 * Body: { user_id, title, body, icon?, url? }
 *
 * VAPID keys regeneration:
 *   npx web-push generate-vapid-keys
 *   Then update VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT secrets.
 */

// ── Crypto helpers for Web Push ────────────────────────────────

function base64UrlDecode(s: string): Uint8Array {
  const padding = "=".repeat((4 - (s.length % 4)) % 4);
  const base64 = (s + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importVapidPrivateKey(base64url: string): Promise<CryptoKey> {
  const raw = base64UrlDecode(base64url);
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    d: base64UrlEncode(raw),
    x: "",
    y: "",
  };

  // We need to derive x,y from the public key. Instead, import as raw PKCS8 is complex.
  // Simpler: use JWK with d and derive from VAPID_PUBLIC_KEY.
  const pubRaw = base64UrlDecode(Deno.env.get("VAPID_PUBLIC_KEY")!);
  // Uncompressed point: 0x04 || x(32) || y(32)
  const x = base64UrlEncode(pubRaw.slice(1, 33));
  const y = base64UrlEncode(pubRaw.slice(33, 65));
  jwk.x = x;
  jwk.y = y;

  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function createVapidAuthHeader(audience: string, subject: string, privateKey: CryptoKey): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 12 * 3600, sub: subject };

  const encHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const encPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsigned = `${encHeader}.${encPayload}`;

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(unsigned)
  );

  // Convert DER signature to raw r||s (64 bytes)
  const derSig = new Uint8Array(sig);
  let rawSig: Uint8Array;

  if (derSig.length === 64) {
    rawSig = derSig;
  } else {
    // Parse DER: 0x30 <len> 0x02 <rlen> <r> 0x02 <slen> <s>
    let offset = 2; // skip 0x30 <len>
    offset++; // 0x02
    const rLen = derSig[offset++];
    const r = derSig.slice(offset, offset + rLen);
    offset += rLen;
    offset++; // 0x02
    const sLen = derSig[offset++];
    const s = derSig.slice(offset, offset + sLen);

    rawSig = new Uint8Array(64);
    rawSig.set(r.length > 32 ? r.slice(r.length - 32) : r, 32 - Math.min(r.length, 32));
    rawSig.set(s.length > 32 ? s.slice(s.length - 32) : s, 64 - Math.min(s.length, 32));
  }

  const token = `${unsigned}.${base64UrlEncode(rawSig)}`;
  const pubKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
  return `vapid t=${token}, k=${pubKey}`;
}

// ── ECDH + HKDF + AES-GCM payload encryption (RFC 8291) ─────

async function encryptPayload(
  p256dhBase64: string,
  authBase64: string,
  payload: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const userPublicKeyRaw = base64UrlDecode(p256dhBase64);
  const authSecret = base64UrlDecode(authBase64);
  const plaintext = new TextEncoder().encode(payload);

  // Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const localPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey("raw", localKeyPair.publicKey));

  // Import subscriber public key
  const userPublicKey = await crypto.subtle.importKey("raw", userPublicKeyRaw, { name: "ECDH", namedCurve: "P-256" }, false, []);

  // ECDH shared secret
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: userPublicKey }, localKeyPair.privateKey, 256));

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF extract + expand for auth info
  const authInfo = new Uint8Array([
    ...new TextEncoder().encode("WebPush: info\0"),
    ...userPublicKeyRaw,
    ...localPublicKeyRaw,
  ]);

  const prkKey = await crypto.subtle.importKey("raw", authSecret, { name: "HKDF" }, false, ["deriveBits"]);
  // IKM = shared_secret, salt = auth_secret → actually we need HKDF(salt=authSecret, ikm=sharedSecret)
  // Use HMAC-based approach
  const ikmKey = await crypto.subtle.importKey("raw", sharedSecret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);

  // PRK = HMAC-SHA-256(auth_secret, shared_secret)
  const prkHmacKey = await crypto.subtle.importKey("raw", authSecret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", prkHmacKey, sharedSecret));

  // IKM for content encryption
  const ikmInfoBytes = new Uint8Array([...authInfo, 1]);
  const ikmHmacKey = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const ikm = new Uint8Array(await crypto.subtle.sign("HMAC", ikmHmacKey, ikmInfoBytes));

  // Derive content encryption key and nonce using salt
  const cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");

  const prkSaltKey = await crypto.subtle.importKey("raw", salt, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk2 = new Uint8Array(await crypto.subtle.sign("HMAC", prkSaltKey, ikm));

  const prk2Key = await crypto.subtle.importKey("raw", prk2, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const cekFull = new Uint8Array(await crypto.subtle.sign("HMAC", prk2Key, new Uint8Array([...cekInfo, 1])));
  const cek = cekFull.slice(0, 16);

  const nonceFull = new Uint8Array(await crypto.subtle.sign("HMAC", prk2Key, new Uint8Array([...nonceInfo, 1])));
  const nonce = nonceFull.slice(0, 12);

  // Add padding delimiter (0x02 for final record)
  const paddedPlaintext = new Uint8Array([...plaintext, 2]);

  // Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, paddedPlaintext));

  // Build aes128gcm body: salt(16) || rs(4) || idLen(1) || keyId(65) || ciphertext
  const rs = 4096;
  const rsBytes = new Uint8Array(4);
  new DataView(rsBytes.buffer).setUint32(0, rs);

  const body = new Uint8Array([
    ...salt,
    ...rsBytes,
    localPublicKeyRaw.length,
    ...localPublicKeyRaw,
    ...encrypted,
  ]);

  return { ciphertext: body, salt, localPublicKey: localPublicKeyRaw };
}

// ── Main handler ─────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id, title, body: notifBody, icon, url } = await req.json();

    if (!user_id || !title || !notifBody) {
      return new Response(JSON.stringify({ error: "Missing user_id, title or body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: subs, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", user_id);

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No subscriptions found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vapidPrivateKey = await importVapidPrivateKey(Deno.env.get("VAPID_PRIVATE_KEY")!);
    const vapidSubject = Deno.env.get("VAPID_SUBJECT")!;

    const payload = JSON.stringify({
      title,
      body: notifBody,
      icon: icon || "/app-icon.svg",
      data: { url: url || "/" },
    });

    let sent = 0;
    const staleIds: string[] = [];

    for (const sub of subs) {
      try {
        const aud = new URL(sub.endpoint).origin;
        const authHeader = await createVapidAuthHeader(aud, vapidSubject, vapidPrivateKey);

        const { ciphertext } = await encryptPayload(sub.p256dh, sub.auth, payload);

        const res = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Encoding": "aes128gcm",
            "Content-Type": "application/octet-stream",
            TTL: "86400",
          },
          body: ciphertext,
        });

        if (res.status === 201 || res.status === 200) {
          sent++;
        } else if (res.status === 404 || res.status === 410) {
          staleIds.push(sub.id);
        } else {
          const errText = await res.text();
          console.error(`Push failed for ${sub.id}: ${res.status} ${errText}`);
        }
      } catch (err) {
        console.error(`Push error for ${sub.id}:`, err);
      }
    }

    // Clean up stale subscriptions
    if (staleIds.length > 0) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", staleIds);
    }

    return new Response(JSON.stringify({ sent, total: subs.length, cleaned: staleIds.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-push-notification error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
