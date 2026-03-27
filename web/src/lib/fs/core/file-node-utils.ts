import {
	basename,
	getRelativePath,
	isRootPath,
	join,
	pathSegments,
} from "@/lib/fs/core/path-utils";
import { LOCAL_ROOT, TEMP_ROOT } from "@/lib/fs/fs-roots";

import type { FileNode } from "@/lib/fs/core/file-node.types";
import type { FS } from "@/lib/fs/core/fs.interface";

export function toFileNode(fs: FS, path: string): FileNode | null {
	if (isRootPath(path) || path === TEMP_ROOT || path === LOCAL_ROOT)
		return null;

	for (const seg of pathSegments(path)) {
		if (seg === ".." || seg === ".") return null;
	}

	const info = fs.stat(path);
	if (!info) return null;

	const name = basename(path);
	if (!name) return null;

	if (!info.isDir) {
		const file = fs.open(path);
		if (!file) return null;
		return { kind: "file", name, content: file.content };
	}

	const children = (fs.readDir(path) ?? [])
		.map((entry) => toFileNode(fs, `${path}/${entry.name}`))
		.filter((n): n is FileNode => n !== null);

	return { kind: "dir", name, children };
}
export function getRelativePathInTree(
	treeRoot: FileNode,
	mountPath: string,
	activePath?: string | null,
): string | null {
	if (treeRoot.kind !== "dir" || !activePath) return null;
	const underMount = getRelativePath(mountPath, activePath);
	if (underMount === null) return null;
	return join(treeRoot.name, underMount);
}

export function firstFilePathInSubtree(
	node: FileNode,
	parentPath: string,
): string | null {
	if (node.kind === "file") return join(parentPath, node.name);
	const dirPath = join(parentPath, node.name);
	for (const child of node.children) {
		const p = firstFilePathInSubtree(child, dirPath);
		if (p) return p;
	}
	return null;
}
