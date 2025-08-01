import { NextRequest } from "next/server";
import { getTokens } from "next-firebase-auth-edge";
import { cookies } from "next/headers";
import { authConfig } from "@/config/serverConfig";

const ALLOWED_KEYS = {
  MOHAMMAD: process.env.MOHAMMAD_KEY,
  SERVICE: process.env.SERVICE_KEY,
};

export async function checkSession(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const getCookies = await cookies();
  const tokens = (await getTokens(getCookies, authConfig)) as {
    accessToken?: string;
    decodedToken?: Record<string, any>;
  };
  const cookieToken = getCookies.get("AuthToken")?.value;
  const authToken =
    authHeader?.startsWith("Bearer ") && authHeader.substring(7);
  const token = authToken || cookieToken || tokens?.accessToken;
  let isValidSession = Boolean(tokens);
  let user;

  if (tokens?.decodedToken) {
    user = tokens.decodedToken;
    user.type = "user";
  }

  if (token) {
    const checkKeys = Object.entries(ALLOWED_KEYS).filter(
      ([, value]) => value === token
    );
    isValidSession = checkKeys.length > 0;

    if (isValidSession) {
      user = {
        email: "serviceAdmin@cendien.com",
        uid: `serviceAdmin-${checkKeys[0][0]}`,
        user_id: `serviceAdmin-${checkKeys[0][0]}`,
        type: "serviceAdmin",
        exp: null,
      };
    }
  }

  return user;
}
