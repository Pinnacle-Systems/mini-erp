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
  onOpenList: () => void;
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
  onOpenList,
  onSaveDraft,
  onPostDraft,
}: SalesDocumentWorkspaceHeaderProps) {
  return (
    <div className="flex flex-col gap-2 border-b border-border/70 pb-2 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-1">
        <h1 className="text-sm font-semibold text-foreground">
          {isViewingPostedDocument
            ? `View ${config.createTitle.replace("Create ", "")}`
            : activeDraftId
              ? `Edit ${config.createTitle.replace("Create ", "")}`
              : config.createTitle}
        </h1>
        <p className="text-xs text-muted-foreground">
          {isViewingPostedDocument
            ? "Posted documents open here in read-only mode for review."
            : isPosMode
              ? "Add items fast, keep customer optional for cash sales, and post as soon as checkout is done."
              : "Select a customer, add lines, save the draft, then post when it is ready."}
        </p>
        {isViewingPostedDocument ? (
          <div className="rounded-md border border-border/70 bg-slate-50 px-2 py-1 text-[11px] text-muted-foreground">
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
          {!isViewingPostedDocument ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onSaveDraft}
                disabled={draftMutationLoading}
              >
                {draftMutationLoading
                  ? "Saving..."
                  : `Save Draft (${linesCount || 1})`}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={onPostDraft}
                disabled={draftMutationLoading}
                title={postValidationMessage ?? config.postActionLabel}
              >
                {draftMutationLoading
                  ? "Working..."
                  : !postValidationMessage
                    ? config.postActionLabel
                    : "Review Posting Issues"}
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
