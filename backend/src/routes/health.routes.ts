import { Router } from "express";
import { env } from "../config/env";

export const healthRouter = Router();

healthRouter.get("/", (_request, response) => {
  response.json({
    success: true,
    service: "unikart-backend",
    environment: env.NODE_ENV,
    authOff: env.AUTH_OFF,
    devAuthBypassEnabled: env.DEV_AUTH_BYPASS_ENABLED,
    devAuthBypassEmails: env.DEV_AUTH_BYPASS_EMAILS,
    timestamp: new Date().toISOString(),
  });
});
