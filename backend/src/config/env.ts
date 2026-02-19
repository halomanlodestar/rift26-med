/** @format */

import z from "zod";

/** @format */
export const envSchema = z.object({
  PORT: z.string().default("3080"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

export const config = envSchema.parse(process.env);
