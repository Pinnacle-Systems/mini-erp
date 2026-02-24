import { Card, CardContent } from "../design-system/molecules/Card";

export function AdminUsersPage() {
  return (
    <section className="h-auto lg:h-full lg:min-h-0">
      <Card className="p-3 lg:h-full lg:min-h-0">
        <CardContent className="lg:overflow-y-auto">
          <p className="text-sm text-muted-foreground">
            User management UI is not implemented yet. This route is ready for the upcoming screen.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
