import React from "react";
import styles from "./Badge.module.css";
import { cx } from "../classNames";

export function Badge(props: React.HTMLAttributes<HTMLSpanElement>) {
  return <span {...props} className={cx(styles.badge, props.className)} />;
}
