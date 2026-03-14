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
