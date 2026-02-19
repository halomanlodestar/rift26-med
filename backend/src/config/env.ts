/** @format */

import z from "zod";

/** @format */
export const envSchema = z.object({
  PORT: z.string().default("3080"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  GROQ_API_KEY: z.string().min(1, "GROQ_API_KEY is required"),
});

export const config = envSchema.parse(process.env);
