import { Tokens } from "next-firebase-auth-edge/auth";
import { clientConfig } from "./clientConfig";

export const serverConfig = {
  useSecureCookies: process.env.USE_SECURE_COOKIES === "true",
  firebaseApiKey: process.env.FIREBASE_API_KEY!,
  serviceAccount: process.env.FIREBASE_PRIVATE_KEY
    ? {
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")!,
      }
    : undefined,
};

export const authConfig = {
  apiKey: serverConfig.firebaseApiKey,
  cookieName: "AuthToken",
  cookieSignatureKeys: [
    process.env.COOKIE_SECRET_CURRENT!,
    process.env.COOKIE_SECRET_PREVIOUS!,
  ],
  cookieSerializeOptions: {
    path: "/",
    httpOnly: true,
    secure: serverConfig.useSecureCookies, // Set this to true on HTTPS environments
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24, // 1 day
  },
  serviceAccount: serverConfig.serviceAccount,
  // Enable multiple cookies to increase token claims capacity
  enableMultipleCookies: true,
  // Set to false if you're not planning to use `signInWithCustomToken` Firebase Client SDK method
  enableCustomToken: false,
  experimental_enableTokenRefreshOnExpiredKidHeader: true,
  debug: true, // Enable debug mode to help troubleshoot authentication issues
  tenantId: clientConfig.tenantId,
  getMetadata: async (tokens: Tokens) => {
    return { uid: tokens.decodedToken.uid, timestamp: new Date().getTime() };
  },
};
