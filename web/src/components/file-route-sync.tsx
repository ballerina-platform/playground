import * as React from "react";

import { useParams, useNavigate } from "@tanstack/react-router";

import { useFileTreeStore, useFileTreeActions } from "@/stores/file-tree-store";

const DEFAULT_FILE = "/tmp/01-orders.bal";
const DEFAULT_SPLAT = DEFAULT_FILE.replace(/^\/+/, "");

function normalizeSplat(splat: string | undefined) {
	if (!splat) return null;
	const trimmed = splat.trim();
	if (!trimmed) return null;
	return trimmed.replace(/^\/+/, "");
}

function filePathFromSplat(splat: string | undefined) {
	const normalized = normalizeSplat(splat);
	if (!normalized) return null;
	return `/${normalized}`;
}

function splatFromFilePath(filePath: string) {
	const trimmed = filePath.trim();
	if (!trimmed) return DEFAULT_SPLAT;
	const splat = trimmed.startsWith("/") ? filePath.slice(1) : filePath;
	return splat || DEFAULT_SPLAT;
}

export function FileRouteSync({ children }: React.PropsWithChildren) {
	const params = useParams({ strict: false }) as { _splat?: string };
	const navigate = useNavigate();

	const ready = useFileTreeStore((s) => s.ready);
	const activeFilePath = useFileTreeStore((s) => s.activeFile?.path ?? null);
	const { openFile, existsFile } = useFileTreeActions();

	const splat = params._splat;

	const currentSplat = React.useMemo(
		() => normalizeSplat(splat) ?? "",
		[splat],
	);
	const filePathFromUrl = React.useMemo(
		() => filePathFromSplat(splat),
		[splat],
	);
	const targetSplat = React.useMemo(
		() => (activeFilePath ? splatFromFilePath(activeFilePath) : null),
		[activeFilePath],
	);

	const openDefaultFileAndSyncRoute = React.useCallback(() => {
		if (existsFile(DEFAULT_FILE)) {
			openFile(DEFAULT_FILE);
			navigate({
				to: "/$",
				params: { _splat: DEFAULT_SPLAT },
				replace: true,
			});
		}
	}, [openFile, existsFile, navigate]);

	React.useEffect(() => {
		if (!ready) return;

		if (!filePathFromUrl) {
			openDefaultFileAndSyncRoute();
			return;
		}

		if (existsFile(filePathFromUrl)) openFile(filePathFromUrl);
		else openDefaultFileAndSyncRoute();
	}, [
		ready,
		filePathFromUrl,
		existsFile,
		openFile,
		openDefaultFileAndSyncRoute,
	]);

	React.useEffect(() => {
		if (!ready || !activeFilePath) return;
		if (targetSplat !== currentSplat) {
			navigate({
				to: "/$",
				params: { _splat: targetSplat },
				replace: true,
			});
		}
	}, [ready, activeFilePath, targetSplat, currentSplat, navigate]);

	return children;
}
