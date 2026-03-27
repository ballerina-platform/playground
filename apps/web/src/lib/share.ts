import {
	getRelativePathInTree,
	toFileNode,
} from "@/lib/fs/core/file-node-utils";
import { isSafeRelativePath } from "@/lib/fs/core/path-utils";

import type { LayeredFS } from "@/lib/fs/layered-fs";
import type { FileNode } from "@/lib/fs/core/file-node.types";

export type SharePayload = {
	root: FileNode;
	openRelativePath?: string;
};

async function compressAndEncode(text: string): Promise<string> {
	const bytes = new TextEncoder().encode(text);
	const stream = new CompressionStream("gzip");
	const writer = stream.writable.getWriter();
	void writer.write(bytes);
	void writer.close();
	const compressed = new Uint8Array(
		await new Response(stream.readable).arrayBuffer(),
	);

	const chunkSize = 8192;
	let binary = "";
	for (let i = 0; i < compressed.length; i += chunkSize) {
		binary += String.fromCharCode(...compressed.subarray(i, i + chunkSize));
	}
	return btoa(binary);
}

async function decodeAndDecompress(b64: string): Promise<string> {
	const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
	const stream = new DecompressionStream("gzip");
	const writer = stream.writable.getWriter();
	void writer.write(bytes);
	void writer.close();
	const decompressed = await new Response(stream.readable).arrayBuffer();
	return new TextDecoder().decode(decompressed);
}

function isSafeNodeName(name: unknown): name is string {
	return (
		typeof name === "string" &&
		name.length > 0 &&
		name !== "." &&
		name !== ".." &&
		!name.includes("/")
	);
}

function isFileNode(value: unknown): value is FileNode {
	if (!value || typeof value !== "object") return false;
	const o = value as Record<string, unknown>;
	if (o.kind === "file")
		return isSafeNodeName(o.name) && typeof o.content === "string";
	if (o.kind === "dir") {
		return (
			isSafeNodeName(o.name) &&
			Array.isArray(o.children) &&
			o.children.every(isFileNode)
		);
	}
	return false;
}

export async function encodeSharePayload(
	root: FileNode,
	openRelativePath?: string | null,
): Promise<string> {
	return compressAndEncode(
		JSON.stringify({ root, ...(openRelativePath && { openRelativePath }) }),
	);
}

export async function decodeSharePayload(
	encoded: string,
): Promise<SharePayload | null> {
	try {
		const json = await decodeAndDecompress(encoded);
		const parsed: unknown = JSON.parse(json);
		if (isFileNode(parsed)) return { root: parsed };
		if (
			parsed &&
			typeof parsed === "object" &&
			"root" in parsed &&
			isFileNode((parsed as { root: unknown }).root)
		) {
			const p = parsed as { root: FileNode; openRelativePath?: unknown };
			const raw = p.openRelativePath;
			if (raw === undefined || raw === null) return { root: p.root };
			if (typeof raw !== "string") return { root: p.root };
			const rel = raw.trim();
			if (!rel || !isSafeRelativePath(rel)) return { root: p.root };
			return { root: p.root, openRelativePath: rel };
		}
		return null;
	} catch {
		return null;
	}
}

export function appendShareParam(encodedPayload: string): string {
	const url = new URL(import.meta.env.BASE_URL, window.location.origin);
	url.searchParams.set("share", encodedPayload);
	return url.toString();
}

export function omitSearchParam(
	prev: Record<string, unknown>,
	key: string,
): Record<string, unknown> {
	const { [key]: _, ...rest } = prev;
	return rest;
}

export async function generateShareUrl(
	fs: LayeredFS,
	nodePath: string,
	activeFilePath: string | null,
): Promise<string | null> {
	const root = toFileNode(fs, nodePath);
	if (!root) return null;

	const openRelativePath =
		root.kind === "dir"
			? getRelativePathInTree(root, nodePath, activeFilePath)
			: null;

	return appendShareParam(await encodeSharePayload(root, openRelativePath));
}
