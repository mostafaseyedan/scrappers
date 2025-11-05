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
import Image from "next/image";
import styles from "./login.module.css";

// Initialize the correct Firebase Auth instance for this app
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
      await handleLogin(await loginWithProvider(auth, getGoogleProvider(auth)));
      setHasLogged(true);
    }
  );

  const [handleLoginWithGoogleUsingRedirect, , googleUsingRedirectError] =
    useLoadingCallback(async () => {
      setHasLogged(false);
      await loginWithProviderUsingRedirect(auth, getGoogleProvider(auth));
      setHasLogged(true);
    });

  const [handleLoginWithMicrosoft, , microsoftError] = useLoadingCallback(
    async () => {
      setHasLogged(false);
      await handleLogin(
        await loginWithProvider(auth, getMicrosoftProvider(auth))
      );
      setHasLogged(true);
    }
  );

  // Removed unused Microsoft redirect login handler

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
    <div id="loginContainer" className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center md:justify-start">
          <Image
            src="/cendien_corp_logo.jpg"
            alt="logo"
            className="w-[100px]"
            width={100}
            height={100}
          />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div id="formContent" className="w-full max-w-xs">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">
                  {hasLogged ? (
                    <>
                      <LoadingIcon /> Redirecting to{" "}
                      <strong>{redirect || "/"}</strong>
                    </>
                  ) : (
                    "Login to access the app"
                  )}
                </h1>
              </div>

              <div id="oauthSection" className="grid gap-2">
                {!hasLogged && (
                  <>
                    <PasswordForm
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
                        microsoftError
                      }
                      style={{ display: "none" }}
                    >
                      <Link
                        className={styles.link}
                        href={appendRedirectParam("/reset-password", redirect)}
                        style={{ display: "none" }}
                      >
                        Reset password
                      </Link>
                      <Link
                        href={appendRedirectParam("/register", redirect)}
                        style={{ display: "none" }}
                      >
                        <Button className="w-full">Register</Button>
                      </Link>
                      <Button
                        onClick={handleLoginWithGoogle}
                        style={{ display: "none" }}
                      >
                        Log in with Google (Popup)
                      </Button>
                      <Button
                        onClick={handleLoginWithGoogleUsingRedirect}
                        style={{ display: "none" }}
                      >
                        Log in with Google (Redirect)
                      </Button>
                      <Button
                        style={{ display: "none" }}
                        onClick={handleLoginWithEmailLink}
                      >
                        Log in with Email Link
                      </Button>
                    </PasswordForm>
                    <Button
                      onClick={handleLoginWithMicrosoft}
                      variant="outline"
                    >
                      <Image
                        src="/msft.svg"
                        alt="Microsoft logo"
                        className="size-4 shrink-0"
                        width={20}
                        height={20}
                      />{" "}
                      Log in with Microsoft
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        className="relative lg:block"
        style={{
          backgroundImage: "url('/team2.png')",
          backgroundSize: "cover",
          backgroundPosition: "center center",
        }}
      ></div>
    </div>
  );
}
