"use client";

import { use, useContext, useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uidsToNames } from "@/lib/utils";
import {
  solicitation as solModel,
  solicitation_comment as solCommentModel,
  solicitation_log as solLogModel,
} from "@/app/models";
import { cnStatuses, cnTypes } from "@/app/config";
import { SolActions } from "../solActions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EditSolDialog } from "@/app/solicitations/editSolDialog";
import { CreateCommentDialog } from "@/app/solicitations/createCommentDialog";
import Link from "next/link";
import { UserContext } from "@/app/userContext";
import { format as $d } from "date-fns";

import styles from "./page.module.scss";

function isWithinAWeek(date: Date): boolean {
  const now = new Date();
  const oneWeekFromNow = new Date(now);
  oneWeekFromNow.setDate(now.getDate() + 7);
  return date >= now && date <= oneWeekFromNow;
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const userContext = useContext(UserContext);
  const user = userContext?.user;
  const getUser = userContext?.getUser;
  const { id } = use(params);
  const [sol, setSol] = useState<Record<string, any> | undefined>();
  const [logs, setLogs] = useState<Record<string, any>[]>([]);
  const [comments, setComments] = useState<Record<string, any>[]>([]);
  const [cnStatus, setCnStatus] = useState<string>(sol?.cnStatus || "new");
  const [cnType, setCnType] = useState<string>(sol?.cnType || "-");
  const [showEditSol, setShowEditSol] = useState(false);
  const [showCreateComment, setShowCreateComment] = useState(false);
  const [viewedByNames, setViewedByNames] = useState<string[]>([]);

  async function refresh() {
    if (!id) {
      return console.warn("ID missing for page refresh");
    }

    const dbSol = await solModel.getById({ id });

    setSol(dbSol);
    setCnStatus(dbSol?.cnStatus || "new");
    setCnType(dbSol?.cnType || "-");
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

        let userIds: string[] = [];

        const respComments = await solCommentModel.get(id);
        const respLogs = await solLogModel.get({ solId: id });

        if (respComments.results?.length) {
          userIds = Array.from(
            new Set(
              respComments.results.map(
                (msg: Record<string, any>) => msg.authorId
              )
            )
          );
        }

        if (respLogs.results?.length) {
          userIds = Array.from(
            new Set([
              ...userIds,
              ...respLogs.results.map(
                (log: Record<string, any>) => log.actionUserId
              ),
            ])
          );
        }

        const userNames = getUser ? await uidsToNames(userIds, getUser) : [];
        const userMap = new Map(userIds.map((id, idx) => [id, userNames[idx]]));

        // Grab comments
        if (respComments.results?.length) {
          respComments.results.map(async (msg: Record<string, any>) => {
            msg.author = userMap.get(msg.authorId) || msg.authorId;
            return msg;
          });
          setComments(respComments.results);
        }

        // Grab logs
        if (respLogs.results?.length) {
          respLogs.results.map(async (log: Record<string, any>) => {
            log.actionUser = userMap.get(log.actionUserId) || log.actionUserId;
            return log;
          });
          setLogs(respLogs.results);
        }

        setViewedByNames(
          await Promise.all(
            sol.viewedBy.map(async (uid: string) => {
              if (getUser) {
                const user = await getUser(uid);
                return user ? user.displayName || user.email || uid : uid;
              }
              return uid;
            })
          )
        );
      }
    })();
  }, [sol]);

  return (
    <div className={styles.page}>
      {sol && (
        <>
          <Link href="/solicitations">&lt; Back to Solicitations</Link>
          <div className={styles.sol}>
            <SolActions
              sol={sol}
              showExpandOption={false}
              refreshSols={refresh}
              onEditSol={() => setShowEditSol(true)}
            />
            <div className={styles.sol_contentCol}>
              <span className={styles.sol_title}>{sol.title}</span>
              <div className={styles.sol_issuerRow}>
                <span>{sol.issuer}</span>
                <span>/</span>
                <span>{sol.location}</span>
              </div>
              <div className={styles.sol_sourceRow}>
                <span>{sol.id}</span>
                <span>/</span>
                <a href={sol.siteUrl} target="_blank" rel="noopener noreferrer">
                  <span>{sol.siteId}</span> <span>{sol.site}</span>
                </a>
              </div>

              <Link
                href={`https://sales.cendien.com/index.html?source=reconrfp&solicitationId=${sol.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="mt-3 mb-3">AI Analyze</Button>
              </Link>

              <div className={styles.sol_descriptionBox}>
                <span className={styles.sol_description}>
                  {sol.description}
                </span>

                {sol.mondayUrl && (
                  <div className={styles.sol_mondayUrl}>
                    <label>Monday URL</label>
                    <a href={sol.mondayUrl} target="_blank" rel="noopener noreferrer">
                      {sol.mondayUrl}
                    </a>
                  </div>
                )}

                {sol.sharepointUrl && (
                  <div className={styles.sol_sharepointUrl}>
                    <label>Sharepoint URL</label>
                    <a href={sol.sharepointUrl} target="_blank" rel="noopener noreferrer">
                      {sol.sharepointUrl}
                    </a>
                  </div>
                )}

                <div className={styles.sol_externalLinks}>
                  <label>External Links</label>
                  <div>
                    {sol.externalLinks?.map((link: string) => (
                      <div key={`external-link-${link}`}>
                        <a href={link} target="_blank" rel="noopener noreferrer">
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
                <span>{viewedByNames?.join(", ")}</span>
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
                            {comment.author}
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
                      <div className={styles.sol_logsContent_log} key={log.id}>
                        <span className={styles.sol_logsContent_log_created}>
                          {$d(log.created, "M/dd/yyyy h:mm a")}
                        </span>
                        <div>
                          {log.actionUser}{" "}
                          {log.actionType +
                            (log.actionType.charAt(
                              log.actionType.length - 1
                            ) === "e"
                              ? "d"
                              : "ed")}{" "}
                          this solicitation.
                          {Object.values(log.actionData || {}).length > 0 && (
                            <pre>{JSON.stringify(log.actionData)}</pre>
                          )}
                        </div>
                        <span className={styles.sol_logsContent_log_actionType}>
                          {log.actionType}
                        </span>
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
              <label>Type</label>
              <div className={styles.sol_cnType}>
                <Select
                  value={cnType}
                  onValueChange={async (value) => {
                    await solModel.patch({
                      id: sol.id,
                      data: { cnType: value },
                    });
                    setCnType(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectGroup>
                      <SelectItem
                        key={"default"}
                        value={"-"}
                        className={styles[`sol_typeItem_default`]}
                      >
                        -
                      </SelectItem>
                      {cnTypes.map((type) => (
                        <SelectItem
                          key={type.key}
                          value={type.key}
                          className={styles[`sol_typeItem_${type.key}`]}
                        >
                          {type.label}
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
                {sol.closingDate && $d(sol.closingDate, "M/dd/yyyy h:mm a")}
              </span>
              <label>Published Date</label>
              <span className={isWithinAWeek(sol.publishDate) ? "red" : ""}>
                {sol.publishDate && $d(sol.publishDate, "M/dd/yyyy h:mm a")}
              </span>
              <label>Extracted Date</label>
              <span>{sol.created && $d(sol.created, "M/dd/yyyy h:mm a")}</span>
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
