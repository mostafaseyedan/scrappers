"use client";

import { Button } from "@/components/ui/button";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { fbToJs } from "@/lib/dataUtils";
import { toast } from "sonner";
import { solicitation as solModel } from "@/app/models";

import styles from "./page.module.scss";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [submitError, setSubmitError] = useState<string>("");
  const [sol, setSol] = useState<Record<string, any>>();
  const [solJson, setSolJson] = useState<string>("");
  const [solChanged, setSolChanged] = useState<boolean>(false);

  async function onSave() {
    if (!solJson || !onVerifyJson(solJson)) {
      return;
    }

    const updatedData = JSON.parse(solJson);
    const resp = await solModel.put(id, updatedData).catch((error: unknown) => {
      console.error("Failed to update solicitation", error);
      setSubmitError("Failed to update solicitation");
    });

    if (resp.error) {
      setSubmitError(resp.error);
      return;
    }

    setSubmitError("");
    setSolChanged(false);
    setSolJson(JSON.stringify(resp, null, 2));

    toast(`Solicitation ${id} updated successfully`);
  }

  function onVerifyJson(jsonStr: string) {
    try {
      JSON.parse(jsonStr);
      setSubmitError("");
    } catch (error) {
      console.error("Unable to parse new solicitation JSON", error);
      setSubmitError("Invalid JSON format");
      return false;
    }

    return true;
  }

  useEffect(() => {
    (async () => {
      document.title = `Edit ${id} | Cendien Recon`;

      if (!sol) {
        const sol = await solModel.getById(id);
        setSol(fbToJs(sol));
        setSolJson(JSON.stringify(fbToJs(sol), null, 2));
      }
    })();
  }, [id]);

  return (
    <>
      {sol && (
        <div className={styles.sol}>
          <div className={styles.sol_contentCol}>
            <span className={styles.sol_title}>{sol.title}</span>
            <div className={styles.sol_issuerRow}>
              <span>{sol.location}</span>
              <span>/</span>
              <span>{sol.issuer}</span>
            </div>
            <div className={styles.sol_sourceRow}>
              <Link href={`/solicitations/${sol.id}`} target="_blank">
                {sol.id}
              </Link>
              <span>/</span>
              <a href={sol.siteUrl} target="_blank">
                <span>{sol.siteId}</span> <span>{sol.site}</span>
              </a>
            </div>
          </div>
          <textarea
            className={
              submitError ? styles.sol_textarea__error : styles.sol_textarea
            }
            value={solJson}
            onChange={(e) => {
              setSolJson((e.target as HTMLTextAreaElement).value);
              setSolChanged(true);
            }}
          />
          {solChanged && (
            <>
              <Button
                onClick={() => {
                  setSubmitError("");
                  setSolJson(JSON.stringify(sol, null, 2));
                  setSolChanged(false);
                }}
              >
                Reset
              </Button>
              <Button
                onClick={(e) => {
                  onVerifyJson((e.target as HTMLTextAreaElement).value);
                }}
              >
                Verify
              </Button>
              <Button onClick={() => onSave()}>Save</Button>
            </>
          )}

          <span className={styles.submitError}>{submitError}</span>
        </div>
      )}
    </>
  );
}
