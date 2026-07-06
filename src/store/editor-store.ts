import { create } from "zustand";

type EditorState = {
  selectedSectionId: string | null;
  setSelectedSectionId: (sectionId: string) => void;
};

export const useEditorStore = create<EditorState>((set) => ({
  selectedSectionId: null,
  setSelectedSectionId: (sectionId) => set({ selectedSectionId: sectionId })
}));
