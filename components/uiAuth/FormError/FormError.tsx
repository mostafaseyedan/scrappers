import React from "react";
import { cx } from "../classNames";
import styles from "./FormError.module.css";

export function FormError(props: React.ComponentProps<"span">) {
  return <span {...props} className={cx(styles.error, props.className)} />;
}
