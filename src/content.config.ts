import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/**
 * Ranges live as markdown so the shop can edit a name or a guide
 * price without a deploy. Every range carries a CSS texture as its
 * fallback; `photo` takes over range by range as the shoot lands,
 * keeping the same 1:1 crop.
 */
const ranges = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/ranges" }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      /** Carpet | Laminate | Vinyl | Underlay */
      material: z.enum(["Carpet", "Laminate", "Vinyl", "Underlay"]),
      /** The spec line, in the fitter's words. */
      spec: z.string(),
      /** Guide price, £ per m², supply only. */
      price: z.number().positive(),
      /** Class 21/22/23 domestic, AC4/AC5 and Class 32/33 commercial. */
      grade: z.string(),
      rooms: z.array(
        z.enum(["Living", "Bedroom", "Stairs", "Hall", "Kitchen", "Bathroom"]),
      ),
      /** Roll widths in metres, or null when it is sold by area. */
      widths: z.array(z.number().positive()).nullable().default(null),
      /** Placeholder texture, used until there is a photograph. */
      pile: z.enum([
        "twist", "saxony", "loop", "stripe",
        "plank", "herring", "sheet", "foam",
      ]),
      colours: z.array(z.string()).min(1),
      /** 1:1 crop. When present it replaces the CSS texture. */
      photo: image().optional(),
      order: z.number().default(50),
      /** Position in the home banner's rotating floor. Omit to leave it out. */
      showcase: z.number().int().positive().optional(),
    }),
});

export const collections = { ranges };
