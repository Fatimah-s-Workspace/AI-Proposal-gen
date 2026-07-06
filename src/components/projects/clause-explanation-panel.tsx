"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ChevronDown, ChevronRight, Lightbulb } from "lucide-react";

type TenderClause = {
  id: string;
  title?: string | null;
  originalText: string;
  explanation?: string | null;
  importance?: string | null;
  riskLevel?: string | null;
  actions?: string[] | null;
  actionsRequired?: string[] | null;
  actionCompletions?: boolean[] | null;
  confidence: number;
};

type ClauseExplanationPanelProps = {
  clauses: TenderClause[];
  projectId: string;
  onExplainClause?: (clauseId: string) => void;
  onUpdateAction?: (
    clauseId: string,
    actionIndex: number,
    completed: boolean,
  ) => void;
};

const importanceColors = {
  high: "destructive",
  medium: "secondary",
  low: "outline",
} as const;

export function ClauseExplanationPanel({
  clauses,
  projectId,
  onExplainClause,
  onUpdateAction,
}: ClauseExplanationPanelProps) {
  const [localClauses, setLocalClauses] = useState(clauses);
  const [expandedClauses, setExpandedClauses] = useState<Set<string>>(
    new Set(),
  );
  const [explainingClauses, setExplainingClauses] = useState<Set<string>>(
    new Set(),
  );
  const [savingAction, setSavingAction] = useState<string | null>(null);

  const toggleClause = (clauseId: string) => {
    const newExpanded = new Set(expandedClauses);
    if (newExpanded.has(clauseId)) {
      newExpanded.delete(clauseId);
    } else {
      newExpanded.add(clauseId);
    }
    setExpandedClauses(newExpanded);
  };

  const handleExplainClause = async (clauseId: string) => {
    setExplainingClauses((prev) => new Set(prev).add(clauseId));
    try {
      if (onExplainClause) {
        await onExplainClause(clauseId);
      } else {
        const response = await fetch(
          `/api/projects/${projectId}/clauses/${clauseId}`,
          { method: "POST", headers: { "Content-Type": "application/json" } },
        );
        if (response.ok) {
          const payload = await response.json();
          if (payload.clause) {
            setLocalClauses((current) =>
              current.map((clause) =>
                clause.id === clauseId
                  ? {
                      ...clause,
                      explanation: payload.clause.explanation,
                      riskLevel: payload.clause.riskLevel,
                      importance: payload.clause.importance,
                      actionsRequired: normaliseStringArray(
                        payload.clause.actionsRequired,
                      ),
                      confidence: payload.clause.confidence ?? clause.confidence,
                    }
                  : clause,
              ),
            );
          }
        }
      }
    } finally {
      setExplainingClauses((prev) => {
        const newSet = new Set(prev);
        newSet.delete(clauseId);
        return newSet;
      });
    }
  };

  const handleActionUpdate = (
    clause: TenderClause,
    clauseId: string,
    actionIndex: number,
    completed: boolean,
  ) => {
    const key = `${clauseId}:${actionIndex}`;
    const nextCompletions = [...(clause.actionCompletions ?? [])];
    nextCompletions[actionIndex] = completed;
    setSavingAction(key);
    setLocalClauses((current) =>
      current.map((item) =>
        item.id === clauseId
          ? { ...item, actionCompletions: nextCompletions }
          : item,
      ),
    );
    onUpdateAction?.(clauseId, actionIndex, completed);
    fetch(`/api/projects/${projectId}/clauses/${clauseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionCompletions: nextCompletions }),
    })
      .catch(() => {
        setLocalClauses((current) =>
          current.map((item) =>
            item.id === clauseId
              ? { ...item, actionCompletions: clause.actionCompletions ?? [] }
              : item,
          ),
        );
      })
      .finally(() => setSavingAction(null));
  };

  if (!localClauses.length) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <Lightbulb className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No clauses available for explanation.</p>
            <p className="text-sm mt-1">
              Upload tender documents to extract and explain clauses.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Clause Explanations</h3>
        <div className="flex gap-2">
          <Badge variant="outline">{clauses.length} clauses</Badge>
          <Badge variant="outline">
            {localClauses.filter((c) => c.explanation).length} explained
          </Badge>
        </div>
      </div>

      <div className="space-y-3">
        {localClauses.map((clause) => {
          const isExpanded = expandedClauses.has(clause.id);
          const isExplaining = explainingClauses.has(clause.id);
          const actions = getClauseActions(clause);
          const completedCount = actions.filter(
            (_, index) => clause.actionCompletions?.[index],
          ).length;

          return (
            <Card key={clause.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant={
                          importanceColors[
                            clause.importance as keyof typeof importanceColors
                          ] || "outline"
                        }
                      >
                        {clause.importance}
                      </Badge>
                      {clause.confidence > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {Math.round(clause.confidence * 100)}% confidence
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {clause.title || clause.originalText}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExplainClause(clause.id)}
                      disabled={isExplaining}
                    >
                      {isExplaining ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Lightbulb className="h-3 w-3 mr-1" />
                      )}
                      {clause.explanation ? "Regenerate" : "Explain"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleClause(clause.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0">
                  {clause.explanation ? (
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2">Explanation</h4>
                        <p className="text-sm text-muted-foreground">
                          {clause.explanation}
                        </p>
                      </div>

                      {actions.length ? (
                        <div>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <h4 className="font-medium">Required Actions</h4>
                            <Badge variant="outline">
                              {completedCount}/{actions.length} done
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {actions.map((action, index) => (
                              <div
                                key={index}
                                className="flex items-start gap-2"
                              >
                                <Checkbox
                                  id={`action-${clause.id}-${index}`}
                                  className="mt-0.5"
                                  checked={Boolean(
                                    clause.actionCompletions?.[index],
                                  )}
                                  disabled={
                                    savingAction === `${clause.id}:${index}`
                                  }
                                  onCheckedChange={(checked) =>
                                    handleActionUpdate(
                                      clause,
                                      clause.id,
                                      index,
                                      checked as boolean,
                                    )
                                  }
                                />
                                <label
                                  htmlFor={`action-${clause.id}-${index}`}
                                  className={
                                    clause.actionCompletions?.[index]
                                      ? "cursor-pointer text-sm text-muted-foreground line-through"
                                      : "cursor-pointer text-sm text-muted-foreground"
                                  }
                                >
                                  {action}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Lightbulb className="mx-auto h-8 w-8 mb-2 opacity-50" />
                      <p className="text-sm">
                        Click Explain to generate an explanation for this clause.
                      </p>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function normaliseStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function getClauseActions(clause: TenderClause) {
  return normaliseStringArray(
    clause.actionsRequired?.length ? clause.actionsRequired : clause.actions,
  );
}
