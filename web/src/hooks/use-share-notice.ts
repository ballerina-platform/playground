import * as React from "react";

const STORAGE_KEY = "playground.share-notice-dismissed";

function readDismissed() {
	try {
		return (
			typeof window !== "undefined" &&
			window.localStorage.getItem(STORAGE_KEY) === "1"
		);
	} catch {
		return false;
	}
}

function persistDismissed() {
	try {
		window.localStorage.setItem(STORAGE_KEY, "1");
	} catch {}
}

export function useShareNotice() {
	const [open, setOpen] = React.useState(false);

	const show = React.useCallback(() => {
		if (!readDismissed()) setOpen(true);
	}, []);

	const dismiss = React.useCallback(() => setOpen(false), []);

	const dismissPermanently = React.useCallback(() => {
		persistDismissed();
		setOpen(false);
	}, []);

	return { open, show, dismiss, dismissPermanently };
}
