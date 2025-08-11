import React from "react";
import styles from "./ButtonGroup.module.css";
import { cx } from "../classNames";

export function ButtonGroup(props: React.ComponentProps<"div">) {
  return <div {...props} className={cx(styles.group, props.className)} />;
}
