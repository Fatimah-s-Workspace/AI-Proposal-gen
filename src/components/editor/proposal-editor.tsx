"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Bold,
  ChevronDown,
  Check,
  History,
  Italic,
  List,
  Loader2,
  RotateCw,
  Save,
  Lightbulb,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Wrench,
} from "lucide-react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editor-store";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Version = {
  id: string;
  provider: string;
  contentType: string;
  version: number;
  createdAt: string;
};

type Section = {
  id: string;
  title: string;
  slug: string;
  sectionType: string;
  order: number;
  content: string | null;
  status: string;
  wordTarget: number;
  versions: Version[];
};

type Requirement = {
  id: string;
  title: string;
  description: string;
  category: string;
  sourceClause?: string | null;
  priority: string;
  status: string;
  owner?: string | null;
  evidenceNeeded?: string[];
  evidenceMatches?: unknown[];
};

type Clause = {
  id: string;
  clause: string;
  plainEnglish: string;
  riskLevel: "high" | "medium" | "low";
  action: string;
};

type SectionPlan = {
  title: string;
  slug: string;
  sectionType: string;
  order: number;
  wordTarget: number;
  importance: "high" | "medium" | "low";
  prompt: string;
  rationale: string;
  requirementIds: string[];
  clauseIds: string[];
  sourceDocumentIds: string[];
  sourceSectionTitles: string[];
};

type DraftChecklistAnalysis = {
  sectionPlan: SectionPlan[];
  mappings: Array<{
    requirementId: string;
    proposalSectionType: string;
    mappingStrength: string;
    status: string;
    notes: string;
  }>;
  sectionMetrics: Array<{
    sectionType: string;
    coverage: number;
    missing: number;
    weak: number;
    strong: number;
    complianceScore: number;
    qualityIssues: Array<{
      issueType: string;
      severity: string;
      affectedText: string;
      recommendation: string;
    }>;
    mappedRequirements: string[];
  }>;
  coverage: Record<string, number>;
  complianceScores: Record<string, number>;
  qualityReview: {
    issues: Array<{
      type: string;
      severity: string;
      description: string;
      suggestion: string;
    }>;
    overallScore: number;
  };
  recommendations: string[];
};

type ApiSection = Omit<Section, "versions"> & {
  versions?: Version[];
  generatedContents?: Version[];
};

type LiveCompliance = {
  complianceScore: number;
  issues: Array<{
    type: string;
    severity: "high" | "medium" | "low";
    message: string;
    suggestion: string;
  }>;
  wordCount: number;
  characterCount: number;
};

