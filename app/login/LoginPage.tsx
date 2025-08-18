"use client";

import {
  UserCredential,
  getRedirectResult,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
} from "firebase/auth";
import Link from "next/link";
import * as React from "react";
import { useLoadingCallback } from "react-loading-hook";
import { loginWithCredential } from "@/app/api";
import { Button } from "@/components/ui/button";
import { PasswordForm } from "@/components/uiAuth/PasswordForm";
import { PasswordFormValue } from "@/components/uiAuth/PasswordForm/PasswordForm";
import { Switch } from "@/components/uiAuth/Switch/Switch";
import { LoadingIcon } from "@/components/uiAuth/icons";
import { getFirebaseAuth } from "../auth/firebase";
import { appendRedirectParam } from "../shared/redirect";
import { useRedirectAfterLogin } from "../shared/useRedirectAfterLogin";
import { useRedirectParam } from "../shared/useRedirectParam";
import {
  getGoogleProvider,
  getMicrosoftProvider,
  loginWithProvider,
  loginWithProviderUsingRedirect,
} from "./firebase";
import styles from "./login.module.css";

const auth = getFirebaseAuth();

export function LoginPage({
  loginAction,
}: {
  loginAction: (email: string, password: string) => void;
}) {
  const [hasLogged, setHasLogged] = React.useState(false);
  const [shouldLoginWithAction, setShouldLoginWithAction] =
    React.useState(false);
  const [isLoginActionPending, startTransition] = React.useTransition();
  const redirect = useRedirectParam();
  const redirectAfterLogin = useRedirectAfterLogin();

  async function handleLogin(credential: UserCredential) {
    await loginWithCredential(credential);
    redirectAfterLogin();
  }

  const [handleLoginWithEmailAndPassword, isEmailLoading, emailPasswordError] =
    useLoadingCallback(async ({ email, password }: PasswordFormValue) => {
      setHasLogged(false);

      const auth = getFirebaseAuth();

      if (shouldLoginWithAction) {
        startTransition(() => loginAction(email, password));
      } else {
        await handleLogin(
          await signInWithEmailAndPassword(auth, email, password)
        );

        setHasLogged(true);
      }
    });

  const [handleLoginWithGoogle, , googleError] = useLoadingCallback(
    async () => {
      setHasLogged(false);

      const auth = getFirebaseAuth();
      await handleLogin(await loginWithProvider(auth, getGoogleProvider(auth)));

      setHasLogged(true);
    }
  );

  const [handleLoginWithGoogleUsingRedirect, , googleUsingRedirectError] =
    useLoadingCallback(async () => {
      setHasLogged(false);

      const auth = getFirebaseAuth();
      await loginWithProviderUsingRedirect(auth, getGoogleProvider(auth));

      setHasLogged(true);
    });

  const [handleLoginWithMicrosoft, , microsoftError] = useLoadingCallback(
    async () => {
      setHasLogged(false);

      const auth = getFirebaseAuth();
      await handleLogin(
        await loginWithProvider(auth, getMicrosoftProvider(auth))
      );

      setHasLogged(true);
    }
  );

  const [handleLoginWithMicrosoftUsingRedirect, , microsoftUsingRedirectError] =
    useLoadingCallback(async () => {
      setHasLogged(false);

      const auth = getFirebaseAuth();
      await loginWithProviderUsingRedirect(auth, getMicrosoftProvider(auth));

      setHasLogged(true);
    });

  async function handleLoginWithRedirect() {
    const credential = await getRedirectResult(auth);

    if (credential?.user) {
      await handleLogin(credential);

      setHasLogged(true);
    }
  }

  React.useEffect(() => {
    handleLoginWithRedirect();
  }, []);

  const [handleLoginWithEmailLink, , emailLinkError] = useLoadingCallback(
    async () => {
      const auth = getFirebaseAuth();
      const email = window.prompt("Please provide your email");

      if (!email) {
        return;
      }

      window.localStorage.setItem("emailForSignIn", email);

      await sendSignInLinkToEmail(auth, email, {
        url: process.env.NEXT_PUBLIC_ORIGIN + "/login",
        handleCodeInApp: true,
      });
    }
  );

  async function handleLoginWithEmailLinkCallback() {
    const auth = getFirebaseAuth();
    if (!isSignInWithEmailLink(auth, window.location.href)) {
      return;
    }

    let email = window.localStorage.getItem("emailForSignIn");
    if (!email) {
      email = window.prompt("Please provide your email for confirmation");
    }

    if (!email) {
      return;
    }

    setHasLogged(false);

    await handleLogin(
      await signInWithEmailLink(auth, email, window.location.href)
    );
    window.localStorage.removeItem("emailForSignIn");

    setHasLogged(true);
  }

  React.useEffect(() => {
    handleLoginWithEmailLinkCallback();
  }, []);

  return (
    <div className={styles.page}>
      <h2>Login</h2>
      {hasLogged && (
        <div className={styles.info}>
          <span>
            Redirecting to <strong>{redirect || "/"}</strong>
          </span>
          <LoadingIcon />
        </div>
      )}
      {!hasLogged && (
        /* <PasswordForm
          loading={isEmailLoading || isLoginActionPending}
          onSubmit={handleLoginWithEmailAndPassword}
          actions={
            // `firebase/auth` library is not yet compatible with Vercel's Edge environment
            !process.env.VERCEL ? (
              <div className={styles.loginWithAction}>
                <Switch
                  value={shouldLoginWithAction}
                  onChange={setShouldLoginWithAction}
                />
              </div>
            ) : undefined
          }
          error={
            emailPasswordError ||
            googleError ||
            emailLinkError ||
            googleUsingRedirectError ||
            microsoftError ||
            microsoftUsingRedirectError
          }
        >
          <Link
            className={styles.link}
            href={appendRedirectParam("/reset-password", redirect)}
          >
            Reset password
          </Link>
          <Link href={appendRedirectParam("/register", redirect)}>
            <Button className="w-full">Register</Button>
          </Link>
          <Button onClick={handleLoginWithGoogle}>
            Log in with Google (Popup)
          </Button>
          <Button onClick={handleLoginWithGoogleUsingRedirect}>
            Log in with Google (Redirect)
          </Button>
          <Button
            style={{ display: "none" }}
            onClick={handleLoginWithEmailLink}
          >
            Log in with Email Link
          </Button>
          <Button onClick={handleLoginWithMicrosoft}>
            Log in with Microsoft (Popup)
          </Button>
          
        </PasswordForm> */
        <Button onClick={handleLoginWithMicrosoftUsingRedirect}>
          Log in with Microsoft
        </Button>
      )}
    </div>
  );
}
