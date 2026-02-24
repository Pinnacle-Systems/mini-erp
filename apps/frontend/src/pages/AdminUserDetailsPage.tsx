import { useParams } from "react-router-dom";
import {
  Card,
  CardContent,
} from "../design-system/molecules/Card";

export function AdminUserDetailsPage() {
  const { userId } = useParams<{ userId: string }>();

  return (
    <section className="h-auto lg:h-full lg:min-h-0">
      <Card className="p-3 lg:h-full lg:min-h-0">
        <CardContent className="lg:overflow-y-auto">
          <p className="text-sm text-muted-foreground">
            User detail screen is not implemented yet.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Selected user ID: {userId ?? "Unknown user"}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
