import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.scss";

export default function Page() {
  return (
    <div className={styles.page}>
      <article id="0.2.0">
        <h2>0.2.0 - TBA</h2>
        <ul>
          <li>
            <b>AI</b> AI genkit installed.
          </li>
          <li>
            <b>Elastic Search</b> has been phased out. We use Firestore as the
            driver and Algolia for search.
          </li>
          <li>
            <b>Scraper</b> <i>omniapartners</i> added. Added a flag to switch
            between local and remote. Better scraper counter stats update script
            to more accurately count solicitation created.
          </li>
          <li>
            <b>UI</b> New <i>Combobox</i> component helps with autocomplete
            lookups.
          </li>
        </ul>
      </article>
      <article id="0.1.0">
        <h2>0.1.0 - 9/17/2025</h2>
        <ul>
          <li>
            <b>Improved search</b> Ability to search substrings with fuzzy
            support.
            <div>
              <div className={styles.image}>
                <Image
                  src="/changelog/0.1.0/search.png"
                  alt="Improved search"
                  width={869}
                  height={317}
                />
              </div>
            </div>
          </li>
          <li>
            <b>Changelog page</b> Added a changelog page to view updates.
            <div>
              <Link
                className={styles.image}
                href="/changelog/0.1.0/changelog.png"
                target="_blank"
              >
                <Image
                  src="/changelog/0.1.0/changelog.png"
                  alt="Changelog page"
                  width={546}
                  height={523}
                />
              </Link>
            </div>
          </li>
          <li>
            <b>Solicitation page</b> New FOIA status added. Monday URL and
            Sharepoint URL are now included when editing a solicitation.
            <div>
              <Link
                className={styles.image}
                href="/changelog/0.1.0/mondayUrl.png"
                target="_blank"
              >
                <Image
                  src="/changelog/0.1.0/mondayUrl.png"
                  alt="Monday URL"
                  width={256}
                  height={146}
                />
              </Link>
            </div>
          </li>
          <li>
            <b>Sources page</b> Can now create and edit new sources.
            <div>
              <Link
                className={styles.image}
                href="/changelog/0.1.0/sources.png"
                target="_blank"
              >
                <Image
                  src="/changelog/0.1.0/sources.png"
                  alt="Sources page"
                  width={849}
                  height={428}
                />
              </Link>
            </div>
          </li>
          <li>
            <b>Logs page</b> Graph can be changed to 30 to 60 days. Solicitation
            log bug fixed where it was not showing in order.
            <div>
              <Link
                className={styles.image}
                href="/changelog/0.1.0/graph.png"
                target="_blank"
              >
                <Image
                  src="/changelog/0.1.0/graph.png"
                  alt="Graph page"
                  width={325}
                  height={246}
                />
              </Link>
            </div>
          </li>
        </ul>
      </article>
    </div>
  );
}
