import { create } from "zustand";

export type EditorState = {
	output: string;
	outputOpen: boolean;
};

export type EditorActions = {
	setOutput: (output: string) => void;
	clearOutput: () => void;
	openOutputWith: (output: string) => void;
	setOutputOpen: (outputOpen: boolean) => void;
	toggleOutputOpen: () => void;
	reset: () => void;
};

export type EditorStore = EditorState & EditorActions;

const initial: EditorState = {
	output: "",
	outputOpen: false,
};

export const useEditorStore = create<EditorStore>((set, get) => ({
	...initial,

	setOutput: (output) => set({ output }),
	clearOutput: () => set({ output: initial.output }),
	openOutputWith: (output) => set({ output, outputOpen: true }),
	setOutputOpen: (outputOpen) => set({ outputOpen }),
	toggleOutputOpen: () => set({ outputOpen: !get().outputOpen }),
	reset: () => set(initial),
}));
