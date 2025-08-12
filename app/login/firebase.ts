import type {
  Auth,
  AuthError,
  AuthProvider,
  UserCredential,
} from "firebase/auth";
import {
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  useDeviceLanguage as setDeviceLanguage,
} from "firebase/auth";

const CREDENTIAL_ALREADY_IN_USE_ERROR = "auth/credential-already-in-use";
export const isCredentialAlreadyInUseError = (e: AuthError) =>
  e?.code === CREDENTIAL_ALREADY_IN_USE_ERROR;

export const logout = async (auth: Auth): Promise<void> => {
  return signOut(auth);
};

export const getMicrosoftProvider = (auth: Auth) => {
  const provider = new OAuthProvider("microsoft.com");
  provider.addScope("profile");
  provider.addScope("email");
  provider.addScope("openid");
  setDeviceLanguage(auth);
  provider.setCustomParameters({
    tenantId: process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID || "organizations",
  });
  return provider;
};

export const getGoogleProvider = (auth: Auth) => {
  const provider = new GoogleAuthProvider();
  provider.addScope("profile");
  provider.addScope("email");
  setDeviceLanguage(auth);
  provider.setCustomParameters({
    display: "popup",
  });

  return provider;
};

export const loginWithProvider = async (
  auth: Auth,
  provider: AuthProvider
): Promise<UserCredential> => {
  // For other providers, use popup
  const result = await signInWithPopup(
    auth,
    provider,
    browserPopupRedirectResolver
  );

  return result;
};

export const loginWithProviderUsingRedirect = async (
  auth: Auth,
  provider: AuthProvider
): Promise<void> => {
  await signInWithRedirect(auth, provider);
};
