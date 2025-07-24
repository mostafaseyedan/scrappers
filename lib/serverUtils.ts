import { NextRequest } from "next/server";
import { getTokens } from "next-firebase-auth-edge";
import { cookies } from "next/headers";
import { authConfig } from "@/config/serverConfig";

const ALLOWED_KEYS = {
  MOHAMMID: process.env.MOHAMMID_KEY,
};

export async function checkSession(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const tokens = await getTokens(await cookies(), authConfig);
  let bearerToken: string;
  let isValidSession = Boolean(tokens);
  let user;

  if (tokens?.decodedToken) {
    user = tokens.decodedToken;
    user.type = "user";
  }

  if (authHeader && authHeader.startsWith("Bearer ")) {
    bearerToken = authHeader.substring(7);
    const checkKeys = Object.entries(ALLOWED_KEYS).filter(
      ([, value]) => value === bearerToken
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
