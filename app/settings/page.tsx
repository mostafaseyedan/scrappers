import styles from "./page.module.scss";

export default function Page() {
  return (
    <div className={styles.page}>
      <h2>Settings</h2>

      <section>
        <h3>Sources</h3>
        <p>Manage your data sources here.</p>
      </section>
    </div>
  );
}
