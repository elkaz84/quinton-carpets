/// <reference types="astro/client" />

// Nothing to augment on App.Locals any more. The site runs on Vercel's
// Node runtime, so secrets are read from process.env through
// lib/server/env.ts and the database from lib/server/db.ts, rather
// than arriving on the request as platform bindings.
