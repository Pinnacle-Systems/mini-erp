import { Button } from "../../design-system/atoms/Button";
import { type SalesDocumentPageConfig } from "./useSalesDocumentWorkspace";

type SalesDocumentWorkspaceHeaderProps = {
  config: SalesDocumentPageConfig;
  isViewingPostedDocument: boolean;
  activeDraftId: string | null;
  isPosMode: boolean;
  documentStatus: string | null | undefined;
  isOnline: boolean;
  draftMutationLoading: boolean;
  linesCount: number;
  postValidationMessage: string | null;
  postActionLabel?: string;
  saveShortcutHint?: string;
  postShortcutHint?: string;
  showNewSaleAction?: boolean;
  newSaleActionLabel?: string;
  onOpenList: () => void;
  onOpenNewSale?: () => void;
  onSaveDraft: () => void;
  onPostDraft: () => void;
};

export function SalesDocumentWorkspaceHeader({
  config,
  isViewingPostedDocument,
  activeDraftId,
  isPosMode,
  documentStatus,
  isOnline,
  draftMutationLoading,
  linesCount,
  postValidationMessage,
  postActionLabel,
  saveShortcutHint,
  postShortcutHint,
  showNewSaleAction = false,
  newSaleActionLabel = "Start New Sale",
  onOpenList,
  onOpenNewSale,
  onSaveDraft,
  onPostDraft,
}: SalesDocumentWorkspaceHeaderProps) {
  return (
    <div
      className={`flex flex-col gap-1.5 border-b border-border/70 pb-1.5 lg:flex-row lg:items-end lg:justify-between ${
        isPosMode ? "lg:min-h-10 lg:py-1" : ""
      }`}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-foreground">
            {isViewingPostedDocument
              ? `View ${config.createTitle.replace("Create ", "")}`
              : activeDraftId
                ? `Edit ${config.createTitle.replace("Create ", "")}`
                : config.createTitle}
          </h1>
          {isViewingPostedDocument ? (
            <span className="hidden rounded-md border border-border/70 bg-slate-50 px-2 py-0.5 text-[10px] text-muted-foreground lg:inline-flex">
              Status: {documentStatus ?? "OPEN"}
            </span>
          ) : null}
        </div>
        <p className={`text-xs text-muted-foreground ${isPosMode ? "lg:text-[11px]" : ""}`}>
          {isViewingPostedDocument
            ? "Posted documents open here in read-only mode for review."
            : isPosMode
              ? "Add items fast and complete checkout from the summary rail."
              : "Select a customer, add lines, save the draft, then post when it is ready."}
        </p>
        {isViewingPostedDocument ? (
          <div className="rounded-md border border-border/70 bg-slate-50 px-2 py-1 text-[11px] text-muted-foreground lg:hidden">
            Status: {documentStatus ?? "OPEN"}
          </div>
        ) : null}
        {!isOnline ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
            {`You are offline. Drafts still save locally. Reconnect to post this ${config.singularLabel}.`}
          </div>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-1 lg:flex-row lg:items-center lg:justify-end lg:gap-2">
        <div className="flex flex-wrap gap-2 lg:flex-nowrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenList}
          >
            {isPosMode ? "Recent Sales" : "Back to Recent"}
          </Button>
          {showNewSaleAction && onOpenNewSale ? (
            <Button
              type="button"
              size="sm"
              onClick={onOpenNewSale}
            >
              {newSaleActionLabel}
            </Button>
          ) : null}
          {!isViewingPostedDocument ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onSaveDraft}
                disabled={draftMutationLoading}
              >
                <span>
                  {draftMutationLoading
                    ? "Saving..."
                    : `Save Draft (${linesCount || 1})`}
                </span>
                {!draftMutationLoading && saveShortcutHint ? (
                  <span className="ml-2 rounded border border-border/80 bg-slate-50 px-1 py-0 text-[10px] font-medium text-muted-foreground">
                    {saveShortcutHint}
                  </span>
                ) : null}
              </Button>
              {!isPosMode ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={onPostDraft}
                  disabled={draftMutationLoading}
                  title={postValidationMessage ?? postActionLabel ?? config.postActionLabel}
                >
                  <span>
                    {draftMutationLoading
                      ? "Working..."
                      : !postValidationMessage
                        ? postActionLabel ?? config.postActionLabel
                        : "Review Posting Issues"}
                  </span>
                  {!draftMutationLoading && postShortcutHint ? (
                    <span className="ml-2 rounded border border-white/40 bg-white/10 px-1 py-0 text-[10px] font-medium text-white/90">
                      {postShortcutHint}
                    </span>
                  ) : null}
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
