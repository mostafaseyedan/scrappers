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
    prompt: "select_account",
    tenant: "731cf8da-9ed1-43e4-901a-a8fda2084922",
    response_type: "code",
    response_mode: "fragment",
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
  // For Microsoft, always use redirect flow due to PKCE requirements
  if (
    provider instanceof OAuthProvider &&
    provider.providerId === "microsoft.com"
  ) {
    return signInWithRedirect(auth, provider);
  }

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
