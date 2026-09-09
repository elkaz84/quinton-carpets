/// <reference types="astro/client" />

// Imported rather than referenced globally: @cloudflare/workers-types
// declares its own Element and HTMLElement, and letting those into the
// global scope breaks every browser script in src/scripts.
import type { D1Database } from "@cloudflare/workers-types";

type Runtime = import("@astrojs/cloudflare").Runtime<{
  DB: D1Database;
  RESEND_API_KEY?: string;
  SHOP_EMAIL?: string;
  MAIL_FROM?: string;
  ADMIN_USER?: string;
  ADMIN_PASSWORD?: string;
}>;

// The import above makes this file a module, so the augmentation has
// to be declared global explicitly.
declare global {
  namespace App {
    interface Locals extends Runtime {}
  }
}

export {};
