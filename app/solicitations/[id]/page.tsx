"use client";

import { db } from "@/lib/firebaseClient";
import { use, useContext, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  solicitation as solModel,
  solicitation_comment as solCommentModel,
  solicitation_log as solLogModel,
} from "@/app/models";
import { cnStatuses } from "@/app/config";
import { SolActions } from "../solActions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EditSolDialog } from "@/app/solicitations/editSolDialog";
import { CreateCommentDialog } from "@/app/solicitations/createCommentDialog";
import Link from "next/link";
import { UserContext } from "@/app/userContext";

import styles from "./page.module.scss";

function isWithinAWeek(date: Date): boolean {
  const now = new Date();
  const oneWeekFromNow = new Date(now);
  oneWeekFromNow.setDate(now.getDate() + 7);
  return date >= now && date <= oneWeekFromNow;
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [sol, setSol] = useState<Record<string, any> | undefined>();
  const [logs, setLogs] = useState<Record<string, any>[]>([]);
  const [comments, setComments] = useState<Record<string, any>[]>([]);
  const [cnStatus, setCnStatus] = useState<string>(sol?.cnStatus || "new");
  const [showEditSol, setShowEditSol] = useState(false);
  const [showCreateComment, setShowCreateComment] = useState(false);

  const user = useContext(UserContext)?.user;

  async function refresh() {
    if (!id) {
      return console.warn("ID missing for page refresh");
    }

    const dbSol = await solModel.getById({ id });

    // Grab comments
    const respComments = await solCommentModel.get(id);
    if (respComments.results?.length) setComments(respComments.results);

    setSol(dbSol);
    setCnStatus(dbSol?.cnStatus || "new");
  }

  useEffect(() => {
    (async () => {
      document.title = `${id} | Cendien Recon`;

      if (id) await refresh();
    })();

    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("focus", refresh);
    };
  }, [id, comments.length]);

  useEffect(() => {
    (async () => {
      if (sol && user?.uid) {
        const viewedBy = sol.viewedBy || [];
        if (!viewedBy.includes(user.uid)) {
          viewedBy.push(user.uid);
          await solModel.patch({ id: sol.id, data: { viewedBy: viewedBy } });
        }

        // Grab logs
        const respLogs = await solLogModel.get({ solId: id });
        if (respLogs.results?.length) setLogs(respLogs.results);
      }
    })();
  }, [sol]);

  return (
    <div>
      {sol && (
        <>
          <Link href="/solicitations">&lt; Back to solicitations</Link>
          <div className={cn(styles.sol)}>
            <SolActions
              sol={sol}
              showExpandOption={false}
              refreshSols={refresh}
              onEditSol={() => setShowEditSol(true)}
            />
            <div className={styles.sol_contentCol}>
              <span className={styles.sol_title}>{sol.title}</span>
              <div className={styles.sol_issuerRow}>
                <span>{sol.location}</span>
                <span>/</span>
                <span>{sol.issuer}</span>
              </div>
              <div className={styles.sol_sourceRow}>
                <span>{sol.id}</span>
                <span>/</span>
                <a href={sol.siteUrl} target="_blank">
                  <span>{sol.siteId}</span> <span>{sol.site}</span>
                </a>
              </div>

              <Link
                href={`https://sales.cendien.com/index.html?source=reconrfp&solicitationId=${sol.id}`}
                target="_blank"
              >
                <Button className="mt-3 mb-3">AI Analyze</Button>
              </Link>

              <div className={styles.sol_descriptionBox}>
                <span className={styles.sol_description}>
                  {sol.description}
                </span>

                <div className={styles.sol_externalLinks}>
                  <label>External Links</label>
                  <div>
                    {sol.externalLinks?.map((link: string) => (
                      <div key={`external-link-${link}`}>
                        <a href={link} target="_blank">
                          {link}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className={styles.sol_categories}>
                <label>Categories</label>
                {sol.categories?.map((category: string) => (
                  <span
                    key={`category-${category}`}
                    className={styles.sol_category}
                  >
                    {category}
                  </span>
                ))}
              </div>
              <div className={styles.sol_keywords}>
                <label>Keywords</label>
                {(sol.keywords || []).map((keyword: string) => (
                  <span
                    key={`sol-keyword-${keyword}`}
                    className={styles.sol_keyword}
                  >
                    {keyword}
                  </span>
                ))}
              </div>
              <div className="mb-4">
                <label>Viewed By ({sol.viewedBy?.length || 0})</label>
                <span>{sol.viewedBy?.join(", ")}</span>
              </div>

              <Tabs defaultValue="notes">
                <TabsList className={styles.sol_tabs}>
                  <TabsTrigger value="comments">
                    Comments ({comments?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="documents">
                    Documents ({sol.documents?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="logs">Logs</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                  <TabsTrigger value="source">Source Data</TabsTrigger>
                </TabsList>

                <TabsContent
                  className={styles.sol_tabs_commentsContent}
                  value="comments"
                >
                  <Button
                    onClick={() => {
                      setShowCreateComment(true);
                    }}
                  >
                    Leave a comment
                  </Button>
                  <div>
                    {Boolean(comments?.length) ? (
                      comments.map((comment) => (
                        <div
                          key={comment.id}
                          className={styles.sol_tabs_commentsContent_comment}
                        >
                          <span
                            className={
                              styles.sol_tabs_commentsContent_comment_author
                            }
                          >
                            {comment.authorId}
                          </span>
                          <span
                            className={
                              styles.sol_tabs_commentsContent_comment_date
                            }
                          >
                            {new Date(comment.created).toLocaleString()}
                          </span>
                          <span
                            className={
                              styles.sol_tabs_commentsContent_comment_body
                            }
                          >
                            {comment.body}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span>No comments yet.</span>
                    )}
                  </div>
                </TabsContent>

                <TabsContent
                  className={styles.sol_tabs_documentsContent}
                  value="documents"
                >
                  {sol.documents?.length &&
                    sol.documents.map((url: string, index: number) => (
                      <div
                        className={styles.sol_tabs_documentsContent_document}
                        key={`sol-doc-${index}-${url}`}
                      >
                        <a href={url} target="_blank">
                          <span>{url.substring(url.lastIndexOf("/") + 1)}</span>
                        </a>
                      </div>
                    ))}
                </TabsContent>

                <TabsContent value="logs">
                  {logs.length ? (
                    logs.map((log) => (
                      <div key={log.id}>
                        <pre>{JSON.stringify(log, null, 2)}</pre>
                      </div>
                    ))
                  ) : (
                    <p>No logs available</p>
                  )}
                </TabsContent>

                <TabsContent value="notes">
                  {sol.cnNotes ? (
                    <>{sol.cnNotes}</>
                  ) : (
                    <div className="p-3">No notes available</div>
                  )}
                </TabsContent>

                <TabsContent value="source">
                  <pre className="json">
                    {JSON.stringify(sol.siteData, null, 2)}
                  </pre>
                </TabsContent>
              </Tabs>
            </div>
            <div className={styles.sol_datesCol}>
              <label>Our Status</label>
              <div className={styles.sol_ourStatus} data-status={cnStatus}>
                <Select
                  value={cnStatus}
                  onValueChange={async (value) => {
                    await solModel.patch({
                      id: sol.id,
                      data: { cnStatus: value },
                    });
                    setCnStatus(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="New" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectGroup>
                      {cnStatuses &&
                        Object.entries(cnStatuses).map(([value, label]) => (
                          <SelectItem
                            className={styles[`sol_ourStatus_${value}`]}
                            key={value}
                            value={value}
                          >
                            {label}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <label>Status</label>
              <span>Active</span>
              <label>Closing Date</label>
              <span className={isWithinAWeek(sol.closingDate) ? "red" : ""}>
                {sol.closingDate?.seconds &&
                  sol.closingDate.toDate().toLocaleString()}
              </span>
              <label>Published Date</label>
              <span className={isWithinAWeek(sol.publicationDate) ? "red" : ""}>
                {sol.publicationDate?.seconds &&
                  sol.publicationDate.toDate().toLocaleString()}
              </span>
              <label>Extracted Date</label>
              <span>
                {sol.created?.seconds && sol.created.toDate().toLocaleString()}
              </span>
            </div>

            <EditSolDialog
              solId={sol.id}
              open={showEditSol}
              onOpenChange={setShowEditSol}
              onSubmitSuccess={() => refresh()}
            />

            <CreateCommentDialog
              solId={sol.id}
              open={showCreateComment}
              onOpenChange={setShowCreateComment}
              onSubmitSuccess={() => refresh()}
            />
          </div>
        </>
      )}
    </div>
  );
}
