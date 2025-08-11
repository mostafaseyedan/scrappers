import { Suspense } from "react";
import { RegisterPage } from "./RegisterPage";

export default function Register() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RegisterPage />
    </Suspense>
  );
}
