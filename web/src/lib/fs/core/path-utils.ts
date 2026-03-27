import { LOCAL_ROOT, SHARED_ROOT } from "@/lib/fs/fs-roots";

export function pathSegments(path: string): string[] {
	return path.split("/").filter(Boolean);
}

export function basename(path: string): string {
	const parts = pathSegments(path);
	return parts[parts.length - 1] ?? "/";
}

export function dirname(path: string): string {
	const parts = pathSegments(path);
	const dir = parts.slice(0, -1).join("/");
	return path.startsWith("/") ? (dir ? `/${dir}` : "/") : dir;
}

export function ext(path: string): string {
	const base = path.split(/[\\/]/).pop() ?? "";
	const dot = base.lastIndexOf(".");
	return dot === -1 ? "" : base.slice(dot + 1);
}

export function join(...segments: string[]): string {
	const leading = segments[0].startsWith("/") ? "/" : "";
	return (
		leading +
		segments
			.flatMap((s) => s.split("/"))
			.filter(Boolean)
			.join("/")
	);
}

export function isRootPath(path: string): boolean {
	return !path || path === "." || path === "/";
}

export function isUnder(path: string, root: string): boolean {
	return path === root || path.startsWith(`${root}/`);
}

export function isSafeRelativePath(path: string): boolean {
	const trimmed = path.trim();
	if (!trimmed) return false;
	return pathSegments(trimmed).every((s) => s !== "." && s !== "..");
}

export function getRelativePath(
	mountPath: string,
	activePath?: string | null,
): string | null {
	if (!activePath) return null;
	const base = mountPath.replace(/\/$/, "");
	if (activePath === base) return null;
	if (!isUnder(activePath, base)) return null;
	const rel = activePath.slice(base.length + 1);
	if (!isSafeRelativePath(rel)) return null;
	return rel;
}

export function isSharedPath(path: string): boolean {
	return isUnder(path, SHARED_ROOT);
}

export function sharedToLocalDestination(sharedPath: string): string | null {
	const rel = getRelativePath(SHARED_ROOT, sharedPath);
	if (rel === null) return null;
	return join(LOCAL_ROOT, rel);
}

export function getForkTargetPath(
	sourceSharedPath: string,
	newBasename: string,
): string | null {
	const trimmed = newBasename.trim();
	if (!trimmed) return null;
	if (/[\\/]/.test(trimmed)) return null;
	if (trimmed === "." || trimmed === "..") return null;
	const rel = getRelativePath(SHARED_ROOT, sourceSharedPath);
	if (rel === null) return null;
	const parts = pathSegments(rel);
	if (parts.length === 0) return null;
	parts[parts.length - 1] = trimmed;
	return join(LOCAL_ROOT, parts.join("/"));
}

export function ancestorDirPathsForFile(filePath: string): string[] {
	const out: string[] = [];
	let p = dirname(filePath);
	while (p && p !== "/" && p !== "") {
		out.push(p);
		const next = dirname(p);
		if (next === p) break;
		p = next;
	}
	return out;
}

export function isActiveOrAncestor(
	path: string,
	activeFilePath: string | null | undefined,
): boolean {
	if (!activeFilePath) return false;
	return activeFilePath === path || isUnder(activeFilePath, path);
}
