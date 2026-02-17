export async function createJWT(payload: Record<string, unknown>, secret: string) {
  const enc = new TextEncoder();
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })).replace(/=|\+/g,"-").replace(/\//g,"_");
  const body   = btoa(JSON.stringify(payload)).replace(/=|\+/g,"-").replace(/\//g,"_");
  const data = `${header}.${body}`;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name:"HMAC", hash:"SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=|\+/g,"-").replace(/\//g,"_");
  return `${data}.${sigB64}`;
}
