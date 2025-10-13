import { NextRequest } from "next/server";
import { getTokens } from "next-firebase-auth-edge";
import { authConfig } from "@/config/serverConfig";
import { getToken } from "@firebase/app-check";
import { getAppCheck } from "@/lib/appCheck";
import { UserCredential } from "firebase/auth";

export async function getAuth(req: NextRequest) {
  const fireTokens = await getTokens(req.cookies, authConfig);
  if (fireTokens) return fireTokens;

  // Try Authorization header first (supports stateless API calls)
  const authHeader =
    req.headers.get("authorization") ||
    req.headers.get("Authorization") ||
    req.headers.get("Next-Authorization");
  const bearerToken = authHeader?.replace("Bearer ", "");

  if (bearerToken === process.env.DEV_TOKEN) {
    return {
      token: bearerToken,
      decodedToken: { email: "dev@automatter.io", uid: "dev-user" },
      metadata: { uid: "dev-user" },
    };
  }

  return null;
}

export async function login(token: string) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  // This is optional. Use it if your app supports App Check – https://firebase.google.com/docs/app-check
  if (process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_KEY) {
    const appCheckTokenResponse = await getToken(getAppCheck(), false);

    headers["X-Firebase-AppCheck"] = appCheckTokenResponse.token;
  }

  await fetch("/api/login", {
    method: "GET",
    headers,
  });
}

export async function loginWithCredential(credential: UserCredential) {
  const idToken = await credential.user.getIdToken();

  await login(idToken);
}

export async function logout() {
  const headers: Record<string, string> = {};

  // This is optional. Use it if your app supports App Check – https://firebase.google.com/docs/app-check
  if (process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_KEY) {
    const appCheckTokenResponse = await getToken(getAppCheck(), false);

    headers["X-Firebase-AppCheck"] = appCheckTokenResponse.token;
  }

  await fetch("/api/logout", {
    method: "GET",
    headers,
  });
}

export async function checkEmailVerification() {
  const headers: Record<string, string> = {};

  // This is optional. Use it if your app supports App Check – https://firebase.google.com/docs/app-check
  if (process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_KEY) {
    const appCheckTokenResponse = await getToken(getAppCheck(), false);

    headers["X-Firebase-AppCheck"] = appCheckTokenResponse.token;
  }

  await fetch("/api/check-email-verification", {
    method: "GET",
    headers,
  });
}
