import styles from "./MainTitle.module.css";
import { cx } from "../classNames";
import React from "react";

export function MainTitle(props: React.ComponentProps<"h1">) {
  return <h1 {...props} className={cx(styles.title, props.className)} />;
}
