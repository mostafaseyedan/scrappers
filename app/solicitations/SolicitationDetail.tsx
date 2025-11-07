"use client";

import { useContext, useEffect, useState } from "react";
import { uidsToNames, cn } from "@/lib/utils";
import {
  solicitation as solModel,
  solicitation_comment as solCommentModel,
  solicitation_log as solLogModel,
} from "@/app/models";
import { Button } from "@/components/ui/button";
import { EditSolDialog } from "./editSolDialog";
import { CreateCommentDialog } from "./createCommentDialog";
import { UserContext } from "@/app/userContext";
import { format as $d, formatDistanceToNowStrict as $dist } from "date-fns";
import { Map as MapIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import solStyles from "./solicitation.module.scss";

function isExpiring(date: Date | string | number): boolean {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(now.getDate() + 30);
  const d = new Date(date);
  return thirtyDaysFromNow > d;
}
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cnTypes } from "@/app/config";
import { Trash } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type SolicitationDetailProps = {
  solId: string;
  onRefresh?: () => void;
};

export function SolicitationDetail({ solId, onRefresh }: SolicitationDetailProps) {
  const userContext = useContext(UserContext);
  const user = userContext?.user;
  const getUser = userContext?.getUser;
  const [sol, setSol] = useState<Record<string, any> | undefined>();
  const [logs, setLogs] = useState<Record<string, any>[]>([]);
  const [comments, setComments] = useState<Record<string, any>[]>([]);
  const [showEditSol, setShowEditSol] = useState(false);
  const [showCreateComment, setShowCreateComment] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "description" | "documents" | "comments" | "logs" | "notes" | "source"
  >("description");
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [cnType, setCnType] = useState(sol?.cnType || "-");

  async function refresh(shouldNotifyParent = false) {
    if (!solId) {
      return console.warn("ID missing for refresh");
    }

    const dbSol = await solModel.getById({ id: solId });

    setSol(dbSol);

    // Only notify parent when explicitly requested (e.g., after edit/update)
    if (shouldNotifyParent && onRefresh) {
      onRefresh();
    }
  }

  useEffect(() => {
    // Reset state when switching solicitations
    setActiveTab("description");
    setCommentsLoaded(false);
    setLogsLoaded(false);
    setComments([]);
    setLogs([]);
    setSol(undefined);
    setCnType("-");

    (async () => {
      // Initial load - don't trigger parent refresh
      if (solId) await refresh(false);
    })();
  }, [solId]);

  // Update cnType when sol changes
  useEffect(() => {
    if (sol?.cnType) {
      setCnType(sol.cnType);
    }
  }, [sol?.cnType]);

  // Mark as viewed when solicitation loads
  useEffect(() => {
    if (sol && user?.uid) {
      const viewedBy = sol.viewedBy || [];
      if (!viewedBy.includes(user.uid)) {
        viewedBy.push(user.uid);
        // Fire and forget - don't await this
        solModel.patch({ id: sol.id, data: { viewedBy: viewedBy } }).catch(console.error);
      }
    }
  }, [sol?.id, user?.uid]);

  // Lazy load comments when comments tab is clicked
  useEffect(() => {
    let isMounted = true;

    if (activeTab === "comments" && !commentsLoaded && solId && getUser) {
      (async () => {
        const respComments = await solCommentModel.get(solId);

        if (!isMounted) return;

        // Process comments with user names
        if (respComments.results?.length) {
          const userIds: string[] = Array.from(
            new Set(
              respComments.results.map(
                (msg: Record<string, any>) => msg.authorId
              )
            )
          );

          const userNames = await uidsToNames(userIds, getUser);

          if (!isMounted) return;

          const userMap = new Map(
            userIds.map((uid, index) => [uid, userNames[index]])
          );

          respComments.results = respComments.results.map(
            (msg: Record<string, any>) => {
              return { ...msg, authorName: userMap.get(msg.authorId) };
            }
          );
        }

        if (isMounted) {
          setComments(respComments.results || []);
          setCommentsLoaded(true);
        }
      })();
    }

    return () => {
      isMounted = false;
    };
  }, [activeTab, commentsLoaded, solId, getUser]);

  // Lazy load logs when logs tab is clicked; map author names and provide display-friendly fields
  useEffect(() => {
    let isMounted = true;

    if (activeTab === "logs" && !logsLoaded && solId) {
      (async () => {
        const respLogs = await solLogModel.get({ solId });
        let items: any[] = respLogs.results || [];

        // Resolve author names where possible
        if (items.length && getUser) {
          const userIds: string[] = Array.from(
            new Set(
              items
                .map((l: any) => l.actionUserId)
                .filter((v: any) => typeof v === "string" && v)
            )
          );
          const userNames = await uidsToNames(userIds, getUser);
          const map = new Map(userIds.map((uid, i) => [uid, userNames[i]]));
          items = items.map((l: any) => {
            const actionUserName = map.get(l.actionUserId) || l.actionUserId;
            let displayActionData = l.actionData;
            if (
              l.actionData &&
              Array.isArray(l.actionData.viewedBy)
            ) {
              displayActionData = {
                ...l.actionData,
                viewedBy: l.actionData.viewedBy.map((uid: string) =>
                  map.get(uid) || uid
                ),
              };
            }
            return { ...l, actionUserName, displayActionData };
          });
        }

        if (isMounted) {
          setLogs(items);
          setLogsLoaded(true);
        }
      })();
    }

    return () => {
      isMounted = false;
    };
  }, [activeTab, logsLoaded, solId, getUser]);

  if (!sol) {
    return <div className="p-6">Loading...</div>;
  }

  // Use same color coding as sidebar pills
  const aiScoreRaw = typeof sol.aiPursueScore === 'number' ? sol.aiPursueScore : Number(sol.aiPursueScore);
  const aiScorePct = Number.isFinite(aiScoreRaw) ? Math.round(aiScoreRaw * 100) : null;
  const aiScoreClass = aiScoreRaw >= 0.9 ? 'green' : aiScoreRaw >= 0.7 ? 'orange' : 'red';

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{sol.title}</h2>

            {/* Issuer and Location */}
            {(sol.issuer || sol.location) && (
              <div className={`${solStyles.sol_issuerRow} mt-1`}>
                {sol.issuer && (
                  <span className={solStyles.sol_chip} title={sol.issuer}>
                    <strong>{sol.issuer}</strong>
                  </span>
                )}
                {sol.location && (
                  <span className={solStyles.sol_chip} title={sol.location}>
                    <MapIcon />
                    {sol.location}
                  </span>
                )}
              </div>
            )}

            {/* Source Row: siteId site */}
            {sol.siteId && (
              <div className="text-sm text-gray-600 mt-1">
                <a
                  href={sol.siteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {sol.siteId} {sol.site}
                </a>
              </div>
            )}

            <div className={`${solStyles.sol_issuerRow} mt-2`}>
              {/* RFP Type Tag */}
              {sol.cnType && sol.cnType !== "-" && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-600 text-white">
                  {sol.cnType}
                </span>
              )}

              {/* Status Tag */}
              {sol.cnStatus && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-600 text-white">
                  {sol.cnStatus}
                </span>
              )}

              {/* Published and Extracted Dates (pill style) */}
              {sol.publishDate && (
                <span className={solStyles.sol_chip} title="Published date">
                  Published {typeof sol.publishDate === 'string' || typeof sol.publishDate === 'number'
                    ? $d(new Date(sol.publishDate), "MMM d, yyyy")
                    : $d(sol.publishDate, "MMM d, yyyy")}
                </span>
              )}
              {sol.created && (
                <span className={solStyles.sol_chip} title="Extracted date">
                  Extracted {typeof sol.created === 'string' || typeof sol.created === 'number'
                    ? $d(new Date(sol.created), "MMM d, yyyy")
                    : $d(sol.created, "MMM d, yyyy")}
                </span>
              )}

              {sol.closingDate && (
                <span
                  className={cn(
                    solStyles.sol_datePill,
                    isExpiring(sol.closingDate) ? solStyles.sol_datePill__urgent : ""
                  )}
                  title="Closing date"
                >
                  Closing {$d(new Date(sol.closingDate), "MMM d, yyyy")}
                  <span className={solStyles.sol_datePill_rel}>
                    {" • "}
                    {$dist(new Date(sol.closingDate), { addSuffix: false })} left
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Actions and Score */}
          <div className="flex items-center gap-2 ml-2">
            {/* RFP Type Dropdown */}
            <div>
              <Select
                value={cnType}
                onValueChange={async (value) => {
                  await solModel.patch({ id: sol.id, data: { cnType: value } });
                  setCnType(value);
                  await refresh(true);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="-" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectGroup>
                    <SelectItem key="default" value="-">
                      -
                    </SelectItem>
                    {cnTypes.map((type) => (
                      <SelectItem key={type.key} value={type.key}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Score pill (match sidebar design) - render even when score is 0 */}
            {aiScorePct !== null && (
              <div className={`${solStyles.sol_pursuePill} ${solStyles[`sol_pursuePill__${aiScoreClass}`]}`}>
                {aiScorePct}%
              </div>
            )}

            {/* Delete Button */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Delete">
                  <Trash className="h-4 w-4 text-red-600" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Solicitation</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this solicitation? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      await solModel.remove({ id: sol.id });
                      if (onRefresh) onRefresh();
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex">
          <button
            onClick={() => setActiveTab("description")}
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === "description"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Description
          </button>
          <button
            onClick={() => setActiveTab("notes")}
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === "notes"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Notes
          </button>
          <button
            onClick={() => setActiveTab("source")}
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === "source"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Source Data
          </button>
          <button
            onClick={() => setActiveTab("documents")}
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === "documents"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Documents {Array.isArray(sol.documents) && `(${sol.documents.length})`}
          </button>
          <button
            onClick={() => setActiveTab("comments")}
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === "comments"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Comments {commentsLoaded && `(${comments.length})`}
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === "logs"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Logs {logsLoaded && `(${logs.length})`}
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === "description" && (
          <div className="space-y-4">
            {/* Description */}
            <div className="prose max-w-none">
              {sol.description ? (
                <ReactMarkdown>{sol.description}</ReactMarkdown>
              ) : (
                "No description available"
              )}
            </div>
          </div>
        )}

        {activeTab === "documents" && (
          <div className="space-y-2">
            {Array.isArray(sol.documents) && sol.documents.length > 0 ? (
              sol.documents.map((url: string, index: number) => {
                const name = url?.substring(url.lastIndexOf("/") + 1) || `document-${index + 1}`;
                return (
                  <div key={`sol-doc-${index}-${url}`} className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline break-all"
                    >
                      {name}
                    </a>
                  </div>
                );
              })
            ) : (
              <div className="text-gray-500">No documents yet</div>
            )}
          </div>
        )}

        {activeTab === "notes" && (
          <div className="prose max-w-none">
            {sol.cnNotes && sol.cnNotes.trim().length > 0 ? (
              sol.cnNotes
            ) : (
              <span className="text-gray-500">No notes available</span>
            )}
          </div>
        )}

        {activeTab === "source" && (
          <div>
            {sol.siteData ? (
              <pre className="text-xs overflow-auto bg-gray-50 p-3 rounded border border-gray-200">
                {JSON.stringify(sol.siteData, null, 2)}
              </pre>
            ) : (
              <span className="text-gray-500">No source data available</span>
            )}
          </div>
        )}

        {activeTab === "comments" && (
          <>
            <Button onClick={() => setShowCreateComment(true)} className="mb-4">
              Add Comment
            </Button>
            {!commentsLoaded ? (
              <div className="text-gray-500">Loading comments...</div>
            ) : (
              <div className="space-y-4">
                {comments.length > 0 ? comments.map((comment) => (
                  <div key={comment.id} className="border-b border-gray-200 pb-4">
                    <div className="flex justify-between items-start mb-2">
                      <strong className="text-gray-900">{comment.authorName || comment.authorId}</strong>
                      <span className="text-xs text-gray-500">{$d(comment.created, "MMM d, yyyy h:mm a")}</span>
                    </div>
                    <div className="text-gray-700">{comment.text}</div>
                  </div>
                )) : <div className="text-gray-500">No comments yet</div>}
              </div>
            )}
          </>
        )}

        {activeTab === "logs" && (
          <>
            {!logsLoaded ? (
              <div className="text-gray-500">Loading logs...</div>
            ) : (
              <div className="space-y-2">
                {logs.length > 0 ? (
                  logs.map((log: any) => {
                    const verb = typeof log.actionType === "string" && log.actionType.length
                      ? `${log.actionType}${log.actionType.endsWith("e") ? "d" : "ed"}`
                      : "updated";
                    const line = log.message
                      ? log.message
                      : `${log.actionUserName || log.actionUserId || "Someone"} ${verb} this solicitation.`;
                    return (
                      <div key={log.id} className="flex items-start gap-4 text-sm border-b border-gray-100 pb-2">
                        <span className="text-xs text-gray-500 min-w-44">{$d(log.created, "MMM d, yyyy h:mm a")}</span>
                        <div className="flex-1">
                          <div className="text-gray-700">{line}</div>
                          {log.displayActionData && Object.keys(log.displayActionData).length > 0 && (
                            <pre className="mt-1 text-xs text-gray-500 whitespace-pre-wrap break-all">{JSON.stringify(log.displayActionData)}</pre>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-gray-500">No logs yet</div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <EditSolDialog
        solId={solId}
        open={showEditSol}
        onOpenChange={setShowEditSol}
        onSubmitSuccess={() => refresh(true)}
      />

      <CreateCommentDialog
        solId={solId}
        open={showCreateComment}
        onOpenChange={setShowCreateComment}
        onSubmitSuccess={() => {
          refresh(true);
          setShowCreateComment(false);
        }}
      />
    </div>
  );
}
