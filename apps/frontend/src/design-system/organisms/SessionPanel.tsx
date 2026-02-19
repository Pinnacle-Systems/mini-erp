import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../molecules/Card";

type SessionPanelProps = {
  loading: boolean;
};

export function SessionPanel({ loading }: SessionPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Tools</CardTitle>
        <CardDescription>Session is refreshed automatically in the background.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">{loading ? "Updating session..." : "No manual actions required."}</p>
      </CardContent>
    </Card>
  );
}
