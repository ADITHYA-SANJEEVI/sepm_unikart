import { randomUUID } from "node:crypto";
import type { AuthUser } from "../types/auth";
import { env } from "../config/env";
import { getSupabaseAdminClient } from "../lib/supabase";

const SRM_KTR_CAMPUS_ID = "srm-ktr";
const ADMIN_OVERRIDE_SECRET = "Arceus@123";
const ADMIN_OVERRIDE_HEADER = "x-admin-override";

function buildOverrideAdminUser(): AuthUser {
  return {
    id: "override-admin-arceus",
    email: "override-admin@unikart.local",
    fullName: "Arceus Override Admin",
    role: "admin",
    campusId: SRM_KTR_CAMPUS_ID,
    isVerified: true,
    isBypassUser: true,
  };
}

function buildAuthOffUser(): AuthUser {
  return {
    id: "auth-off-admin",
    email: "auth-off-admin@unikart.local",
    fullName: "Auth Off Admin",
    role: "admin",
    campusId: SRM_KTR_CAMPUS_ID,
    isVerified: true,
    isBypassUser: true,
  };
}

function buildBypassUser(email: string): AuthUser {
  return {
    id: `bypass-${email}`,
    email,
    fullName: email.split("@")[0],
    role: "buyer",
    campusId: SRM_KTR_CAMPUS_ID,
    isVerified: true,
    isBypassUser: true,
  };
}

function extractBearerToken(authorizationHeader?: string): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

async function getSupabaseUserFromToken(token: string): Promise<AuthUser | null> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user?.email) {
    return null;
  }

  return {
    id: data.user.id ?? randomUUID(),
    email: data.user.email,
    fullName:
      (data.user.user_metadata.full_name as string | undefined) ??
      (data.user.user_metadata.name as string | undefined) ??
      data.user.email.split("@")[0],
    role: "buyer",
    campusId: SRM_KTR_CAMPUS_ID,
    isVerified: !!data.user.email_confirmed_at,
    isBypassUser: false,
  };
}

export async function resolveAuthUser(request: {
  headers: Record<string, string | string[] | undefined>;
}): Promise<AuthUser | null> {
  if (env.AUTH_OFF) {
    return buildAuthOffUser();
  }

  const overrideHeader = request.headers[ADMIN_OVERRIDE_HEADER];
  const overrideSecret =
    typeof overrideHeader === "string" ? overrideHeader : Array.isArray(overrideHeader) ? overrideHeader[0] : undefined;

  if (overrideSecret === ADMIN_OVERRIDE_SECRET) {
    return buildOverrideAdminUser();
  }

  const bypassHeader = request.headers["x-dev-auth-email"];
  const bypassEmail =
    typeof bypassHeader === "string" ? bypassHeader.trim().toLowerCase() : undefined;
  const bypassRoleHeader = request.headers["x-dev-auth-role"];
  const bypassNameHeader = request.headers["x-dev-auth-name"];
  const bypassRole =
    typeof bypassRoleHeader === "string" && ["buyer", "seller"].includes(bypassRoleHeader)
      ? (bypassRoleHeader as "buyer" | "seller")
      : "buyer";
  const bypassName = typeof bypassNameHeader === "string" ? bypassNameHeader.trim() : "";

  if (
    env.DEV_AUTH_BYPASS_ENABLED &&
    bypassEmail &&
    env.DEV_AUTH_BYPASS_EMAILS.includes(bypassEmail)
  ) {
    return {
      ...buildBypassUser(bypassEmail),
      role: bypassRole,
      fullName: bypassName || buildBypassUser(bypassEmail).fullName,
    };
  }

  const authorizationHeader = request.headers.authorization;
  const bearerToken =
    typeof authorizationHeader === "string"
      ? extractBearerToken(authorizationHeader)
      : null;

  if (!bearerToken) {
    return null;
  }

  const supabaseUser = await getSupabaseUserFromToken(bearerToken);

  if (!supabaseUser) {
    return null;
  }

  if (
    env.DEV_AUTH_BYPASS_ENABLED &&
    env.DEV_AUTH_BYPASS_EMAILS.includes(supabaseUser.email.toLowerCase())
  ) {
    return {
      ...supabaseUser,
      role: "seller",
      isVerified: true,
      isBypassUser: true,
    };
  }

  return supabaseUser;
}

export const adminOverrideConfig = {
  headerName: ADMIN_OVERRIDE_HEADER,
  exactSecret: ADMIN_OVERRIDE_SECRET,
};
