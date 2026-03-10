import React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

import { useFileOperationDialog } from "@/stores/file-tree-store";
import { useFileTreeActions } from "@/stores/file-tree-store";

type FileOperationType =
	| "new-file"
	| "new-folder"
	| "new-package"
	| "rename-file"
	| "rename-folder";

interface DialogMeta {
	entityLabel: string;
	placeholder: string;
}

const DIALOG_META: Record<FileOperationType, DialogMeta> = {
	"new-file": { entityLabel: "File", placeholder: "main.bal" },
	"new-folder": { entityLabel: "Folder", placeholder: "folder_name" },
	"new-package": { entityLabel: "Package", placeholder: "package_name" },
	"rename-file": { entityLabel: "File", placeholder: "main.bal" },
	"rename-folder": { entityLabel: "Folder", placeholder: "folder_name" },
};

export function FileTreeDialog() {
	const {
		isOpen,
		type,
		name,
		setName,
		isRename,
		alreadyExists,
		isActionDisabled,
		handleOpenChange,
		handleSubmit,
	} = useFileTreeDialog();

	if (!isOpen || !type) return null;

	const { entityLabel, placeholder } = DIALOG_META[type];
	const entityLabelLower = entityLabel.toLowerCase();
	const title = `${isRename ? "Rename" : "Create New"} ${entityLabel}`;
	const description = isRename
		? `Enter a new name for the ${entityLabelLower}.`
		: `Enter a name for the ${entityLabelLower}.`;

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent>
				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription>{description}</DialogDescription>
					</DialogHeader>

					<div className="flex flex-col gap-2">
						<Input
							name="name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder={placeholder}
							autoFocus
							autoComplete="off"
							aria-invalid={alreadyExists}
						/>
						{alreadyExists && (
							<p className="text-xs text-destructive">
								A {entityLabelLower} with this name already exists.
							</p>
						)}
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => handleOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isActionDisabled}>
							{isRename ? "Rename" : "Create"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function getTargetPath(
	type: FileOperationType,
	path: string,
	name: string,
): string | null {
	if (!name.trim()) return null;

	if (type === "new-package" || type === "new-folder" || type === "new-file") {
		return `${path}/${name}`;
	}

	if (type === "rename-file" || type === "rename-folder") {
		const lastSlash = path.lastIndexOf("/");
		return lastSlash >= 0
			? `${path.slice(0, lastSlash + 1)}${name}`
			: `/${name}`;
	}

	return null;
}

function useFileTreeDialog() {
	const fileOperationDialog = useFileOperationDialog();
	const {
		createNewFile,
		createNewDir,
		createNewPackage,
		renameFile,
		setFileOperationDialog,
		exists,
	} = useFileTreeActions();

	const [name, setName] = React.useState("");

	React.useEffect(() => {
		if (fileOperationDialog) setName(fileOperationDialog.defaultName ?? "");
	}, [fileOperationDialog]);

	const path = fileOperationDialog?.path;
	const type = fileOperationDialog?.type as FileOperationType | undefined;

	const targetPath = React.useMemo(
		() => (path && type ? getTargetPath(type, path, name) : null),
		[name, type, path],
	);

	const isRename = type?.startsWith("rename") ?? false;
	const isSamePath = isRename && targetPath === path;
	const alreadyExists = !!targetPath && !isSamePath && exists(targetPath);
	const isActionDisabled = !name.trim() || alreadyExists || isSamePath;

	const close = () => {
		setFileOperationDialog(null);
		setTimeout(() => setName(""), 200);
	};

	const handleSubmit: React.SubmitEventHandler<HTMLFormElement> = (e) => {
		e.preventDefault();
		if (
			!fileOperationDialog ||
			isActionDisabled ||
			!targetPath ||
			!type ||
			!path
		)
			return;

		switch (type) {
			case "new-file":
				createNewFile(targetPath);
				break;
			case "new-folder":
				createNewDir(targetPath);
				break;
			case "new-package":
				createNewPackage(path, name);
				break;
			case "rename-file":
			case "rename-folder":
				renameFile(path, targetPath);
				break;
		}

		close();
	};

	return {
		isOpen: !!fileOperationDialog,
		type,
		name,
		setName,
		isRename,
		alreadyExists,
		isActionDisabled,
		handleOpenChange: (open: boolean) => {
			if (!open) close();
		},
		handleSubmit,
	};
}

