"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  WandSparkles,
  CheckCircle2,
  CircleDashed,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";

type Requirement = {
  id: string;
  title: string;
  description: string;
  category: string;
  sourceClause?: string | null;
  priority: string;
  status: string;
  owner?: string | null;
};

type ProposalSection = {
  id: string;
  title: string;
  content: string | null;
  sectionType: string;
  status: string;
  wordTarget: number;
};

type DraftChecklistProps = {
  requirements: Requirement[];
  proposalSections: ProposalSection[];
  projectId: string;
};

export function DraftChecklist({
  requirements,
  proposalSections,
  projectId,
}: DraftChecklistProps) {
  const router = useRouter();
  const [generatingSection, setGeneratingSection] = useState<string | null>(
    null,
  );

  const generateMutation = useMutation({
    mutationFn: async (sectionId: string) => {
      const response = await fetch(
        `/api/projects/${projectId}/proposal-sections/${sectionId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instructions:
              "Generate content that addresses the key requirements from the checklist above.",
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to generate section");
      }

      return response.json();
    },
    onSuccess: () => {
      router.refresh();
      setGeneratingSection(null);
    },
    onError: () => {
      setGeneratingSection(null);
    },
  });

  const handleGenerateSection = (sectionId: string) => {
    setGeneratingSection(sectionId);
    generateMutation.mutate(sectionId);
  };

  const completedRequirements = requirements.filter(
    (req) => req.status === "met",
  ).length;
  const totalRequirements = requirements.length;
  const completionPercentage =
    totalRequirements > 0
      ? (completedRequirements / totalRequirements) * 100
      : 0;

  const priorityRequirements = requirements.filter(
    (req) => req.priority === "high" && req.status !== "met",
  );

  return (
    <div className="space-y-6">
      {/* Requirements Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Requirements Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Completed Requirements</span>
              <span>
                {completedRequirements} of {totalRequirements}
              </span>
            </div>
            <Progress value={completionPercentage} className="h-2" />
          </div>

          {priorityRequirements.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    High Priority Requirements ({priorityRequirements.length})
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    Focus on these critical requirements when drafting your
                    proposal sections.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Key Requirements */}
      <Card>
        <CardHeader>
          <CardTitle>Key Requirements to Address</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {requirements.slice(0, 5).map((requirement) => (
              <div
                key={requirement.id}
                className="flex items-start gap-3 p-3 rounded-lg border"
              >
                <div className="mt-0.5">
                  {requirement.status === "met" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : requirement.status === "in_progress" ? (
                    <CircleDashed className="h-4 w-4 text-amber-600" />
                  ) : (
                    <CircleDashed className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium">{requirement.title}</p>
                    <Badge
                      variant={
                        requirement.priority === "high"
                          ? "destructive"
                          : "secondary"
                      }
                      className="text-xs"
                    >
                      {requirement.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {requirement.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Proposal Sections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WandSparkles className="h-5 w-5" />
            Generate Proposal Sections
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            AI-generated content based on your requirements checklist
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {proposalSections.map((section) => {
              const hasContent =
                section.content && section.content.trim().length > 0;
              const wordCount = section.content
                ? section.content.trim().split(/\s+/).length
                : 0;

              return (
                <div
                  key={section.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="flex-1">
                    <h3 className="font-medium">{section.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {hasContent ? (
                        <>
                          <Badge variant="default" className="text-xs">
                            {wordCount} words
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Target: {section.wordTarget} words
                          </span>
                        </>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Not generated
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={() => handleGenerateSection(section.id)}
                    disabled={generatingSection === section.id}
                    size="sm"
                    className="ml-4"
                  >
                    {generatingSection === section.id ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Generating...
                      </>
                    ) : hasContent ? (
                      "Regenerate"
                    ) : (
                      "Generate"
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Full Workspace Link */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Need more control? Access the full proposal workspace with rich
              editing tools.
            </p>
            <Button asChild variant="outline">
              <a href={`/projects/${projectId}/workspace`}>
                Open Full Workspace
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
