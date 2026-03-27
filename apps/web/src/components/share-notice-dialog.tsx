import * as React from "react";

import { HugeiconsIcon } from "@hugeicons/react";
import {
	AlertSquareIcon,
	GitForkIcon,
	MoreVerticalIcon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

import type { IconSvgElement } from "@hugeicons/react";

function InlineIcon({ icon }: { icon: IconSvgElement }) {
	return (
		<span className="inline-flex items-center gap-0.5 align-middle -translate-y-px text-foreground">
			<HugeiconsIcon
				icon={icon}
				className="size-3.5 shrink-0"
				strokeWidth={1.5}
			/>
		</span>
	);
}

interface ShareNoticeDialogProps {
	open: boolean;
	onDismiss: () => void;
	onDismissPermanently: () => void;
}

export function ShareNoticeDialog({
	open,
	onDismiss,
	onDismissPermanently,
}: ShareNoticeDialogProps) {
	const [permanent, setPermanent] = React.useState(false);

	const handleDismiss = () =>
		permanent ? onDismissPermanently() : onDismiss();

	return (
		<Dialog
			key={String(open)}
			open={open}
			onOpenChange={(next) => !next && handleDismiss()}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Files from links are temporary</DialogTitle>
					<DialogDescription>
						Files and folders opened from a link are stored in a temporary
						workspace and removed when the session ends.
					</DialogDescription>
				</DialogHeader>

				<p className="text-xs/relaxed text-muted-foreground">
					Files marked with <InlineIcon icon={AlertSquareIcon} /> are temporary.
					To keep a copy in your Localspace, choose&nbsp;
					<InlineIcon icon={GitForkIcon} /> Fork from the row menu (
					<InlineIcon icon={MoreVerticalIcon} />) for the file.
				</p>

				<div className="flex items-center gap-2">
					<Checkbox
						id="share-notice-permanent"
						checked={permanent}
						onCheckedChange={(v) => setPermanent(v === true)}
					/>
					<label
						htmlFor="share-notice-permanent"
						className="cursor-pointer text-xs text-muted-foreground"
					>
						Don&apos;t show again
					</label>
				</div>

				<DialogFooter className="sm:justify-end">
					<Button type="button" variant="outline" onClick={handleDismiss}>
						Got it
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
