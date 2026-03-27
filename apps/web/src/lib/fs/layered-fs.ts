import { firstFilePathInSubtree } from "@/lib/fs/core/file-node-utils";
import {
	isRootPath,
	isSafeRelativePath,
	isUnder,
	join,
} from "@/lib/fs/core/path-utils";

import { LOCAL_ROOT, SHARED_ROOT, TEMP_ROOT } from "@/lib/fs/fs-roots";

import type { FS } from "@/lib/fs/core/fs.interface";
import type { EphemeralFS } from "@/lib/fs/ephemeral-fs";
import type { LocalStorageFS } from "@/lib/fs/local-storage-fs";
import type { FileNode } from "@/lib/fs/core/file-node.types";

export type Namespace = "temp" | "local";

export class LayeredFS implements FS {
	constructor(
		private readonly temp: EphemeralFS,
		private readonly local: LocalStorageFS,
	) {}

	open(path: string) {
		return this._withTargetOrNull(path, (fs) => fs.open(path));
	}

	stat(path: string) {
		if (isRootPath(path))
			return {
				name: "/",
				size: 0,
				modTime: 0,
				isDir: true,
			};
		return this._withTargetOrNull(path, (fs) => fs.stat(path));
	}

	readDir(path: string) {
		if (isRootPath(path))
			return [
				{ name: TEMP_ROOT.slice(1), isDir: true },
				{ name: LOCAL_ROOT.slice(1), isDir: true },
			];
		return this._withTargetOrNull(path, (fs) => fs.readDir(path));
	}

	writeFile(path: string, content: string) {
		return this._withTargetOrFalse(path, (fs) => fs.writeFile(path, content));
	}

	remove(path: string) {
		return this._withTargetOrFalse(path, (fs) => fs.remove(path));
	}

	move(oldPath: string, newPath: string) {
		const oldTarget = this._target(oldPath);
		const newTarget = this._target(newPath);
		if (!oldTarget || !newTarget) return false;
		if (oldTarget === newTarget) return oldTarget.move(oldPath, newPath);
		return this._moveToTarget(oldTarget, newTarget, oldPath, newPath);
	}

	mkdirAll(path: string) {
		return this._withTargetOrFalse(path, (fs) => fs.mkdirAll(path));
	}

	tempTree() {
		return this.temp.transformToTree(TEMP_ROOT);
	}

	localTree() {
		return this.local.transformToTree("/local");
	}

	graftSharedTree(
		root: FileNode,
		openRelativePath?: string | null,
	): string | null {
		this.temp.insertSubtree(SHARED_ROOT, root);

		const trimmed = openRelativePath?.trim();
		if (trimmed && isSafeRelativePath(trimmed)) {
			const candidate = join(SHARED_ROOT, trimmed);
			const info = this.stat(candidate);
			if (info && !info.isDir) return candidate;
		}

		return firstFilePathInSubtree(root, SHARED_ROOT);
	}

	private _moveToTarget(
		oldTarget: FS,
		newTarget: FS,
		oldPath: string,
		newPath: string,
	): boolean {
		const info = oldTarget.stat(oldPath);
		if (!info) return false;
		if (info.isDir) {
			if (!newTarget.mkdirAll(newPath)) return false;
			const entries = oldTarget.readDir(oldPath);
			if (!entries) return false;
			for (const entry of entries) {
				const src = `${oldPath}/${entry.name}`;
				const dst = `${newPath}/${entry.name}`;
				if (!this._moveToTarget(oldTarget, newTarget, src, dst)) return false;
			}
		} else {
			const file = oldTarget.open(oldPath);
			if (!file || !newTarget.writeFile(newPath, file.content)) return false;
		}
		return oldTarget.remove(oldPath);
	}

	private _namespace(path: string): Namespace | null {
		if (isUnder(path, TEMP_ROOT)) return "temp";
		if (isUnder(path, LOCAL_ROOT)) return "local";
		return null;
	}

	private _target(path: string): FS | null {
		const ns = this._namespace(path);
		if (ns === "temp") return this.temp;
		if (ns === "local") return this.local;
		return null;
	}

	private _withTargetOrNull<T>(
		path: string,
		fn: (fs: FS) => T | null,
	): T | null {
		const target = this._target(path);
		if (!target) return null;
		return fn(target);
	}

	private _withTargetOrFalse(path: string, fn: (fs: FS) => boolean): boolean {
		const target = this._target(path);
		if (!target) return false;
		return fn(target);
	}
}
