CREATE TABLE IF NOT EXISTS social_users(id TEXT PRIMARY KEY,nickname TEXT NOT NULL COLLATE NOCASE UNIQUE,token_hash TEXT NOT NULL UNIQUE,created_at INTEGER NOT NULL,invite_hash TEXT UNIQUE,invite_expires INTEGER,presence TEXT,seen_at INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS social_links(id TEXT PRIMARY KEY,lo TEXT NOT NULL REFERENCES social_users(id),hi TEXT NOT NULL REFERENCES social_users(id),sender TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('pending','accepted')),created_at INTEGER NOT NULL,UNIQUE(lo,hi),CHECK(lo<hi));
CREATE INDEX IF NOT EXISTS social_links_hi ON social_links(hi,status);
CREATE INDEX IF NOT EXISTS social_links_lo ON social_links(lo,status);
CREATE TABLE IF NOT EXISTS social_widget_tokens(hash TEXT PRIMARY KEY,viewer TEXT NOT NULL,target TEXT NOT NULL,link_id TEXT NOT NULL REFERENCES social_links(id) ON DELETE CASCADE,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS social_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);
