export type FileNode =
	| { kind: "file"; name: string; content: string }
	| { kind: "dir"; name: string; children: FileNode[] };
