"use client";

import * as React from "react";
import { useLoadingCallback } from "react-loading-hook";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import Link from "next/link";
import { Button } from "@/components/uiAuth/Button";
import { MainTitle } from "@/components/uiAuth/MainTitle";
import { PasswordForm } from "@/components/uiAuth/PasswordForm";
import { PasswordFormValue } from "@/components/uiAuth/PasswordForm/PasswordForm";
import { LoadingIcon } from "@/components/uiAuth/icons";
import { appendRedirectParam } from "@/app/shared/redirect";
import { useRedirectParam } from "@/app/shared/useRedirectParam";
import styles from "./register.module.css";
import { useRedirectAfterLogin } from "@/app/shared/useRedirectAfterLogin";
import { loginWithCredential } from "@/app/api";
import { getFirebaseAuth } from "../auth/firebase";

const auth = getFirebaseAuth();

export function RegisterPage() {
  const [hasLogged, setHasLogged] = React.useState(false);
  const redirect = useRedirectParam();
  const redirectAfterLogin = useRedirectAfterLogin();

  const [registerWithEmailAndPassword, isRegisterLoading, error] =
    useLoadingCallback(async ({ email, password }: PasswordFormValue) => {
      setHasLogged(false);
      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      await loginWithCredential(credential);
      await sendEmailVerification(credential.user);
      redirectAfterLogin();

      setHasLogged(true);
    });

  return (
    <div className={styles.page}>
      <MainTitle>Register</MainTitle>
      {hasLogged && (
        <div className={styles.info}>
          <span>
            Redirecting to <strong>{redirect || "/"}</strong>
          </span>
          <LoadingIcon />
        </div>
      )}
      {!hasLogged && (
        <PasswordForm
          onSubmit={registerWithEmailAndPassword}
          loading={isRegisterLoading}
          error={error}
        >
          <Link href={appendRedirectParam("/login", redirect)}>
            <Button disabled={isRegisterLoading}>Back to login</Button>
          </Link>
        </PasswordForm>
      )}
    </div>
  );
}
