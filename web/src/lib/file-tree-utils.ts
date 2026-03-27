import { pathSegments } from "./fs/core/path-utils";
import { EXAMPLES_ROOT, SHARED_ROOT } from "@/lib/fs/fs-roots";

import type { FileNode } from "@/lib/fs/core/file-node.types";

export type SubtreeEntry = {
	node: FileNode;
	path: string;
};

export function getSubtreeView(
	tree: FileNode[],
	rootPath: string,
): { entries: SubtreeEntry[]; basePath: string } {
	const segments = pathSegments(rootPath).slice(1);
	let nodes: FileNode[] = tree;

	for (const seg of segments) {
		const dir = nodes.find((n) => n.kind === "dir" && n.name === seg);
		if (!dir || dir.kind !== "dir") return { entries: [], basePath: rootPath };
		nodes = dir.children ?? [];
	}

	return {
		entries: nodes.map((node) => ({ node, path: `${rootPath}/${node.name}` })),
		basePath: rootPath,
	};
}

export const getExamplesSubtree = (tree: FileNode[]) =>
	getSubtreeView(tree, EXAMPLES_ROOT);

export const getSharedSubtree = (tree: FileNode[]) =>
	getSubtreeView(tree, SHARED_ROOT);
