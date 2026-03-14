import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { immer } from "zustand/middleware/immer";

import type { LayeredFS } from "@/lib/fs/layered-fs";
import type { FileNode } from "@/lib/fs/core/file-node.types";

const DEFAULT_MAIN_BAL = `import ballerina/io;

public function main() {
    io:println("Hello, World!");
}`;

const DEFAULT_BALLERINA_TOML = `[package]
org = "playground"
name = "{name}"
version = "0.1.0"`;

export type ActiveFile = {
	path: string;
	content: string;
	dirty: boolean;
};

export type FileOperationDialog = {
	type:
		| "new-file"
		| "new-folder"
		| "new-package"
		| "rename-file"
		| "rename-folder"
		| "delete-file"
		| "delete-folder";
	path: string;
	defaultName?: string;
} | null;

type FileTreeState = {
	tempTree: FileNode[];
	localTree: FileNode[];
	activeFile: ActiveFile | null;
	ready: boolean;

	fileOperationDialog: FileOperationDialog;

	expandedPaths: Set<string>;
};

type FileTreeActions = {
	init(fs: LayeredFS): void;

	openFile(path: string): void;
	saveFile(): boolean;
	createFile(path: string): boolean;
	deleteFile(path: string): boolean;
	renameFile(oldPath: string, newPath: string): boolean;

	createDir(path: string): boolean;
	deleteDir(path: string): boolean;

	updateFileContent(content: string): void;

	exists(path: string): boolean;

	createNewFile(path: string): boolean;
	createNewDir(path: string): boolean;

	createNewPackage(path: string, name: string): boolean;

	setFileOperationDialog(dialog: FileOperationDialog): void;

	toggleDir(path: string): void;
	expandDir(path: string): void;
	collapseDir(path: string): void;

	_syncTrees(): void;
};

export const useFileTreeStore = create<FileTreeState & FileTreeActions>()(
	immer((set, get) => {
		let fs: LayeredFS | null = null;

		const _fs = (): LayeredFS => {
			if (!fs) throw new Error("[FileTreeStore] FS not initialised");
			return fs;
		};

		return {
			tempTree: [],
			localTree: [],
			activeFile: null,
			ready: false,
			fileOperationDialog: null,
			expandedPaths: new Set<string>(),

			init(instance) {
				if (fs) return;
				fs = instance;
				set((s) => {
					if (!fs) return;
					s.tempTree = fs.tempTree();
					s.localTree = fs.localTree();
					s.ready = true;
				});
			},

			openFile(path) {
				const file = _fs().open(path);
				if (!file) return;
				set((s) => {
					s.activeFile = {
						path,
						content: file.content,
						dirty: false,
					};
				});
			},

			saveFile() {
				const { activeFile } = get();
				if (!activeFile || !activeFile.dirty) return false;
				const result = _fs().writeFile(activeFile.path, activeFile.content);
				if (!result) return false;
				set((s) => {
					if (s.activeFile) s.activeFile.dirty = false;
				});
				get()._syncTrees();
				return true;
			},

			createFile(path) {
				const result = _fs().writeFile(path, "");
				if (!result) return false;
				get()._syncTrees();
				return true;
			},

			deleteFile(path) {
				const result = _fs().remove(path);
				if (!result) return false;
				set((s) => {
					if (s.activeFile?.path === path) s.activeFile = null;
				});
				get()._syncTrees();
				return true;
			},

			renameFile(oldPath, newPath) {
				const result = _fs().move(oldPath, newPath);
				if (!result) return false;
				set((s) => {
					if (!s.activeFile) return;
					const currentPath = s.activeFile.path;
					if (currentPath === oldPath) {
						s.activeFile.path = newPath;
					} else if (currentPath.startsWith(`${oldPath}/`)) {
						const suffix = currentPath.slice(oldPath.length);
						s.activeFile.path = newPath + suffix;
					}
				});
				get()._syncTrees();
				return true;
			},

			createDir(path) {
				const result = _fs().mkdirAll(path);
				if (!result) return false;
				get()._syncTrees();
				return true;
			},

			deleteDir(path) {
				const result = _fs().remove(path);
				if (!result) return false;
				set((s) => {
					const activePath = s.activeFile?.path;
					if (activePath === path || activePath?.startsWith(`${path}/`)) {
						s.activeFile = null;
					}
				});
				get()._syncTrees();
				return true;
			},

			updateFileContent(content) {
				set((s) => {
					if (s.activeFile) {
						s.activeFile.content = content;
						s.activeFile.dirty = true;
					}
				});
			},

			exists(path) {
				try {
					return !!_fs().stat(path);
				} catch {
					return false;
				}
			},

			createNewFile(path) {
				const result = _fs().writeFile(path, "");
				if (!result) return false;
				get()._syncTrees();
				get().openFile(path);
				return true;
			},

			createNewDir(path) {
				const result = _fs().mkdirAll(path);
				if (!result) return false;
				get()._syncTrees();
				return true;
			},

			createNewPackage(path, name) {
				const dirPath = `${path}/${name}`;
				const dirResult = _fs().mkdirAll(dirPath);
				if (!dirResult) return false;
				const tomlPath = `${dirPath}/Ballerina.toml`;
				const balPath = `${dirPath}/main.bal`;
				const tomlResult = _fs().writeFile(
					tomlPath,
					DEFAULT_BALLERINA_TOML.replace("{name}", name),
				);
				const balResult = _fs().writeFile(balPath, DEFAULT_MAIN_BAL);
				if (!tomlResult || !balResult) return false;
				get()._syncTrees();
				get().openFile(balPath);
				return true;
			},

			setFileOperationDialog(dialog) {
				set((s) => {
					s.fileOperationDialog = dialog;
				});
			},

			toggleDir(path) {
				set((s) => {
					if (s.expandedPaths.has(path)) {
						s.expandedPaths.delete(path);
					} else {
						s.expandedPaths.add(path);
					}
				});
			},

			expandDir(path) {
				set((s) => {
					s.expandedPaths.add(path);
				});
			},

			collapseDir(path) {
				set((s) => {
					s.expandedPaths.delete(path);
				});
			},

			_syncTrees() {
				const fs = _fs();
				set((s) => {
					s.tempTree = fs.tempTree();
					s.localTree = fs.localTree();
				});
			},
		};
	}),
);

export const useTempTree = () => useFileTreeStore((s) => s.tempTree);
export const useLocalTree = () => useFileTreeStore((s) => s.localTree);

export const useActiveFile = () => useFileTreeStore((s) => s.activeFile);
export const useActiveFilePath = () =>
	useFileTreeStore((s) => s.activeFile?.path ?? null);

export const useFileOperationDialog = () =>
	useFileTreeStore((s) => s.fileOperationDialog);

export const useExpandedPaths = () => useFileTreeStore((s) => s.expandedPaths);

export const useFileTreeActions = () =>
	useFileTreeStore(
		useShallow((s) => ({
			openFile: s.openFile,
			saveFile: s.saveFile,
			createFile: s.createFile,
			deleteFile: s.deleteFile,
			renameFile: s.renameFile,
			createDir: s.createDir,
			deleteDir: s.deleteDir,
			updateFileContent: s.updateFileContent,
			exists: s.exists,
			createNewFile: s.createNewFile,
			createNewDir: s.createNewDir,
			createNewPackage: s.createNewPackage,
			setFileOperationDialog: s.setFileOperationDialog,
			toggleDir: s.toggleDir,
			expandDir: s.expandDir,
			collapseDir: s.collapseDir,
		})),
	);
