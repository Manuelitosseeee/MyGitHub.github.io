-- Dedicated D1 database for MyGuitarHub friends; apply once with wrangler d1 execute.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS friend_users (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  nickname_key TEXT NOT NULL UNIQUE,
  token_sha256 TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS friend_requests (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES friend_users(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES friend_users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  UNIQUE(sender_id, recipient_id)
);
CREATE INDEX IF NOT EXISTS friend_requests_recipient ON friend_requests(recipient_id);
CREATE TABLE IF NOT EXISTS friendships (
  user_a TEXT NOT NULL REFERENCES friend_users(id) ON DELETE CASCADE,
  user_b TEXT NOT NULL REFERENCES friend_users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(user_a, user_b),
  CHECK(user_a < user_b)
);
CREATE TABLE IF NOT EXISTS friend_invites (
  token_sha256 TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES friend_users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_by TEXT REFERENCES friend_users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS friend_invites_owner ON friend_invites(owner_id);
CREATE TABLE IF NOT EXISTS friend_presence (
  user_id TEXT PRIMARY KEY REFERENCES friend_users(id) ON DELETE CASCADE,
  room_json TEXT NOT NULL,
  studying INTEGER NOT NULL DEFAULT 0,
  week_key TEXT NOT NULL DEFAULT '',
  week_seconds INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS friend_rate_limits (
  key TEXT NOT NULL,
  minute INTEGER NOT NULL,
  hits INTEGER NOT NULL,
  PRIMARY KEY (key, minute)
);
