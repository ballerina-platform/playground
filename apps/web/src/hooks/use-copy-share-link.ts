import * as React from "react";

import { toast } from "sonner";

import { generateShareUrl } from "@/lib/share";

import { useFS } from "@/providers/fs-provider";
import { useActiveFilePath } from "@/stores/file-tree-store";

export function useCopyShareLink() {
	const fs = useFS();
	const activeFilePath = useActiveFilePath();

	const copyShareLink = React.useCallback(
		async (nodePath: string) => {
			try {
				const url = await generateShareUrl(fs, nodePath, activeFilePath);
				if (!url) {
					toast.error("Could not generate share link");
					return;
				}

				await navigator.clipboard.writeText(url);
				toast.success("Share link copied to clipboard");
			} catch {
				toast.error("Could not copy link to clipboard");
			}
		},
		[fs, activeFilePath],
	);

	return { copyShareLink };
}
