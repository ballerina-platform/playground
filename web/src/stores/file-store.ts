import { create } from "zustand";

import { addNode, getNode, updateNode } from "@/lib/tree";

import type { FileNode, FilePath } from "@/types/files";

import EXAMPLES from "@/assets/examples.json";

const EMPTY_MAIN_BAL = `import ballerina/io;

public function main() {
		io:println("Hello, World!");
}`;

export type FileState = {
    tree: FileNode[];
    selectedFilePath: FilePath | null;
};

export type FileActions = {
    setTree: (tree: FileNode[]) => void;

    selectFile: (path: FilePath | null) => void;
    updateFile: (path: FilePath, content: string) => void;

    createEmptyFile: () => void;

    addNode: (parentPath: FilePath | null, node: FileNode) => void;
};

const DEFAULT_TREE = EXAMPLES as FileNode[];
const DEFAULT_SELECTED_FILE_PATH = "01-orders.bal";

export const useFileStore = create<FileState & FileActions>((set) => ({
    tree: DEFAULT_TREE,
    selectedFilePath: DEFAULT_SELECTED_FILE_PATH,

    setTree: (tree) => set((state) => {
        const selected = state.selectedFilePath
                ? getNode(tree, state.selectedFilePath)
                : null;
        return {
            tree,
            selectedFilePath: selected && selected.kind === "file"
                ? state.selectedFilePath
                : null,
        }
    }),

    selectFile: (path) =>
        set((state) => {
            const node = path ? getNode(state.tree, path) : null;
            if (!node || node.kind !== "file")
                return { selectedFilePath: path, selectedFile: null };
            return { selectedFilePath: path };
        }),
    updateFile: (path, content) => {
        set((state) => ({
            tree: updateNode(state.tree, path, (node) =>
                node.kind === "file" ? { ...node, content } : node,
            ),
        }));
    },

    createEmptyFile: () =>
        set((state) => {
            const newFileName = `${String(state.tree.length + 1).padStart(2, "0")}-main.bal`;
            const node: FileNode = {
                name: newFileName,
                kind: "file",
                content: EMPTY_MAIN_BAL,
            };
            return {
                tree: addNode(state.tree, null, node),
                selectedFilePath: newFileName,
            };
        }),

    addNode: (parentPath, node) => {
        set((state) => ({ tree: addNode(state.tree, parentPath, node) }));
    },
}));

export function useSelectedFile(): Extract<FileNode, { kind: "file" }> | null {
    const tree = useFileStore((state) => state.tree);
    const selectedFilePath = useFileStore((state) => state.selectedFilePath);
    if (!selectedFilePath) return null;
    const node = getNode(tree, selectedFilePath);
    if (!node || node.kind !== "file") return null;
    return node;
}

export function isExample(node: FileNode) {
    return DEFAULT_TREE.some((example) => example.name === node.name);
}
