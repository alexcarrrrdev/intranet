"use client";

import { createAuthClient } from "better-auth/react";

// Client Better Auth, utilisé dans les composants client (formulaires de
// connexion, hooks de session, etc.). Pas de baseURL fournie : les requêtes
// restent relatives au même domaine, vers le route handler de
// src/app/api/auth/[...all].
export const authClient = createAuthClient();

export const { signIn, signOut, useSession, requestPasswordReset, resetPassword } =
  authClient;
