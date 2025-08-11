import styles from "./Card.module.css";
import { cx } from "../classNames";
import React from "react";

export function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cx(styles.card, props.className)} />;
}
