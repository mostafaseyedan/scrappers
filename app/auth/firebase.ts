import { getApp, getApps, initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  browserLocalPersistence,
  setPersistence,
} from "firebase/auth";
import { clientConfig } from "@/config/clientConfig";

export const getFirebaseApp = () => {
  if (getApps().length) {
    return getApp();
  }

  return initializeApp(clientConfig);
};

export function getFirebaseAuth() {
  const auth = getAuth(getFirebaseApp());

  // Use browserLocalPersistence to maintain auth state across page refreshes
  setPersistence(auth, browserLocalPersistence);

  if (process.env.NEXT_PUBLIC_AUTH_EMULATOR_HOST) {
    // https://stackoverflow.com/questions/73605307/firebase-auth-emulator-fails-intermittently-with-auth-emulator-config-failed
    (auth as unknown as any)._canInitEmulator = true;
    connectAuthEmulator(
      auth,
      `http://${process.env.NEXT_PUBLIC_AUTH_EMULATOR_HOST}`,
      {
        disableWarnings: true,
      }
    );
  }

  /*
  if (clientConfig.tenantId) {
    auth.tenantId = clientConfig.tenantId;
  } */

  return auth;
}
