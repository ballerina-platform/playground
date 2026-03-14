import { AbstractFS } from "@/lib/fs/core/abstract-fs";

import type { FileNode } from "@/lib/fs/core/file-node.types";

export class EphemeralFS extends AbstractFS {
	constructor(initial: FileNode[] = []) {
		super();
		this._seed(initial);
	}
}
