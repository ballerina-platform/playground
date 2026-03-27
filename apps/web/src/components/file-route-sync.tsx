import * as React from "react";

import { ShareNoticeDialog } from "@/components/share-notice-dialog";

import { useParams, useNavigate } from "@tanstack/react-router";

import {
	useFileTreeActions,
	useFileTreeStore,
	useActiveFilePath,
} from "@/stores/file-tree-store";

import { useShare } from "@/hooks/use-share";

const DEFAULT_FILE = "/tmp/examples/01-orders.bal";
const DEFAULT_SPLAT = DEFAULT_FILE.replace(/^\/+/, "");

function normalizeSplat(splat: string | undefined): string | null {
	const trimmed = splat?.trim();
	return trimmed ? trimmed.replace(/^\/+/, "") : null;
}

function filePathFromSplat(splat: string | undefined): string | null {
	const normalized = normalizeSplat(splat);
	return normalized ? `/${normalized}` : null;
}

function splatFromFilePath(filePath: string): string {
	const splat = filePath.startsWith("/") ? filePath.slice(1) : filePath;
	return splat || DEFAULT_SPLAT;
}

export function FileRouteSync({ children }: React.PropsWithChildren) {
	const { _splat: splat } = useParams({ strict: false }) as { _splat?: string };
	const navigate = useNavigate({ from: "/$" });

	const { isProcessingShare, shareNotice } = useShare();

	const ready = useFileTreeStore((s) => s.ready);
	const activeFilePath = useActiveFilePath();
	const { openFile, existsFile } = useFileTreeActions();

	const currentSplat = normalizeSplat(splat) ?? "";
	const filePathFromUrl = filePathFromSplat(splat);

	const activeFilePathRef = React.useRef(activeFilePath);
	React.useLayoutEffect(() => {
		activeFilePathRef.current = activeFilePath;
	});

	const clearedByDeletionRef = React.useRef(false);

	React.useEffect(() => {
		if (!ready || isProcessingShare) return;

		const activePath = activeFilePathRef.current;

		if (filePathFromUrl && existsFile(filePathFromUrl)) {
			if (filePathFromUrl !== activePath) openFile(filePathFromUrl);
			return;
		}

		if (clearedByDeletionRef.current) {
			clearedByDeletionRef.current = false;
			return;
		}

		if (!activePath) {
			openFile(DEFAULT_FILE);
			navigate({ to: "/$", params: { _splat: DEFAULT_SPLAT }, replace: true });
		}
	}, [
		ready,
		isProcessingShare,
		filePathFromUrl,
		existsFile,
		openFile,
		navigate,
	]);

	React.useEffect(() => {
		if (!ready || isProcessingShare) return;

		const expectedSplat = activeFilePath
			? splatFromFilePath(activeFilePath)
			: "";

		if (expectedSplat !== currentSplat) {
			if (!activeFilePath) clearedByDeletionRef.current = true;
			navigate({ to: "/$", params: { _splat: expectedSplat }, replace: true });
		}
	}, [ready, isProcessingShare, activeFilePath, currentSplat, navigate]);

	return (
		<>
			{children}
			<ShareNoticeDialog
				open={shareNotice.open}
				onDismiss={shareNotice.dismiss}
				onDismissPermanently={shareNotice.dismissPermanently}
			/>
		</>
	);
}
