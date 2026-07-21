"use client";

import { useCallback, useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Save,
  RotateCcw,
  FileText,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ProposalSection = {
  id: string;
  title: string;
  content?: string;
  sectionType: string;
  version: number;
  generatedAt?: Date;
  wordTarget: number;
};

type AiToolsProposalEditorProps = {
  section: ProposalSection;
  projectId: string;
  onSave?: (content: string) => void;
  onRegenerate?: () => void;
  isGenerating?: boolean;
  className?: string;
};

const ToolbarButton = ({
  onClick,
  isActive,
  disabled,
  children,
  title,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}) => (
  <Button
    variant={isActive ? "default" : "ghost"}
    size="sm"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className="h-8 w-8 p-0"
  >
    {children}
  </Button>
);

export function AiToolsProposalEditor({
  section,
  onSave,
  onRegenerate,
  isGenerating = false,
  className,
}: AiToolsProposalEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [wordCount, setWordCount] = useState(0);

  const editor = useEditor({
    extensions: [StarterKit],
    content: section.content || "",
    onUpdate: ({ editor }) => {
      setHasUnsavedChanges(true);
      const text = editor.getText();
      setWordCount(text.trim().split(/\s+/).filter(word => word.length > 0).length);
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[400px] p-4",
      },
    },
  });

  const handleSave = useCallback(async () => {
    if (!editor || !onSave) return;

    setIsSaving(true);
    try {
      const content = editor.getHTML();
      await onSave(content);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  }, [editor, onSave]);

  async function handleRegenerate() {
    if (!onRegenerate) return;
    await onRegenerate();
  }

  // Auto-save functionality
  useEffect(() => {
    if (!hasUnsavedChanges || !editor) return;

    const saveTimer = setTimeout(async () => {
      await handleSave();
    }, 30000); // Auto-save after 30 seconds of inactivity

    return () => clearTimeout(saveTimer);
  }, [hasUnsavedChanges, editor, handleSave]);

  if (!editor) {
    return <div>Loading editor...</div>;
  }

  const progressPercentage = section.wordTarget > 0
    ? Math.min((wordCount / section.wordTarget) * 100, 100)
    : 0;

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {section.title}
            </CardTitle>
            <Badge variant="outline" className="capitalize">
              {section.sectionType.replace(/_/g, " ")}
            </Badge>
            <Badge variant="secondary">
              v{section.version}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <Badge variant="outline" className="text-amber-600">
                <Clock className="h-3 w-3 mr-1" />
                Unsaved
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <RotateCcw className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <RotateCcw className="h-3 w-3 mr-1" />
              )}
              Regenerate
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              size="sm"
            >
              {isSaving ? (
                <Save className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Save className="h-3 w-3 mr-1" />
              )}
              Save
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Words:</span>
            <span className="font-medium">{wordCount}</span>
            {section.wordTarget > 0 && (
              <>
                <span className="text-muted-foreground">/</span>
                <span className="text-muted-foreground">{section.wordTarget}</span>
              </>
            )}
          </div>

          {section.wordTarget > 0 && (
            <div className="flex-1 max-w-xs">
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    progressPercentage >= 100 ? "bg-green-500" :
                    progressPercentage >= 75 ? "bg-amber-500" : "bg-blue-500"
                  )}
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          )}

          {section.generatedAt && (
            <div className="text-xs text-muted-foreground">
              Generated {new Date(section.generatedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* Toolbar */}
        <div className="border rounded-lg p-2 mb-4">
          <div className="flex flex-wrap gap-1">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive("bold")}
              title="Bold"
            >
              <Bold className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive("italic")}
              title="Italic"
            >
              <Italic className="h-4 w-4" />
            </ToolbarButton>

            <Separator orientation="vertical" className="h-6 mx-1" />

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              isActive={editor.isActive("bulletList")}
              title="Bullet List"
            >
              <List className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              isActive={editor.isActive("orderedList")}
              title="Numbered List"
            >
              <ListOrdered className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              isActive={editor.isActive("blockquote")}
              title="Quote"
            >
              <Quote className="h-4 w-4" />
            </ToolbarButton>

            <Separator orientation="vertical" className="h-6 mx-1" />

            <ToolbarButton
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              title="Undo"
            >
              <Undo className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              title="Redo"
            >
              <Redo className="h-4 w-4" />
            </ToolbarButton>
          </div>
        </div>

        {/* Editor */}
        <div className="border rounded-lg min-h-[400px]">
          <EditorContent editor={editor} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <div className="text-xs text-muted-foreground">
            Auto-save enabled • Changes saved automatically every 30 seconds
          </div>
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <span className="text-xs text-amber-600">
                Unsaved changes will be lost if you leave this page
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
