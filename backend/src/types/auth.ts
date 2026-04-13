export type UserRole = "buyer" | "seller" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  campusId: string;
  isVerified: boolean;
  isBypassUser: boolean;
}

export interface RequestAuthContext {
  user: AuthUser | null;
}
