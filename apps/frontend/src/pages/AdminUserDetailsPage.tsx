import { useParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../design-system/molecules/Card";

export function AdminUserDetailsPage() {
  const { userId } = useParams<{ userId: string }>();

  return (
    <section>
      <Card>
        <CardHeader>
          <CardTitle>User Details</CardTitle>
          <CardDescription>Inspect and manage user profile data.</CardDescription>
        </CardHeader>
        <CardContent>
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
