import { Store, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppFolder } from "../design-system/organisms/AppFolder";

type AdminAppId = "stores" | "users";

const adminApps: Array<{
  id: AdminAppId;
  label: string;
  Icon: typeof Store;
  route: string;
}> = [
  {
    id: "stores",
    label: "Stores",
    Icon: Store,
    route: "/app/stores",
  },
  {
    id: "users",
    label: "Users",
    Icon: Users,
    route: "/app/users",
  },
];

export function AdminHomePage() {
  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const navigate = useNavigate();
  const previewApps = adminApps.slice(0, 9);
  const folderLabel = "Admin Apps";

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl space-y-6 p-6 md:p-10">
      <div className="w-full max-w-[14rem]">
        <AppFolder
          label={folderLabel}
          apps={previewApps}
          isOpen={isFolderOpen}
          onOpen={() => setIsFolderOpen(true)}
          onClose={() => setIsFolderOpen(false)}
          closeOnSelect
          onSelectApp={(appId) => {
            const app = adminApps.find((entry) => entry.id === appId);
            if (!app) {
              return;
            }
            navigate(app.route);
          }}
        />
      </div>
    </main>
  );
}
