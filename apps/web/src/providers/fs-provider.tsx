import * as React from "react";

import { EphemeralFS } from "@/lib/fs/ephemeral-fs";
import { LocalStorageFS } from "@/lib/fs/local-storage-fs";
import { LayeredFS } from "@/lib/fs/layered-fs";

import { useFileTreeStore } from "@/stores/file-tree-store";

import EXAMPLES from "@/assets/examples.json";

import type { FileNode } from "@/lib/fs/core/file-node.types";

function createFS(): LayeredFS {
	return new LayeredFS(
		new EphemeralFS(EXAMPLES as FileNode[]),
		new LocalStorageFS(),
	);
}

export const FSContext = React.createContext<LayeredFS | null>(null);

export function FSProvider({ children }: React.PropsWithChildren) {
	const fs = React.useRef<LayeredFS>(null);

	const init = useFileTreeStore((s) => s.init);

	if (!fs.current) fs.current = createFS();

	React.useEffect(() => {
		if (fs.current) init(fs.current);
	}, [init]);

	return <FSContext.Provider value={fs.current}>{children}</FSContext.Provider>;
}

export const useFS = (): LayeredFS => {
	const fs = React.useContext(FSContext);
	if (!fs) throw new Error("useFS must be used within a FSProvider");
	return fs;
};
