// functions/api/friends/[[path]].ts
var json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
var fail = (message, status = 400) => json({ error: message }, status);
var now = () => Date.now();
var normalized = (value) => typeof value === "string" ? value.normalize("NFKC").trim() : "";
function nickname(value) {
  const nick = normalized(value);
  return /^[a-zA-Z0-9_]{3,20}$/.test(nick) ? nick : null;
}
var idPair = (a, b) => a < b ? [a, b] : [b, a];
async function digest(input) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(hash)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function bodyJson(request) {
  if (Number(request.headers.get("content-length") ?? 0) > 8192) throw new Error("Richiesta troppo grande.");
  const raw = await request.text();
  if (raw.length > 8192) throw new Error("Richiesta troppo grande.");
  return JSON.parse(raw);
}
async function authenticate(db, request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (gh1\.[a-zA-Z0-9_-]{43})$/)?.[1];
  if (!token) return null;
  return db.prepare("SELECT id,nickname,nickname_key FROM friend_users WHERE token_sha256=?").bind(await digest(token)).first();
}
async function throttled(db, request, route2, limit = 30) {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const key = await digest(ip + ":" + route2);
  const minute = Math.floor(now() / 6e4);
  await db.prepare("INSERT INTO friend_rate_limits(key,minute,hits) VALUES(?,?,1) ON CONFLICT(key,minute) DO UPDATE SET hits=hits+1").bind(key, minute).run();
  const row = await db.prepare("SELECT hits FROM friend_rate_limits WHERE key=? AND minute=?").bind(key, minute).first();
  return (row?.hits ?? 0) <= limit;
}
async function friends(db, id) {
  const rows = await db.prepare(`SELECT u.id,u.nickname,p.room_json,p.studying,p.week_key,p.week_seconds,p.updated_at
FROM friendships f JOIN friend_users u ON u.id=CASE WHEN f.user_a=? THEN f.user_b ELSE f.user_a END
LEFT JOIN friend_presence p ON p.user_id=u.id WHERE f.user_a=? OR f.user_b=? ORDER BY u.nickname_key`).bind(id, id, id).all();
  return rows.results.map((row) => ({ id: row.id, nickname: row.nickname, room: row.room_json ? JSON.parse(row.room_json) : null, studying: !!row.studying && now() - (row.updated_at ?? 0) < 45e3, weekKey: row.week_key, weekSeconds: row.week_seconds ?? 0, updatedAt: row.updated_at ?? 0 }));
}
async function connected(db, a, b) {
  const [x, y] = idPair(a, b);
  return !!await db.prepare("SELECT 1 AS ok FROM friendships WHERE user_a=? AND user_b=?").bind(x, y).first();
}
async function becomeFriends(db, a, b) {
  if (a === b) throw new Error("Non puoi aggiungere te stesso.");
  const [x, y] = idPair(a, b);
  await db.prepare("INSERT OR IGNORE INTO friendships(user_a,user_b,created_at) VALUES(?,?,?)").bind(x, y, now()).run();
  await db.prepare("DELETE FROM friend_requests WHERE (sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)").bind(a, b, b, a).run();
}
function safeRoom(room) {
  if (!room || typeof room !== "object" || Array.isArray(room)) return null;
  const p = room;
  const maps = ["home", "studio", "shop", "rehearsal", "stage"];
  const mapId = maps.includes(String(p.mapId)) ? p.mapId : "home";
  const owned = Array.isArray(p.owned) ? p.owned.filter((i) => typeof i === "string" && /^[a-z][a-z0-9:-]{0,40}$/.test(i)).slice(0, 120) : [];
  return { mapId, owned: [...new Set(owned)], lampOn: p.lampOn !== false, deskLightOn: p.deskLightOn !== false, fireOn: p.fireOn !== false, rainOn: p.rainOn !== false, activeMs: Math.max(0, Math.min(864e5, Math.floor(Number(p.activeMs) || 0))) };
}
async function route(ctx) {
  const db = ctx.env.FRIENDS_DB;
  if (!db) return fail("Database Amici non configurato su Cloudflare.", 503);
  const req = ctx.request, method = req.method.toUpperCase(), path = new URL(req.url).pathname.replace(/^\/api\/friends\/?/, "").replace(/\/$/, "");
  if (!["GET", "POST", "PATCH", "DELETE"].includes(method)) return fail("Metodo non consentito.", 405);
  if (method !== "GET" && req.headers.get("origin") && new URL(req.headers.get("origin")).origin !== new URL(req.url).origin) return fail("Origine non consentita.", 403);
  if (method === "POST" && path === "identity") {
    if (!await throttled(db, req, "identity", 8)) return fail("Troppe richieste, riprova tra un minuto.", 429);
    const payload = await bodyJson(req), name = nickname(payload.nickname), token = typeof payload.token === "string" ? payload.token : "";
    if (!name || !/^gh1\.[a-zA-Z0-9_-]{43}$/.test(token)) return fail("Nickname da 3 a 20 caratteri: lettere, numeri e _.", 400);
    const existing = await db.prepare("SELECT id FROM friend_users WHERE nickname_key=?").bind(name.toLowerCase()).first();
    if (existing) return fail("Questo nickname \xE8 gi\xE0 utilizzato.", 409);
    try {
      const id = crypto.randomUUID();
      await db.prepare("INSERT INTO friend_users(id,nickname,nickname_key,token_sha256,created_at) VALUES(?,?,?,?,?)").bind(id, name, name.toLowerCase(), await digest(token), now()).run();
      return json({ id, nickname: name }, 201);
    } catch {
      return fail("Nickname non disponibile. Riprova.", 409);
    }
  }
  const user = await authenticate(db, req);
  if (!user) return fail("Identit\xE0 non trovata su questo dispositivo. Imposta il tuo nickname.", 401);
  if (method === "GET" && path === "profile") return json({ id: user.id, nickname: user.nickname });
  if (method === "PATCH" && path === "profile") {
    const payload = await bodyJson(req), name = nickname(payload.nickname);
    if (!name) return fail("Il nickname deve contenere 3\u201320 lettere, numeri o _.");
    try {
      await db.prepare("UPDATE friend_users SET nickname=?, nickname_key=? WHERE id=?").bind(name, name.toLowerCase(), user.id).run();
      return json({ id: user.id, nickname: name });
    } catch {
      return fail("Questo nickname \xE8 gi\xE0 utilizzato.", 409);
    }
  }
  if (method === "GET" && path === "list") return json({ friends: await friends(db, user.id) });
  if (method === "GET" && path === "requests") {
    const r = await db.prepare("SELECT r.id,r.sender_id,r.recipient_id,u.nickname,r.created_at FROM friend_requests r JOIN friend_users u ON r.sender_id=u.id WHERE r.recipient_id=? ORDER BY r.created_at DESC").bind(user.id).all();
    return json({ requests: r.results });
  }
  if (method === "POST" && path === "requests") {
    if (!await throttled(db, req, "requests", 25)) return fail("Troppe richieste, riprova tra un minuto.", 429);
    const data = await bodyJson(req), name = nickname(data.nickname);
    if (!name) return fail("Inserisci un nickname valido.");
    const target = await db.prepare("SELECT id FROM friend_users WHERE nickname_key=?").bind(name.toLowerCase()).first();
    if (!target) return fail("Nessun utente trovato con questo nickname.", 404);
    if (target.id === user.id) return fail("Non puoi aggiungere te stesso.");
    if (await connected(db, user.id, target.id)) return fail("Siete gi\xE0 amici.", 409);
    if (await db.prepare("SELECT id FROM friend_requests WHERE sender_id=? AND recipient_id=?").bind(target.id, user.id).first()) return fail("Questa persona ti ha gi\xE0 inviato una richiesta: apri la posta.", 409);
    await db.prepare("INSERT OR IGNORE INTO friend_requests(id,sender_id,recipient_id,created_at) VALUES(?,?,?,?)").bind(crypto.randomUUID(), user.id, target.id, now()).run();
    return json({ sent: true });
  }
  const requestAction = path.match(/^requests\/([0-9a-f-]{36})\/(accept|decline)$/);
  if (method === "POST" && requestAction) {
    const row = await db.prepare("SELECT * FROM friend_requests WHERE id=? AND recipient_id=?").bind(requestAction[1], user.id).first();
    if (!row) return fail("Richiesta non trovata.", 404);
    if (requestAction[2] === "accept") await becomeFriends(db, user.id, row.sender_id);
    else await db.prepare("DELETE FROM friend_requests WHERE id=? AND recipient_id=?").bind(requestAction[1], user.id).run();
    return json({ ok: true });
  }
  if (method === "POST" && path === "invite") {
    if (!await throttled(db, req, "invite", 20)) return fail("Troppe richieste, riprova tra un minuto.", 429);
    const bytes = crypto.getRandomValues(new Uint8Array(24)), code = Array.from(bytes, (x) => x.toString(16).padStart(2, "0")).join("");
    await db.prepare("INSERT INTO friend_invites(token_sha256,owner_id,created_at,expires_at,used_by) VALUES(?,?,?,?,NULL)").bind(await digest(code), user.id, now(), now() + 7 * 864e5).run();
    return json({ url: new URL(`/?friend_invite=${code}`, req.url).toString(), expiresInDays: 7 });
  }
  if (method === "POST" && path === "accept-invite") {
    const data = await bodyJson(req), code = typeof data.code === "string" ? data.code : "";
    if (!/^[0-9a-f]{48}$/.test(code)) return fail("Link di invito non valido.");
    const hash = await digest(code);
    const invitation = await db.prepare("SELECT owner_id,expires_at,used_by FROM friend_invites WHERE token_sha256=?").bind(hash).first();
    if (!invitation || invitation.expires_at < now() || invitation.used_by) return fail("Questo invito \xE8 scaduto o \xE8 gi\xE0 stato utilizzato.", 410);
    if (invitation.owner_id === user.id) return fail("Non puoi accettare il tuo invito.");
    const applied = await db.prepare("UPDATE friend_invites SET used_by=? WHERE token_sha256=? AND used_by IS NULL AND expires_at>?").bind(user.id, hash, now()).run();
    if (!applied.meta?.changes) return fail("Invito gi\xE0 utilizzato.", 409);
    await becomeFriends(db, user.id, invitation.owner_id);
    return json({ ok: true, friendId: invitation.owner_id });
  }
  if (method === "DELETE" && /^friend\/[0-9a-f-]{36}$/.test(path)) {
    const friendId = path.split("/")[1], [a, b] = idPair(user.id, friendId);
    await db.prepare("DELETE FROM friendships WHERE user_a=? AND user_b=?").bind(a, b).run();
    await db.prepare("DELETE FROM friend_requests WHERE (sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)").bind(user.id, friendId, friendId, user.id).run();
    return json({ ok: true });
  }
  if (method === "GET" && /^friend\/[0-9a-f-]{36}$/.test(path)) {
    const id = path.split("/")[1];
    if (!await connected(db, user.id, id)) return fail("Non siete pi\xF9 amici.", 403);
    const f = (await friends(db, user.id)).find((row) => row.id === id);
    return f ? json({ friend: f }) : fail("Amico non trovato.", 404);
  }
  if (method === "POST" && path === "presence") {
    const data = await bodyJson(req), room = safeRoom(data.room), weekKey = typeof data.weekKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.weekKey) ? data.weekKey : "", weekSeconds = Math.max(0, Math.min(604800, Math.floor(Number(data.weekSeconds) || 0)));
    if (!room) return fail("Stato della stanza non valido.");
    const studying = data.studying === true;
    await db.prepare(`INSERT INTO friend_presence(user_id,room_json,studying,week_key,week_seconds,updated_at) VALUES(?,?,?,?,?,?)
 ON CONFLICT(user_id) DO UPDATE SET room_json=excluded.room_json,studying=excluded.studying,week_key=excluded.week_key,week_seconds=excluded.week_seconds,updated_at=excluded.updated_at`).bind(user.id, JSON.stringify(room), studying ? 1 : 0, weekKey, weekSeconds, now()).run();
    return json({ ok: true });
  }
  return fail("Funzione non trovata.", 404);
}
async function onRequest(context) {
  try {
    return await route(context);
  } catch (e) {
    if (e instanceof SyntaxError) return fail("JSON non valido.");
    if (e instanceof Error && e.message === "Richiesta troppo grande.") return fail(e.message, 413);
    console.error("friends-api", e);
    return fail("Errore temporaneo del servizio Amici.", 500);
  }
}
export {
  onRequest
};
