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

import {
	useFileOperationDialog,
	useFileTreeActions,
} from "@/stores/file-tree-store";

type FileOperationType =
	| "new-file"
	| "new-folder"
	| "new-package"
	| "rename-file"
	| "rename-folder"
	| "delete-file"
	| "delete-folder";

interface FileTreeDialogConfig {
	placeholder?: string;
	title: string;
	description: string;
	alreadyExistsMessage?: string;
}

const FILE_TREE_DIALOG_CONFIG: Record<FileOperationType, FileTreeDialogConfig> =
	{
		"new-file": {
			title: "Create New File",
			description: "Enter a name for the file.",
			placeholder: "main.bal",
			alreadyExistsMessage: "A file with this name already exists.",
		},
		"new-folder": {
			title: "Create New Folder",
			description: "Enter a name for the folder.",
			placeholder: "folder_name",
			alreadyExistsMessage: "A folder with this name already exists.",
		},
		"new-package": {
			title: "Create New Package",
			description: "Enter a name for the package.",
			placeholder: "package_name",
			alreadyExistsMessage: "A package with this name already exists.",
		},
		"rename-file": {
			title: "Rename File",
			description: "Enter a new name for the file.",
			placeholder: "{{entity}}",
			alreadyExistsMessage: "A file with this name already exists.",
		},
		"rename-folder": {
			title: "Rename Folder",
			description: "Enter a new name for the folder.",
			placeholder: "{{entity}}",
			alreadyExistsMessage: "A folder with this name already exists.",
		},
		"delete-file": {
			title: "Delete File",
			description:
				"This will permanently delete '{{entity}}'. This action cannot be undone.",
		},
		"delete-folder": {
			title: "Delete Folder",
			description:
				"This will permanently delete '{{entity}}'. This action cannot be undone.",
		},
	};

function interpolateDialogTemplate(
	template: string,
	vars: Record<string, string>,
): string {
	return template.replace(
		/\{\{(\w+)\}\}/g,
		(_, key) => vars[key] ?? `{{${key}}}`,
	);
}

function getTargetPath(
	type: FileOperationType,
	path: string,
	name: string,
): string | null {
	if (!name.trim()) return null;
	if (/[\\/]/.test(name)) return null;

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
		deleteFile,
		deleteDir,
		renameFile,
		setFileOperationDialog,
		exists,
	} = useFileTreeActions();

	const [name, setName] = React.useState("");

	const path = fileOperationDialog?.path;
	const type = fileOperationDialog?.type as FileOperationType | undefined;
	const entityName =
		fileOperationDialog?.defaultName ??
		(path ? (path.split("/").pop() ?? null) : null);

	React.useEffect(() => {
		if (fileOperationDialog) setName(fileOperationDialog.defaultName ?? "");
	}, [fileOperationDialog]);

	const targetPath = React.useMemo(
		() => (path && type ? getTargetPath(type, path, name) : null),
		[name, type, path],
	);

	const hasPathSeparator = /[\\/]/.test(name);

	const isRename = type?.startsWith("rename") ?? false;
	const isDelete = type === "delete-file" || type === "delete-folder";
	const isSamePath = isRename && targetPath === path;
	const alreadyExists = !!targetPath && !isSamePath && exists(targetPath);
	const isActionDisabled = isDelete
		? false
		: !name.trim() || hasPathSeparator || alreadyExists || isSamePath;

	const close = () => {
		setFileOperationDialog(null);
		setTimeout(() => setName(""), 200);
	};

	const handleOpenChange = (open: boolean) => {
		if (!open) close();
	};

	const handleSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
		e.preventDefault();
		if (!fileOperationDialog || !type || !path) return;

		if (isDelete) {
			if (type === "delete-file") deleteFile(path);
			else if (type === "delete-folder") deleteDir(path);
			close();
			return;
		}

		if (isActionDisabled || !targetPath) return;

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
		entityName,
		isRename,
		isDelete,
		alreadyExists,
		isActionDisabled,
		handleOpenChange,
		handleSubmit,
	};
}

export function FileTreeDialog() {
	const {
		isOpen,
		type,
		name,
		setName,
		entityName,
		isRename,
		isDelete,
		alreadyExists,
		isActionDisabled,
		handleOpenChange,
		handleSubmit,
	} = useFileTreeDialog();

	if (!isOpen || !type) return null;

	const { title, description, placeholder, alreadyExistsMessage } =
		FILE_TREE_DIALOG_CONFIG[type];
	const templateValues = { entity: entityName ?? "" };
	const descriptionText = interpolateDialogTemplate(
		description,
		templateValues,
	);
	const inputPlaceholder = placeholder
		? interpolateDialogTemplate(placeholder, templateValues)
		: undefined;

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent>
				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription>{descriptionText}</DialogDescription>
					</DialogHeader>

					{!isDelete && (
						<div className="flex flex-col gap-2">
							<label htmlFor="file-tree-dialog-name" className="sr-only">
								Name
							</label>
							<Input
								id="file-tree-dialog-name"
								name="name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder={inputPlaceholder}
								autoFocus
								autoComplete="off"
								aria-invalid={alreadyExists}
								aria-describedby={
									alreadyExists ? "file-tree-dialog-name-error" : undefined
								}
							/>
							{alreadyExists && (
								<p
									id="file-tree-dialog-name-error"
									className="text-xs text-destructive"
								>
									{alreadyExistsMessage}
								</p>
							)}
						</div>
					)}

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => handleOpenChange(false)}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							variant={isDelete ? "destructive" : "default"}
							disabled={isActionDisabled}
							autoFocus={isDelete}
						>
							{isDelete ? "Delete" : isRename ? "Rename" : "Create"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