export function ProposalEditor({
  projectId,
  sections,
  sectionPlan = [],
  requirements = [],
  clauses = [],
}: {
  projectId: string;
  sections: Section[];
  sectionPlan?: SectionPlan[];
  requirements?: Requirement[];
  clauses?: Clause[];
}) {
  const [localSections, setLocalSections] = useState(sections);
  const [assistantOverride, setAssistantOverride] =
    useState<DraftChecklistAnalysis | null>(null);
  const { selectedSectionId, setSelectedSectionId } = useEditorStore();
  const [activeTab, setActiveTab] = useState("suggestions");
  const initialSectionId = selectedSectionId ?? localSections[0]?.id ?? null;
  const selectedSection = useMemo(
    () =>
      localSections.find((section) => section.id === initialSectionId) ??
      localSections[0],
    [initialSectionId, localSections],
  );

  // Query for draft checklist analysis
  const { data: checklistAnalysis, refetch: refetchChecklist } = useQuery({
    queryKey: ["draft-checklist", projectId],
    queryFn: async () => {
      const response = await fetch(
        `/api/projects/${projectId}/ai/draft-against-checklist`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error("Failed to fetch checklist analysis");
      return response.json() as Promise<DraftChecklistAnalysis>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  const assistantData = assistantOverride ?? checklistAnalysis;
  const activeSectionPlan = useMemo(
    () =>
      (assistantData?.sectionPlan ?? sectionPlan).find(
        (item) =>
          item.slug === selectedSection?.slug ||
          item.sectionType === selectedSection?.sectionType,
      ) ?? sectionPlan.find((item) => item.slug === selectedSection?.slug),
    [assistantData, sectionPlan, selectedSection],
  );

  // Live compliance analysis
  const { data: liveCompliance, isLoading: complianceLoading } =
    useQuery<LiveCompliance | null>({
      queryKey: [
        "live-compliance",
        projectId,
        selectedSection?.id,
        selectedSection?.content,
      ],
      queryFn: async () => {
        if (!selectedSection?.content || selectedSection.content.length < 50) {
          return null; // Don't analyze very short content
        }
        const response = await fetch(
          `/api/projects/${projectId}/proposal-sections/${selectedSection.id}/compliance`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: selectedSection.content }),
          },
        );
        if (!response.ok) throw new Error("Failed to analyze compliance");
        return response.json() as Promise<LiveCompliance>;
      },
      enabled:
        !!selectedSection?.content && selectedSection.content.length >= 50,
      staleTime: 2000, // 2 seconds - allow for quick re-analysis
      refetchOnWindowFocus: false,
    });

  // Computed values for the new features
  const sectionRequirements = useMemo(() => {
    if (!assistantData || !selectedSection) return [];
    return assistantData.mappings
      .filter((mapping) => mapping.proposalSectionType === selectedSection.slug)
      .map((mapping) => {
        const requirement = requirements.find(
          (req) => req.id === mapping.requirementId,
        );
        return requirement ? { ...requirement, mapping } : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [assistantData, selectedSection, requirements]);

  const sectionClauses = useMemo(() => {
    if (!selectedSection) return [];
    if (activeSectionPlan?.clauseIds.length) {
      return clauses.filter((clause) =>
        activeSectionPlan.clauseIds.includes(clause.id),
      );
    }
    const sectionKeywords = selectedSection.slug
      .replace(/-/g, " ")
      .toLowerCase();
    return clauses.filter(
      (clause) =>
        clause.clause.toLowerCase().includes(sectionKeywords) ||
        clause.plainEnglish.toLowerCase().includes(sectionKeywords),
    );
  }, [selectedSection, clauses, activeSectionPlan]);

  const sectionMetrics = useMemo(() => {
    if (!assistantData || !selectedSection) return null;
    return (
      assistantData.sectionMetrics.find(
        (metric) => metric.sectionType === selectedSection.slug,
      ) || null
    );
  }, [assistantData, selectedSection]);

  const complianceScore = useMemo(() => {
    return sectionMetrics?.complianceScore || 0;
  }, [sectionMetrics]);

  const sectionComplianceLabel =
    complianceScore === null
      ? "No score available"
      : `${complianceScore}% compliant`;
  const complianceVariant =
    complianceScore === null
      ? "secondary"
      : complianceScore > 80
        ? "default"
        : complianceScore > 60
          ? "secondary"
          : "destructive";

  const qualityIssues = sectionMetrics?.qualityIssues ?? [];

  const requirementsCoveredCount = useMemo(() => {
    return sectionRequirements.length;
  }, [sectionRequirements]);

  const missingEvidenceCount = useMemo(() => {
    return sectionRequirements.filter((req) => !req.evidenceMatches?.length)
      .length;
  }, [sectionRequirements]);

  const clausesAddressedCount = useMemo(() => {
    return sectionClauses.length;
  }, [sectionClauses]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedIdRef = useRef<string | null>(initialSectionId);

  const editor = useEditor({
    extensions: [StarterKit],
    content: selectedSection?.content || emptySection(selectedSection?.title),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "editor-content min-h-[520px] focus:outline-none",
      },
    },
    onUpdate({ editor }) {
      const sectionId = selectedIdRef.current;
      if (!sectionId) return;
      const html = editor.getHTML();
      setLocalSections((current) =>
        current.map((section) =>
          section.id === sectionId
            ? { ...section, content: html, status: "drafting" }
            : section,
        ),
      );
      scheduleSave(sectionId, html);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({
      sectionId,
      content,
    }: {
      sectionId: string;
      content: string;
    }) => {
      const response = await fetch(`/api/proposal-sections/${sectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error("Autosave failed");
      return response.json();
    },
    onMutate: () => setSaveState("saving"),
    onSuccess: (payload: ApiSection) => {
      const updatedSection = normalizeSection(payload);
      setSaveState("saved");
      setLocalSections((current) =>
        current.map((section) =>
          section.id === updatedSection.id
            ? {
                ...section,
                content: updatedSection.content,
                status: updatedSection.status,
                versions: updatedSection.versions,
              }
            : section,
        ),
      );
    },
    onError: () => setSaveState("idle"),
  });

  const regenerateMutation = useMutation({
    mutationFn: async (sectionId: string) => {
      const response = await fetch(
        `/api/projects/${projectId}/ai/generate-proposal`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sectionId, tone: "formal" }),
        },
      );
      if (!response.ok) throw new Error("Generation failed");
      return response.json() as Promise<{
        sections?: ApiSection[];
        assistant?: DraftChecklistAnalysis;
      }>;
    },
    onSuccess: (payload) => {
      if (payload.assistant) setAssistantOverride(payload.assistant);
      const updated = payload.sections?.[0]
        ? normalizeSection(payload.sections[0])
        : null;
      if (!updated) return;
      setLocalSections((current) =>
        current.map((section) =>
          section.id === updated.id
            ? {
                ...section,
                content: updated.content,
                status: updated.status,
                versions: updated.versions,
              }
            : section,
        ),
      );
      editor?.commands.setContent(
        updated.content || emptySection(updated.title),
      );
    },
  });

  const generateAllMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/projects/${projectId}/ai/generate-proposal`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tone: "formal" }),
        },
      );
      if (!response.ok) throw new Error("Generation failed");
      return response.json() as Promise<{
        sections?: ApiSection[];
        assistant?: DraftChecklistAnalysis;
      }>;
    },
    onSuccess: (payload) => {
      if (payload.assistant) setAssistantOverride(payload.assistant);
      const updatedSections = (payload.sections ?? []).map(normalizeSection);
      if (!updatedSections.length) return;
      setLocalSections((current) => mergeSections(current, updatedSections));
      const selected =
        updatedSections.find((section) => section.id === selectedSection?.id) ??
        updatedSections[0];
      if (selected) {
        setSelectedSectionId(selected.id);
        editor?.commands.setContent(
          selected.content || emptySection(selected.title),
        );
      }
    },
  });

  const planMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/projects/${projectId}/proposal-sections/plan`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error("Section planning failed");
      return response.json() as Promise<{
        sections?: ApiSection[];
        assistant?: DraftChecklistAnalysis;
      }>;
    },
    onSuccess: (payload) => {
      if (payload.assistant) setAssistantOverride(payload.assistant);
      const plannedSections = (payload.sections ?? []).map(normalizeSection);
      if (!plannedSections.length) return;
      setLocalSections(plannedSections.sort((a, b) => a.order - b.order));
      if (
        !plannedSections.some((section) => section.id === selectedSection?.id)
      ) {
        setSelectedSectionId(plannedSections[0].id);
      }
    },
  });

  useEffect(() => {
    if (!selectedSectionId && localSections[0]) {
      setSelectedSectionId(localSections[0].id);
    }
  }, [localSections, selectedSectionId, setSelectedSectionId]);

  useEffect(() => {
    if (!editor || !selectedSection) return;
    selectedIdRef.current = selectedSection.id;
    const nextContent =
      selectedSection.content || emptySection(selectedSection.title);
    if (editor.getHTML() !== nextContent) {
      editor.commands.setContent(nextContent);
    }
  }, [editor, selectedSection]);

  function scheduleSave(sectionId: string, content: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("idle");
    saveTimer.current = setTimeout(
      () => saveMutation.mutate({ sectionId, content }),
      900,
    );
  }

  if (!selectedSection) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="font-medium">No proposal sections</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a project to initialise proposal sections.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
      <aside className="max-h-[calc(100svh-8rem)] space-y-2 overflow-y-auto pr-1 lg:sticky lg:top-24">
        {localSections.map((section) => {
          const plan = (assistantData?.sectionPlan ?? sectionPlan).find(
            (item) =>
              item.slug === section.slug ||
              item.sectionType === section.sectionType,
          );
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => setSelectedSectionId(section.id)}
              className={cn(
                "w-full rounded-md border px-3 py-3 text-left text-sm transition-colors hover:bg-muted",
                selectedSection.id === section.id &&
                  "border-primary bg-primary/10",
              )}
            >
              <span className="block font-medium">{section.title}</span>
              <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{section.status.replace("_", " ")}</span>
                {plan ? (
                  <>
                    <span>·</span>
                    <span>{plan.importance} priority</span>
                    <span>·</span>
                    <span>{plan.requirementIds.length} reqs</span>
                  </>
                ) : null}
              </span>
            </button>
          );
        })}
      </aside>
      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-col gap-3 border-b p-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold tracking-normal">
                {selectedSection.title}
              </h2>
              <Badge variant="secondary">
                {selectedSection.wordTarget} words
              </Badge>
              {complianceScore !== null && (
                <Badge
                  variant={
                    complianceScore > 80
                      ? "default"
                      : complianceScore > 60
                        ? "secondary"
                        : "destructive"
                  }
                  className="text-xs"
                >
                  {complianceScore}% compliant
                </Badge>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    <Wrench />
                    Tools
                    <ChevronDown className="size-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-2">
                  <div className="space-y-1">
                    <ToolMenuButton
                      icon={
                        planMutation.isPending ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Sparkles />
                        )
                      }
                      label="Refresh plan"
                      disabled={planMutation.isPending}
                      onClick={() => planMutation.mutate()}
                    />
                    <ToolMenuButton
                      icon={
                        generateAllMutation.isPending ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <FileText />
                        )
                      }
                      label="Generate all sections"
                      disabled={generateAllMutation.isPending}
                      onClick={() => generateAllMutation.mutate()}
                    />
                    <ToolMenuButton
                      icon={
                        regenerateMutation.isPending ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <RotateCw />
                        )
                      }
                      label="Regenerate current section"
                      disabled={regenerateMutation.isPending}
                      onClick={() =>
                        regenerateMutation.mutate(selectedSection.id)
                      }
                    />
                    <div className="my-2 border-t" />
                    <ToolMenuButton
                      icon={<Bold />}
                      label="Bold"
                      onClick={() => editor?.chain().focus().toggleBold().run()}
                    />
                    <ToolMenuButton
                      icon={<Italic />}
                      label="Italic"
                      onClick={() =>
                        editor?.chain().focus().toggleItalic().run()
                      }
                    />
                    <ToolMenuButton
                      icon={<List />}
                      label="Bullet list"
                      onClick={() =>
                        editor?.chain().focus().toggleBulletList().run()
                      }
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              {saveState === "saving" ? (
                <Loader2 className="size-3 animate-spin" />
              ) : saveState === "saved" ? (
                <Check className="size-3" />
              ) : (
                <Save className="size-3" />
              )}
              {saveState === "saving"
                ? "Autosaving"
                : saveState === "saved"
                  ? "Saved"
                  : "Autosave ready"}
            </p>
            {activeSectionPlan ? (
              <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                {activeSectionPlan.rationale}
              </p>
            ) : null}
          </div>
        </div>
        <div className="max-h-[680px] overflow-auto p-6">
          <EditorContent editor={editor} />
        </div>
      </section>

      {/* New AI Features Sidebar */}
      <aside className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI Assistant
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-6 h-9">
                <TabsTrigger value="requirements" className="text-xs px-1">
                  <CheckCircle2 className="h-3 w-3" />
                  <span className="sr-only">Requirements Covered</span>
                </TabsTrigger>
                <TabsTrigger value="clauses" className="text-xs px-1">
                  <FileText className="h-3 w-3" />
                  <span className="sr-only">Related Clauses</span>
                </TabsTrigger>
                <TabsTrigger value="suggestions" className="text-xs px-1">
                  <Lightbulb className="h-3 w-3" />
                  <span className="sr-only">AI Suggestions</span>
                </TabsTrigger>
                <TabsTrigger value="compliance" className="text-xs px-1">
                  <AlertTriangle className="h-3 w-3" />
                  <span className="sr-only">Compliance</span>
                </TabsTrigger>
                <TabsTrigger value="live-check" className="text-xs px-1">
                  <Sparkles className="h-3 w-3" />
                  <span className="sr-only">Live Check</span>
                </TabsTrigger>
                <TabsTrigger value="versions" className="text-xs px-1">
                  <History className="h-3 w-3" />
                  <span className="sr-only">Version History</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="requirements" className="p-4 space-y-3">
                <div className="space-y-3">
                  <div className="rounded-lg border bg-muted p-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">Requirements Covered</p>
                        <p className="text-muted-foreground text-xs">
                          {requirementsCoveredCount} requirement
                          {requirementsCoveredCount === 1 ? "" : "s"} mapped
                        </p>
                      </div>
                      <Badge variant={complianceVariant} className="text-xs">
                        {sectionComplianceLabel}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Missing evidence: {missingEvidenceCount}
                    </p>
                  </div>

                  {sectionRequirements.length > 0 ? (
                    <div className="space-y-3 max-h-72 overflow-y-auto">
                      {sectionRequirements.map((req) => (
                        <div
                          key={req.id}
                          className="p-3 rounded-lg border bg-background text-xs"
                        >
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Badge
                              variant={
                                req.priority === "high"
                                  ? "destructive"
                                  : "secondary"
                              }
                              className="text-xs h-4"
                            >
                              {req.priority}
                            </Badge>
                            <Badge variant="outline" className="text-xs h-4">
                              {req.mapping?.mappingStrength}
                            </Badge>
                            <span className="text-muted-foreground">
                              {req.status.replace("_", " ")}
                            </span>
                          </div>
                          <p className="font-medium">{req.title}</p>
                          <p className="text-muted-foreground text-[11px] line-clamp-2">
                            {req.description}
                          </p>
                          <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                            <p>
                              Source: {req.sourceClause ?? "Tender requirement"}
                            </p>
                            <p>
                              Evidence needed:{" "}
                              {req.evidenceNeeded?.length
                                ? req.evidenceNeeded.join(", ")
                                : "None specified"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No requirements are currently mapped to this section.
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="clauses" className="p-4 space-y-3">
                <div className="space-y-3">
                  <div className="rounded-lg border bg-muted p-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">Related Clauses</p>
                        <p className="text-muted-foreground text-xs">
                          {clausesAddressedCount} clause
                          {clausesAddressedCount === 1 ? "" : "s"} matched
                        </p>
                      </div>
                      <Badge variant={complianceVariant} className="text-xs">
                        {sectionComplianceLabel}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {missingEvidenceCount} evidence item
                      {missingEvidenceCount === 1 ? "" : "s"} still open.
                    </p>
                  </div>

                  {sectionClauses.length > 0 ? (
                    <div className="space-y-3 max-h-72 overflow-y-auto">
                      {sectionClauses.map((clause, index) => (
                        <div
                          key={index}
                          className="p-3 rounded-lg border bg-background text-xs"
                        >
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Badge
                              variant={
                                clause.riskLevel === "high"
                                  ? "destructive"
                                  : clause.riskLevel === "medium"
                                    ? "secondary"
                                    : "outline"
                              }
                              className="text-xs h-4"
                            >
                              {clause.riskLevel} risk
                            </Badge>
                          </div>
                          <p className="font-medium">{clause.clause}</p>
                          <p className="text-muted-foreground text-[11px] line-clamp-3">
                            {clause.plainEnglish}
                          </p>
                          <p className="text-primary text-[11px] mt-1 font-medium">
                            {clause.action}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No matching clauses were found for this section.
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="suggestions" className="p-4 space-y-3">
                <div className="space-y-3">
                  <div className="rounded-lg border bg-muted p-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">AI Suggestions</p>
                        <p className="text-muted-foreground text-xs">
                          {assistantData
                            ? `${assistantData.recommendations.length} suggestions available`
                            : "Generate section guidance"}
                        </p>
                      </div>
                      <Badge variant={complianceVariant} className="text-xs">
                        {sectionComplianceLabel}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Missing evidence items: {missingEvidenceCount}
                    </p>
                  </div>

                  {assistantData ? (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {assistantData.recommendations.map((rec, i) => (
                        <div
                          key={i}
                          className="p-2 rounded-lg border bg-background text-xs"
                        >
                          {rec}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => refetchChecklist()}
                      className="w-full"
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      Generate analysis
                    </Button>
                  )}
                  {activeSectionPlan ? (
                    <div className="rounded-lg border bg-background p-3 text-xs">
                      <p className="font-medium">Why this section exists</p>
                      <p className="mt-1 text-muted-foreground">
                        {activeSectionPlan.rationale}
                      </p>
                      <p className="mt-2 text-muted-foreground">
                        Sources:{" "}
                        {activeSectionPlan.sourceSectionTitles.length
                          ? activeSectionPlan.sourceSectionTitles.join(", ")
                          : "Mapped requirements and clauses"}
                      </p>
                    </div>
                  ) : null}
                </div>
              </TabsContent>

              <TabsContent value="compliance" className="p-4 space-y-3">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Compliance & Quality</h4>
                  {sectionMetrics ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span>Coverage</span>
                            <span>{sectionMetrics.coverage}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="h-2 rounded-full bg-blue-500"
                              style={{ width: `${sectionMetrics.coverage}%` }}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span>Compliance</span>
                            <span>{sectionMetrics.complianceScore}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className={cn(
                                "h-2 rounded-full",
                                sectionMetrics.complianceScore > 80
                                  ? "bg-green-500"
                                  : sectionMetrics.complianceScore > 60
                                    ? "bg-yellow-500"
                                    : "bg-red-500",
                              )}
                              style={{
                                width: `${sectionMetrics.complianceScore}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-green-50 rounded text-xs">
                          <div className="font-medium text-green-700">
                            {sectionMetrics.strong}
                          </div>
                          <div className="text-green-600">Strong</div>
                        </div>
                        <div className="p-2 bg-yellow-50 rounded text-xs">
                          <div className="font-medium text-yellow-700">
                            {sectionMetrics.weak}
                          </div>
                          <div className="text-yellow-600">Weak</div>
                        </div>
                        <div className="p-2 bg-red-50 rounded text-xs">
                          <div className="font-medium text-red-700">
                            {sectionMetrics.missing}
                          </div>
                          <div className="text-red-600">Missing</div>
                        </div>
                      </div>

                      {qualityIssues.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="text-xs font-medium">
                            Quality Issues
                          </h5>
                          {qualityIssues.map((issue, i) => (
                            <div key={i} className="p-2 border rounded text-xs">
                              <div className="flex items-center gap-1 mb-1">
                                <AlertTriangle className="h-3 w-3 text-amber-500" />
                                <Badge
                                  variant={
                                    issue.severity === "critical"
                                      ? "destructive"
                                      : "secondary"
                                  }
                                  className="text-xs h-4"
                                >
                                  {issue.severity}
                                </Badge>
                                <span className="font-medium">
                                  {issue.issueType}
                                </span>
                              </div>
                              <p className="text-muted-foreground">
                                {issue.recommendation}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No compliance data available.
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="live-check" className="p-4 space-y-3">
                <div className="space-y-3">
                  <div className="rounded-lg border bg-muted p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">Live section check</p>
                      {complianceLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : liveCompliance ? (
                        <Badge variant="outline" className="text-xs">
                          {liveCompliance.complianceScore}% score
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-muted-foreground">
                      Checks the current draft against mapped tender
                      requirements and evidence language.
                    </p>
                  </div>

                  {liveCompliance ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-md border bg-background p-2">
                          <p className="font-medium">
                            {liveCompliance.wordCount}
                          </p>
                          <p className="text-muted-foreground">Words</p>
                        </div>
                        <div className="rounded-md border bg-background p-2">
                          <p className="font-medium">
                            {liveCompliance.issues.length}
                          </p>
                          <p className="text-muted-foreground">Issues</p>
                        </div>
                      </div>
                      <div className="max-h-72 space-y-2 overflow-y-auto">
                        {liveCompliance.issues.length ? (
                          liveCompliance.issues.map((issue, index) => (
                            <div
                              key={`${issue.type}-${index}`}
                              className="rounded-lg border bg-background p-3 text-xs"
                            >
                              <div className="mb-1 flex items-center gap-2">
                                <Badge
                                  variant={
                                    issue.severity === "high"
                                      ? "destructive"
                                      : "secondary"
                                  }
                                  className="h-4 text-xs"
                                >
                                  {issue.severity}
                                </Badge>
                                <span className="font-medium">
                                  {issue.message}
                                </span>
                              </div>
                              <p className="text-muted-foreground">
                                {issue.suggestion}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            No live issues detected for this draft.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Add at least 50 characters to run a live section check.
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="versions" className="p-4 space-y-3">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Version History</h4>
                  <p className="text-xs text-muted-foreground">
                    Track saved drafts, regenerations, and AI versions.
                  </p>
                </div>
                <div className="space-y-3 max-h-72 overflow-y-auto">
                  {selectedSection.versions.length ? (
                    selectedSection.versions.map((version) => (
                      <div
                        key={version.id}
                        className="rounded-lg border bg-background p-3 text-xs"
                      >
                        <p className="font-medium">
                          v{version.version} ·{" "}
                          {version.contentType.replace("_", " ")}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {new Intl.DateTimeFormat("en-NG", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(version.createdAt))}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Saved edits and generated versions will appear here.
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function emptySection(title = "Proposal section") {
  return `<h2>${title}</h2><p>Generate this section from the uploaded tender intelligence, then review the mapped requirements and evidence notes before export.</p>`;
}

function ToolMenuButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
    >
      <span className="flex size-4 items-center justify-center">{icon}</span>
      {label}
    </button>
  );
}

function normalizeSection(section: ApiSection): Section {
  return {
    id: section.id,
    title: section.title,
    slug: section.slug || section.sectionType,
    sectionType: section.sectionType || section.slug,
    order: section.order,
    content: section.content ?? null,
    status: section.status,
    wordTarget: section.wordTarget,
    versions: section.versions ?? section.generatedContents ?? [],
  };
}

function mergeSections(current: Section[], incoming: Section[]) {
  const next = new Map(current.map((section) => [section.id, section]));
  for (const section of incoming) {
    next.set(section.id, {
      ...(next.get(section.id) ?? section),
      ...section,
    });
  }
  return [...next.values()].sort((a, b) => a.order - b.order);
}
