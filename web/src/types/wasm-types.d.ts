import type { FS } from "@/lib/fs/core/fs.interface";

declare global {
	export interface Window {
		Go: any; // eslint-disable-line @typescript-eslint/no-explicit-any
		run(proxy: FS, path: string): { error?: string } | null;
	}
}
