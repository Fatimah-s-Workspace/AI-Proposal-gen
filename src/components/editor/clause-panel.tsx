import { CircleAlert, Info, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Clause = {
  clause: string;
  plainEnglish: string;
  riskLevel: "high" | "medium" | "low";
  action: string;
};

export function ClausePanel({ clauses }: { clauses: Clause[] }) {
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Clause notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {clauses.length ? (
          clauses.map((clause) => (
            <div key={clause.clause} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {riskIcon(clause.riskLevel)}
                  <p className="font-medium">{clause.clause}</p>
                </div>
                <Badge variant={clause.riskLevel === "high" ? "warning" : "secondary"}>{clause.riskLevel}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{clause.plainEnglish}</p>
              <p className="mt-2 text-xs font-medium text-primary">{clause.action}</p>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Upload a tender document to generate plain-English clause explanations.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function riskIcon(risk: string) {
  if (risk === "high") return <CircleAlert className="size-4 text-amber-600" />;
  if (risk === "medium") return <Info className="size-4 text-primary" />;
  return <ShieldCheck className="size-4 text-emerald-600" />;
}
