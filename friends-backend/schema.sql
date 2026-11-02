-- Separate tables preserve any earlier installation.
CREATE TABLE IF NOT EXISTS social_users(id TEXT PRIMARY KEY,nickname TEXT NOT NULL,nickkey TEXT NOT NULL UNIQUE,authhash TEXT NOT NULL UNIQUE,created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS social_links(a TEXT NOT NULL REFERENCES social_users(id) ON DELETE CASCADE,b TEXT NOT NULL REFERENCES social_users(id) ON DELETE CASCADE,sender TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('pending','accepted')),created INTEGER NOT NULL,PRIMARY KEY(a,b),CHECK(a<b));
CREATE TABLE IF NOT EXISTS social_invites(hash TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES social_users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS social_presence(owner TEXT PRIMARY KEY REFERENCES social_users(id) ON DELETE CASCADE,room TEXT NOT NULL,studying INTEGER NOT NULL,weekkey TEXT NOT NULL,seconds INTEGER NOT NULL,updated INTEGER NOT NULL,snapshot TEXT,asleep TEXT);
CREATE TABLE IF NOT EXISTS social_widgets(hash TEXT PRIMARY KEY,viewer TEXT NOT NULL REFERENCES social_users(id) ON DELETE CASCADE,target TEXT NOT NULL REFERENCES social_users(id) ON DELETE CASCADE,created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS social_limits(key TEXT PRIMARY KEY,minute INTEGER NOT NULL,hits INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS social_links_b ON social_links(b);
CREATE INDEX IF NOT EXISTS social_widgets_pair ON social_widgets(viewer,target);
