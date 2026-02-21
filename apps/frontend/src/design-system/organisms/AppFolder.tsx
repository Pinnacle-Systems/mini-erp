import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AppFolderModal } from "../molecules/AppFolderModal";
import { AppFolderTile } from "../molecules/AppFolderTile";

export type AppFolderItem<TId extends string = string> = {
  id: TId;
  label: string;
  Icon: LucideIcon;
};

type AppFolderProps<TId extends string> = {
  label: string;
  apps: AppFolderItem<TId>[];
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelectApp: (id: TId) => void;
  closeOnSelect?: boolean;
  children?: ReactNode;
};

export function AppFolder<TId extends string>({
  label,
  apps,
  isOpen,
  onOpen,
  onClose,
  onSelectApp,
  closeOnSelect = false,
  children,
}: AppFolderProps<TId>) {
  return (
    <>
      <AppFolderTile label={label} apps={apps} onOpen={onOpen} />
      <AppFolderModal
        label={label}
        apps={apps}
        isOpen={isOpen}
        onClose={onClose}
        onSelectApp={onSelectApp}
        closeOnSelect={closeOnSelect}
      >
        {children}
      </AppFolderModal>
    </>
  );
}
