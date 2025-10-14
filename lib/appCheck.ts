import {
  AppCheck,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "@firebase/app-check";
import { client as app } from "au/firebase";
import { FirebaseApp } from "@firebase/app";

let appCheck: AppCheck | null = null;

export function getOrInitializeAppCheck(app: FirebaseApp): AppCheck {
  if (appCheck) {
    return appCheck;
  }

  const env = (globalThis as any)?.process?.env || {};
  // Firebase uses a global variable to check if app check is enabled in a dev environment
  if (env.NODE_ENV !== "production") {
    Object.assign(window, {
      FIREBASE_APPCHECK_DEBUG_TOKEN: env.NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN,
    });
  }

  return (appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(
      env.NEXT_PUBLIC_FIREBASE_APP_CHECK_KEY!
    ),
    isTokenAutoRefreshEnabled: true, // Set to true to allow auto-refresh.
  }));
}

export function getAppCheck() {
  return getOrInitializeAppCheck(app);
}
