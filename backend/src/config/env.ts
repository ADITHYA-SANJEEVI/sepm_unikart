import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  AUTH_OFF: z
    .string()
    .optional()
    .transform((value) => value === "1" || value === "true"),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  DEV_AUTH_BYPASS_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  DEV_AUTH_BYPASS_EMAILS: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  CHUTES_API_KEY: z.string().optional(),
  CHUTES_BASE_URL: z.string().url().default("https://llm.chutes.ai"),
  CHUTES_COMPLETIONS_PATH: z.string().default("/v1/chat/completions"),
  CHUTES_MODEL: z.string().default("deepseek-ai/DeepSeek-V3.2"),
  CHUTES_TIMEOUT_SECONDS: z.coerce.number().default(60),
  TOMTOM_API_KEY: z.string().optional(),
  TOMTOM_SEARCH_BASE_URL: z.string().url().default("https://api.tomtom.com"),
  TOMTOM_ROUTING_BASE_URL: z.string().url().default("https://api.tomtom.com"),
  TOMTOM_MAPS_BASE_URL: z.string().url().default("https://api.tomtom.com"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const fallbackBypassEmails = ["as8838@srmist.edu.in", "adithyasanjeevi08@gmail.com"];

const parsedBypassEmails = parsed.data.DEV_AUTH_BYPASS_EMAILS
  ? parsed.data.DEV_AUTH_BYPASS_EMAILS.split(",").map((email) => email.trim()).filter(Boolean)
  : fallbackBypassEmails;

export const env = {
  ...parsed.data,
  AUTH_OFF: parsed.data.AUTH_OFF === true,
  DEV_AUTH_BYPASS_ENABLED:
    parsed.data.NODE_ENV !== "production" && parsed.data.DEV_AUTH_BYPASS_ENABLED === true,
  DEV_AUTH_BYPASS_EMAILS: parsedBypassEmails,
};
