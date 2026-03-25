export function getRouterBasePath(baseUrl: string): string {
	return baseUrl === "/" ? "/" : baseUrl.replace(/\/$/, "");
}
