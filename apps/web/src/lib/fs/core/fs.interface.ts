export interface FS {
	open(path: string): {
		content: string;
		size: number;
		modTime: number;
		isDir: boolean;
	} | null;

	stat(path: string): {
		name: string;
		size: number;
		modTime: number;
		isDir: boolean;
	} | null;

	readDir(path: string): { name: string; isDir: boolean }[] | null;

	writeFile(path: string, content: string): boolean;

	remove(path: string): boolean;

	move(oldPath: string, newPath: string): boolean;

	mkdirAll(path: string): boolean;
}
