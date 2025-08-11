import styles from "./IconButton.module.css";
import { cx } from "../classNames";

import React from "react";

export function IconButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>
) {
  return (
    <button
      {...props}
      className={cx(styles.button, props.className)}
      type={props.type ?? "button"}
    />
  );
}
