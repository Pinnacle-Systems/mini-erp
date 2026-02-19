import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../design-system/molecules/Card";

export function AdminUsersPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6 md:p-10">
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
    </main>
  );
}
