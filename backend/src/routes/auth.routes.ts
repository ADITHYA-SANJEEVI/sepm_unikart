import { Request, Response, Router } from "express";
import { env } from "../config/env";
import { requireAuth } from "../middleware/auth.middleware";
import { profileUpdateSchema } from "../lib/profile-update-schema";
import { adminOverrideConfig } from "../services/auth.service";
import { ensureProfileForAuthUser, updateOwnProfile } from "../services/platform.service";

export const authRouter = Router();

authRouter.get("/me", requireAuth, async (request, response) => {
  const profile = request.auth.user ? await ensureProfileForAuthUser(request.auth.user) : null;

  response.json({
    success: true,
    data: {
      user: request.auth.user,
      profile,
    },
  });
});

authRouter.get("/debug-bypass-status", (_request, response) => {
  const personaEmails = env.DEV_AUTH_BYPASS_EMAILS;
  response.json({
    success: true,
    data: {
      bypassEnabled: env.DEV_AUTH_BYPASS_ENABLED,
      bypassEmails: env.DEV_AUTH_BYPASS_EMAILS,
      adminOverrideHeader: adminOverrideConfig.headerName,
      testPersonas: [
        personaEmails[0]
          ? { key: "seller-demo", email: personaEmails[0], fullName: "Seller Demo", role: "seller" }
          : null,
        personaEmails[1]
          ? { key: "buyer-demo", email: personaEmails[1], fullName: "Buyer Demo", role: "buyer" }
          : null,
      ].filter(Boolean),
    },
  });
});

async function handleProfileUpdate(request: Request, response: Response) {
  const parseResult = profileUpdateSchema.safeParse(request.body);

  if (!parseResult.success || !request.auth.user) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_PROFILE_UPDATE",
        message: "A valid profile update payload is required.",
        details: parseResult.success ? undefined : parseResult.error.flatten(),
      },
    });
  }

  return response.json({
    success: true,
    data: await updateOwnProfile(request.auth.user, parseResult.data),
  });
}

authRouter.patch("/profile", requireAuth, handleProfileUpdate);
authRouter.post("/profile", requireAuth, handleProfileUpdate);
