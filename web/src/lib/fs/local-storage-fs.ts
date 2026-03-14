import { AbstractFS, type FSNode } from "@/lib/fs/core/abstract-fs";

export class LocalStorageFS extends AbstractFS {
	constructor(private readonly key: string = "bfs") {
		super();
		this._load();
	}

	clear() {
		this.data = { isDir: true, children: {} };
		this._persist();
	}

	private _isValidRootDir(value: unknown): value is FSNode {
		if (!value || typeof value !== "object" || Array.isArray(value))
			return false;
		const node = value as Record<string, unknown>;
		return (
			node.isDir === true &&
			!!node.children &&
			typeof node.children === "object" &&
			!Array.isArray(node.children)
		);
	}

	private _parse(raw: string): FSNode | null {
		try {
			const parsed = JSON.parse(raw);
			return this._isValidRootDir(parsed) ? parsed : null;
		} catch {
			return null;
		}
	}

	private _load(): void {
		const fallback: FSNode = { isDir: true, children: {} };
		const raw = localStorage.getItem(this.key);
		const parsed = raw ? this._parse(raw) : null;

		if (parsed) this.data = parsed;
		else {
			this.data = fallback;
			if (raw !== null)
				localStorage.setItem(this.key, JSON.stringify(fallback));
		}
	}

	private _persist(): void {
		try {
			localStorage.setItem(this.key, JSON.stringify(this.data));
		} catch (e) {
			console.warn("[LocalStorageFS]: Failed to persist to localStorage", e);
		}
	}

	protected override _onWrite(): void {
		this._persist();
	}
}
