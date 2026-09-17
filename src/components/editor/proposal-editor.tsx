"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BookMarked,
  Bold,
  MessageSquare,
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
  X,
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
import { SectionLibraryPanel } from "@/components/library/section-library-panel";
import { SectionCommentsPanel } from "@/components/review/section-comments-panel";
import { SectionStatusControl } from "@/components/review/section-status-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TruncatedText } from "@/components/ui/truncated-text";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ClausePanel } from "@/components/editor/clause-panel";

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
    unassessable?: number;
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
  currentUserId,
  projectId,
  sections,
  sectionPlan = [],
  requirements = [],
  clauses = [],
}: {
  currentUserId: string;
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
  // On mobile the section list, editor, AI assistant, and clause notes
  // stack vertically with no lg:grid-cols to split them into columns - left
  // unmanaged that's four long panels to scroll through just to get from
  // picking a section to seeing its AI suggestions. This tracks which
  // single panel mobile shows at a time; desktop ignores it and always
  // shows all of them via lg:block, since only one instance of the editor
  // can ever be mounted. Section choice itself isn't a tab on mobile - a
  // dropdown drives the same selectedSectionId the desktop section list
  // does, so switching sections doesn't cost a whole tab slot.
  const [mobileView, setMobileView] = useState<
    "draft" | "assistant" | "clauses"
  >("draft");
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
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null);
  // The badge beside the section title already reports the current section's
  // origin, but it is passive: after "Generate all sections" the user is
  // looking at one section while a different one may be the template draft.
  // This says so at the moment it happens, and names which.
  const [fallbackNotice, setFallbackNotice] = useState<
    { titles: string[]; reason?: string } | null
  >(null);
  const latestDraftOrigin = useMemo(() => {
    const latestGenerated = selectedSection?.versions.find(
      (version) => version.contentType === "proposal_section",
    );
    return latestGenerated ? describeProvider(latestGenerated.provider) : null;
  }, [selectedSection]);
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

  const versionPreviewQuery = useQuery({
    queryKey: ["section-version", selectedSection?.id, previewVersionId],
    enabled: Boolean(selectedSection?.id && previewVersionId),
    queryFn: async () => {
      const response = await fetch(
        `/api/proposal-sections/${selectedSection?.id}/versions/${previewVersionId}`,
      );
      if (!response.ok) throw new Error("Failed to load version");
      return response.json() as Promise<{
        version: Version & { output: string };
      }>;
    },
  });

  function restoreVersion(output: string) {
    const sectionId = selectedIdRef.current;
    if (!sectionId || !editor) return;
    editor.commands.setContent(output, { emitUpdate: false });
    setLocalSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? { ...section, content: output, status: "drafting" }
          : section,
      ),
    );
    saveMutation.mutate({ sectionId, content: output });
  }

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
        section?: ApiSection;
        sections?: ApiSection[];
        assistant?: DraftChecklistAnalysis;
        fallbackSections?: Array<{ title: string; reason?: string }>;
      }>;
    },
    onMutate: () => setFallbackNotice(null),
    onSuccess: (payload) => {
      if (payload.assistant) setAssistantOverride(payload.assistant);
      setFallbackNotice(
        payload.fallbackSections?.length
          ? {
              titles: payload.fallbackSections.map((item) => item.title),
              reason: payload.fallbackSections[0]?.reason,
            }
          : null,
      );
      const incomingSections =
        payload.sections ?? (payload.section ? [payload.section] : []);
      const updated = incomingSections[0]
        ? normalizeSection(incomingSections[0])
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
      editor?.commands.setContent(updated.content || emptySection(updated.title), {
        emitUpdate: false,
      });
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
        section?: ApiSection;
        sections?: ApiSection[];
        assistant?: DraftChecklistAnalysis;
        fallbackSections?: Array<{ title: string; reason?: string }>;
      }>;
    },
    onMutate: () => setFallbackNotice(null),
    onSuccess: (payload) => {
      if (payload.assistant) setAssistantOverride(payload.assistant);
      setFallbackNotice(
        payload.fallbackSections?.length
          ? {
              titles: payload.fallbackSections.map((item) => item.title),
              reason: payload.fallbackSections[0]?.reason,
            }
          : null,
      );
      const incomingSections =
        payload.sections ?? (payload.section ? [payload.section] : []);
      const updatedSections = incomingSections.map(normalizeSection);
      if (!updatedSections.length) return;
      setLocalSections((current) => mergeSections(current, updatedSections));
      const selected =
        updatedSections.find((section) => section.id === selectedSection?.id) ??
        updatedSections[0];
      if (selected) {
        setSelectedSectionId(selected.id);
        editor?.commands.setContent(
          selected.content || emptySection(selected.title),
          { emitUpdate: false },
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

  const [previewSectionId, setPreviewSectionId] = useState(selectedSectionId);
  if (previewSectionId !== selectedSectionId) {
    setPreviewSectionId(selectedSectionId);
    setPreviewVersionId(null);
  }

  useEffect(() => {
    if (!editor || !selectedSection) return;
    selectedIdRef.current = selectedSection.id;
    const nextContent =
      selectedSection.content || emptySection(selectedSection.title);
    if (editor.getHTML() !== nextContent) {
      editor.commands.setContent(nextContent, { emitUpdate: false });
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
    <div className="space-y-4">
      <div className="sticky top-14 z-10 -mx-4 space-y-3 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
        <Select
          value={selectedSection.id}
          onValueChange={(value) => setSelectedSectionId(value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Choose a section" />
          </SelectTrigger>
          <SelectContent>
            {localSections.map((section) => (
              <SelectItem key={section.id} value={section.id}>
                {section.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Tabs
          value={mobileView}
          onValueChange={(value) => setMobileView(value as typeof mobileView)}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="assistant">Assistant</TabsTrigger>
            <TabsTrigger value="clauses">Clauses</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
      <aside className="hidden max-h-[calc(100svh-8rem)] space-y-2 overflow-y-auto pr-1 lg:sticky lg:top-24 lg:block">
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
      <section
        className={cn(
          "overflow-hidden rounded-lg border bg-card lg:block",
          mobileView !== "draft" && "hidden",
        )}
      >
        <div className="flex flex-col gap-3 border-b p-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
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
              {latestDraftOrigin && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    providerBadgeClass(latestDraftOrigin.tone),
                  )}
                  title={latestDraftOrigin.detail}
                >
                  {latestDraftOrigin.tone === "warn" && (
                    <AlertTriangle className="mr-1 size-3" />
                  )}
                  {latestDraftOrigin.label}
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
          {fallbackNotice ? (
            <div
              role="status"
              className="mb-3 flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {fallbackNotice.titles.length === 1
                    ? "This draft was not written by the AI"
                    : `${fallbackNotice.titles.length} sections were not written by the AI`}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {fallbackReasonText(fallbackNotice.reason)} A local template
                  draft was written instead
                  {fallbackNotice.titles.length > 1
                    ? ` for: ${fallbackNotice.titles.join(", ")}`
                    : ""}
                  . Regenerate to try the AI again.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFallbackNotice(null)}
                aria-label="Dismiss"
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-amber-100 hover:text-foreground dark:hover:bg-amber-900"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : null}
          <EditorContent editor={editor} />
        </div>
      </section>

      {/* New AI Features Sidebar */}
      <aside
        className={cn("space-y-4 lg:block", mobileView !== "assistant" && "hidden")}
      >
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
              <TabsList className="grid w-full grid-cols-8 h-9">
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
                <TabsTrigger value="review" className="text-xs px-1">
                  <MessageSquare className="h-3 w-3" />
                  <span className="sr-only">Review and comments</span>
                </TabsTrigger>
                <TabsTrigger value="library" className="text-xs px-1">
                  <BookMarked className="h-3 w-3" />
                  <span className="sr-only">Saved answers</span>
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
                          <TruncatedText
                            as="p"
                            text={req.title}
                            className="font-medium"
                          />
                          <TruncatedText
                            as="p"
                            text={req.description}
                            lines={2}
                            tooltipMaxChars={500}
                            className="text-muted-foreground text-[11px]"
                          />
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
                          <TruncatedText
                            as="p"
                            text={clause.clause}
                            className="font-medium"
                          />
                          <TruncatedText
                            as="p"
                            text={clause.plainEnglish}
                            lines={3}
                            tooltipMaxChars={500}
                            className="text-muted-foreground text-[11px]"
                          />
                          <TruncatedText
                            as="p"
                            text={clause.action}
                            lines={2}
                            className="text-primary text-[11px] mt-1 font-medium"
                          />
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

                      {sectionMetrics.unassessable ? (
                        // Said out loud, because these three numbers would
                        // otherwise quietly fail to add up to the number of
                        // requirements mapped to this section.
                        <p className="text-xs text-muted-foreground">
                          {sectionMetrics.unassessable} requirement
                          {sectionMetrics.unassessable === 1 ? " is" : "s are"} too
                          generally worded to check automatically, and
                          {sectionMetrics.unassessable === 1 ? " is" : " are"} left
                          out of these figures. Read {sectionMetrics.unassessable === 1 ? "it" : "them"} yourself.
                        </p>
                      ) : null}

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

              <TabsContent value="review" className="p-4 space-y-4">
                <SectionStatusControl
                  key={`status-${selectedSection.id}`}
                  projectId={projectId}
                  sectionId={selectedSection.id}
                  status={selectedSection.status}
                />
                <div className="border-t pt-4">
                  <SectionCommentsPanel
                    key={`comments-${selectedSection.id}`}
                    sectionId={selectedSection.id}
                    currentUserId={currentUserId}
                  />
                </div>
              </TabsContent>

              <TabsContent value="library" className="p-4">
                <SectionLibraryPanel
                  key={selectedSection.id}
                  projectId={projectId}
                  sectionId={selectedSection.id}
                  sectionTitle={selectedSection.title}
                  sectionType={selectedSection.sectionType}
                  getSectionText={() => editor?.getText() ?? ""}
                  onInsert={(content) => {
                    // Inserted at the cursor rather than replacing the draft:
                    // a saved answer is usually one part of a section, and
                    // overwriting what someone has already written to add a
                    // paragraph would be its own kind of data loss.
                    editor?.chain().focus().insertContent(content).run();
                  }}
                />
              </TabsContent>

              <TabsContent value="versions" className="p-4 space-y-3">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Version History</h4>
                  <p className="text-xs text-muted-foreground">
                    Click a version to preview it or load it back into the
                    editor.
                  </p>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {selectedSection.versions.length ? (
                    selectedSection.versions.map((version) => {
                      const isOpen = previewVersionId === version.id;
                      const preview = isOpen
                        ? versionPreviewQuery.data?.version
                        : null;
                      return (
                        <div
                          key={version.id}
                          className="rounded-lg border bg-background text-xs"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewVersionId(isOpen ? null : version.id)
                            }
                            className="flex w-full items-start justify-between gap-2 p-3 text-left transition-colors hover:bg-muted/50"
                            aria-expanded={isOpen}
                          >
                            <span>
                              <span className="flex items-center gap-1.5 font-medium">
                                v{version.version}
                                {(() => {
                                  const origin =
                                    version.contentType === "manual_edit"
                                      ? describeProvider("local")
                                      : describeProvider(version.provider);
                                  return (
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "px-1.5 py-0 text-[10px]",
                                        providerBadgeClass(origin.tone),
                                      )}
                                      title={origin.detail}
                                    >
                                      {origin.label}
                                    </Badge>
                                  );
                                })()}
                              </span>
                              <span className="mt-1 block text-muted-foreground">
                                {new Intl.DateTimeFormat("en-NG", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }).format(new Date(version.createdAt))}
                              </span>
                            </span>
                            <ChevronDown
                              className={cn(
                                "mt-0.5 h-3 w-3 shrink-0 text-muted-foreground transition-transform",
                                isOpen && "rotate-180",
                              )}
                            />
                          </button>
                          {isOpen ? (
                            <div className="border-t p-3 space-y-2">
                              {versionPreviewQuery.isPending ? (
                                <p className="flex items-center gap-2 text-muted-foreground">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Loading version…
                                </p>
                              ) : versionPreviewQuery.isError ? (
                                <p className="text-destructive">
                                  Could not load this version.
                                </p>
                              ) : preview ? (
                                <>
                                  <div
                                    className="editor-content max-h-48 overflow-y-auto rounded-md border bg-muted/30 p-2"
                                    dangerouslySetInnerHTML={{
                                      __html: preview.output,
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="w-full"
                                    disabled={saveMutation.isPending}
                                    onClick={() =>
                                      restoreVersion(preview.output)
                                    }
                                  >
                                    <RotateCw className="mr-1 h-3 w-3" />
                                    Load into editor
                                  </Button>
                                </>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
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

      <div className={cn("lg:block", mobileView !== "clauses" && "hidden")}>
        <ClausePanel clauses={clauses} />
      </div>
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

function describeProvider(provider: string): {
  label: string;
  tone: "ai" | "warn" | "muted";
  detail: string;
} {
  if (provider === "gemini") {
    return {
      label: "AI draft",
      tone: "ai",
      detail: "Generated with Gemini from the tender context.",
    };
  }
  if (provider === "gemini-fallback") {
    return {
      label: "Template draft",
      tone: "warn",
      detail:
        "The AI provider was unavailable (quota reached or no API key), so a local template draft was generated. Regenerate later to try AI again.",
    };
  }
  return {
    label: "Manual edit",
    tone: "muted",
    detail: "Saved from a manual edit in the editor.",
  };
}

function fallbackReasonText(reason?: string) {
  if (reason === "quota_or_availability")
    return "The AI provider was rate-limited or unavailable.";
  if (reason === "no_api_key") return "No AI provider is configured.";
  return "The AI provider could not be reached.";
}

function providerBadgeClass(tone: "ai" | "warn" | "muted") {
  if (tone === "ai") return "border-transparent bg-primary/15 text-primary";
  if (tone === "warn")
    return "border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400";
  return "border-transparent bg-muted text-muted-foreground";
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
