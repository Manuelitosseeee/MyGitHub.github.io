# Scheduled study reminders

Production Worker: `myguitarhub-study.guitarmurfs.workers.dev`.
D1 stores push subscriptions, a minimal study-plan snapshot, and an atomic delivery ledger. The frontend synchronizes after edits and on reconnection; the scheduler uses each device's time zone and selected weekdays. It sends one combined daily reminder and, when enabled, one incomplete-goal reminder three hours later. Changes made offline take effect on the server after reconnecting. Notifications require explicit browser permission; iOS requires an installed Home Screen PWA.

Install dependencies in this folder, generate bindings with `wrangler types`, apply `schema.sql`, and deploy with `wrangler deploy --keep-vars`. Configure `VAPID_PUBLIC` and the `VAPID_PRIVATE` secret in Cloudflare; never commit the private key. The existing production key must be kept across deployments or subscriptions must be renewed. Cron: `* * * * *`.

Local test: `wrangler dev --test-scheduled`; invoke `/__scheduled`. Planner/reminder tests: `node scripts/smart-study-tests.cjs` from the repository root. Delivery tests use a fake transport and never send messages to another person's device.

Routes: `GET /config`, `GET /health`, authenticated `POST /subscribe` and `POST /unsubscribe`. Tokens are generated per installation and stored hashed; endpoint ownership is enforced. External push destinations are restricted to supported browser push services. Deleted subscriptions are removed from D1; 404/410 delivery responses retire expired endpoints.
