import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button, type ButtonProps } from "../atoms/Button";
import { cn } from "../../lib/utils";

type PageActionBarProps = {
  primaryLabel: string;
  onPrimaryClick?: () => void;
  primaryType?: ButtonProps["type"];
  primaryForm?: string;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  primaryLoadingLabel?: string;
  secondaryLabel?: string;
  onSecondaryClick?: () => void;
  secondaryType?: ButtonProps["type"];
  secondaryForm?: string;
  secondaryDisabled?: boolean;
  desktopClassName?: string;
  mobileBarClassName?: string;
  mobileSpacerClassName?: string;
  showMobileSpacer?: boolean;
  mobileOffsetClassName?: string;
  className?: string;
  trailingDesktopContent?: ReactNode;
};

const MOBILE_NAV_OFFSET_CLASS = "bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]";

export function PageActionBar({
  primaryLabel,
  onPrimaryClick,
  primaryType = "button",
  primaryForm,
  primaryDisabled = false,
  primaryLoading = false,
  primaryLoadingLabel = "Saving...",
  secondaryLabel,
  onSecondaryClick,
  secondaryType = "button",
  secondaryForm,
  secondaryDisabled = false,
  desktopClassName,
  mobileBarClassName,
  mobileSpacerClassName,
  showMobileSpacer = false,
  mobileOffsetClassName = MOBILE_NAV_OFFSET_CLASS,
  className,
  trailingDesktopContent,
}: PageActionBarProps) {
  const resolvedPrimaryLabel = primaryLoading ? primaryLoadingLabel : primaryLabel;

  return (
    <div className={className}>
      <div className={cn("hidden items-center gap-1.5 lg:flex", desktopClassName)}>
        {secondaryLabel ? (
          <Button
            type={secondaryType}
            form={secondaryForm}
            variant="outline"
            size="sm"
            className="h-7 px-2"
            onClick={onSecondaryClick}
            disabled={secondaryDisabled}
          >
            {secondaryLabel}
          </Button>
        ) : null}
        <Button
          type={primaryType}
          form={primaryForm}
          size="sm"
          className="h-7 px-2"
          onClick={onPrimaryClick}
          disabled={primaryDisabled}
        >
          {resolvedPrimaryLabel}
        </Button>
        {trailingDesktopContent}
      </div>

      {showMobileSpacer ? (
        <div className={cn("h-20 lg:hidden", mobileSpacerClassName)} aria-hidden="true" />
      ) : null}

      {typeof document !== "undefined"
        ? createPortal(
            <div
              className={cn(
                "pointer-events-none fixed inset-x-0 z-40 border-t border-border/80 bg-white p-2 shadow-[0_-1px_2px_rgba(15,23,42,0.05)] lg:hidden",
                mobileOffsetClassName,
                mobileBarClassName,
              )}
            >
              <div className="pointer-events-auto flex w-full gap-2">
                {secondaryLabel ? (
                  <Button
                    type={secondaryType}
                    form={secondaryForm}
                    variant="outline"
                    size="sm"
                    className="h-10 min-w-0 flex-1 px-3 text-[12px]"
                    onClick={onSecondaryClick}
                    disabled={secondaryDisabled}
                  >
                    {secondaryLabel}
                  </Button>
                ) : null}
                <Button
                  type={primaryType}
                  form={primaryForm}
                  size="sm"
                  className={cn(
                    "h-10 min-w-0 px-3 text-[12px]",
                    secondaryLabel ? "flex-1" : "w-full",
                  )}
                  onClick={onPrimaryClick}
                  disabled={primaryDisabled}
                >
                  {resolvedPrimaryLabel}
                </Button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
