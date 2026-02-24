import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../design-system/molecules/Card";

export function AdminUsersPage() {
  return (
    <section>
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>Manage platform users and memberships.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            User management UI is not implemented yet. This route is ready for the upcoming screen.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
