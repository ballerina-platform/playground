import * as React from "react";

import { EphemeralFS } from "@/lib/fs/ephemeral-fs";
import { LocalStorageFS } from "@/lib/fs/local-storage-fs";
import { LayeredFS } from "@/lib/fs/layered-fs";

import { useFileTreeStore, useFileTreeActions } from "@/stores/file-tree-store";

import EXAMPLES from "@/assets/examples.json";

import type { FileNode } from "@/lib/fs/core/file-node.types";

function createFS(): LayeredFS {
	return new LayeredFS(
		new EphemeralFS(EXAMPLES as FileNode[]),
		new LocalStorageFS(),
	);
}

// TODO: This should be moved to somewhere else, but for now it's fine here.
const DEFAULT_FILE = "/tmp/01-orders.bal";

export const FSContext = React.createContext<LayeredFS | null>(null);

export function FSProvider({ children }: React.PropsWithChildren) {
	const fs = React.useRef<LayeredFS>(null);

	const init = useFileTreeStore((s) => s.init);
	const ready = useFileTreeStore((s) => s.ready);
	const activeFile = useFileTreeStore((s) => s.activeFile);

	const { openFile } = useFileTreeActions();

	if (!fs.current) fs.current = createFS();

	React.useEffect(() => {
		if (fs.current) init(fs.current);
	}, [init]);

	// TODO: This also should be moved.
	React.useEffect(() => {
		if (ready && !activeFile) openFile(DEFAULT_FILE);
	}, [ready, activeFile, openFile]);

	return <FSContext.Provider value={fs.current}>{children}</FSContext.Provider>;
}

export const useFS = (): LayeredFS => {
	const fs = React.useContext(FSContext);
	if (!fs) throw new Error("useFS must be used within a FSProvider");
	return fs;
};
