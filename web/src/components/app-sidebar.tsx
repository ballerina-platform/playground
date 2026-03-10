import * as React from "react";

import { HugeiconsIcon } from "@hugeicons/react";
import {
	FolderIcon,
	File01Icon,
	ChevronDown,
	PlusSignIcon,
	MoreVerticalIcon,
	Delete02Icon,
	Edit02Icon,
	PackageIcon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarSeparator,
	useSidebar,
} from "@/components/ui/sidebar";
import {
	useActiveFilePath,
	useFileTreeActions,
	useLocalTree,
	useTempTree,
	useFileOperationDialog,
	useExpandedPaths,
} from "@/stores/file-tree-store";

import { useIsMobile } from "@/hooks/use-mobile";

import type { FileNode } from "@/lib/fs/core/file-node.types";

type FileTreeNodeProps = {
	node: FileNode;
	path: string;
	defaultOpen?: boolean;
};

function FileTreeFileNode({ node, path }: FileTreeNodeProps) {
	const isMobile = useIsMobile();

	const { toggleSidebar } = useSidebar();

	const activeFilePath = useActiveFilePath();

	const { openFile, saveFile, deleteFile, setFileOperationDialog } =
		useFileTreeActions();

	function handleClick() {
		// TODO: This is a bit hacky, we should ideally have a separate "switchFile" action that doesn't mark the file as dirty
		saveFile();
		openFile(path);
		if (isMobile) toggleSidebar();
	}

	return (
		<SidebarMenuItem>
			<div className="group/row relative w-full rounded-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-hover/row:**:data-[sidebar=menu-button]:bg-transparent">
				<SidebarMenuButton
					isActive={activeFilePath === path}
					onClick={handleClick}
				>
					<HugeiconsIcon icon={File01Icon} strokeWidth={1.5} />
					{node.name}
				</SidebarMenuButton>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<SidebarMenuAction className="peer-data-[active=true]/menu-button:opacity-100 group-hover/row:opacity-100 group-focus-within/row:opacity-100 aria-expanded:opacity-100 md:opacity-0" />
						}
						onClick={(e) => e.stopPropagation()}
					>
						<HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={1.5} />
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-20"
						side="bottom"
						align={isMobile ? "end" : "start"}
					>
						<DropdownMenuItem
							onClick={() => {
								setFileOperationDialog({
									type: "rename-file",
									path,
									defaultName: node.name,
								});
							}}
						>
							<HugeiconsIcon icon={Edit02Icon} strokeWidth={1.5} />
							<span>Rename</span>
						</DropdownMenuItem>

						<DropdownMenuItem
							variant="destructive"
							onClick={() => deleteFile(path)}
						>
							<HugeiconsIcon icon={Delete02Icon} strokeWidth={1.5} />
							<span>Delete</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</SidebarMenuItem>
	);
}

type FileTreeDirNodeProps = {
	node: Extract<FileNode, { kind: "dir" }>;
	path: string;
	defaultOpen?: boolean;
};

function FileTreeDirNode({
	node,
	path,
	defaultOpen = false,
}: FileTreeDirNodeProps) {
	const isMobile = useIsMobile();
	const activeFilePath = useActiveFilePath();

	const expandedPaths = useExpandedPaths();
	const { deleteDir, setFileOperationDialog, toggleDir } = useFileTreeActions();

	const [hasInteracted, setHasInteracted] = React.useState(false);
	const expanded = (!hasInteracted && defaultOpen) || expandedPaths.has(path);

	const handleToggle = () => {
		if (!hasInteracted && defaultOpen) {
			setHasInteracted(true);
			return;
		}
		toggleDir(path);
	};

	return (
		<Collapsible
			open={expanded}
			className="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
		>
			<SidebarMenuItem>
				<div className="group/row relative w-full rounded-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-hover/row:**:data-[sidebar=menu-button]:bg-transparent">
					<SidebarMenuButton className="w-full" onClick={handleToggle}>
						<HugeiconsIcon icon={ChevronDown} strokeWidth={1.5} />
						<HugeiconsIcon icon={FolderIcon} strokeWidth={1.5} />
						<span className="truncate">{node.name}</span>
					</SidebarMenuButton>
					<DropdownMenu modal={false}>
						<DropdownMenuTrigger
							render={
								<SidebarMenuAction className="peer-data-[active=true]/menu-button:opacity-100 group-hover/row:opacity-100 group-focus-within/row:opacity-100 aria-expanded:opacity-100 md:opacity-0" />
							}
							onClick={(e) => e.stopPropagation()}
						>
							<HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={1.5} />
						</DropdownMenuTrigger>
						<DropdownMenuContent
							className="w-20"
							side="bottom"
							align={isMobile ? "end" : "start"}
						>
							<DropdownMenuItem
								onClick={() => {
									setFileOperationDialog({ type: "new-file", path });
								}}
							>
								<HugeiconsIcon icon={File01Icon} strokeWidth={1.5} />
								<span>New File</span>
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									setFileOperationDialog({ type: "new-folder", path });
								}}
							>
								<HugeiconsIcon icon={FolderIcon} strokeWidth={1.5} />
								<span>New Folder</span>
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									setFileOperationDialog({
										type: "rename-folder",
										path,
										defaultName: node.name,
									});
								}}
							>
								<HugeiconsIcon icon={Edit02Icon} strokeWidth={1.5} />
								<span>Rename</span>
							</DropdownMenuItem>
							<DropdownMenuItem
								variant="destructive"
								onClick={() => deleteDir(path)}
							>
								<HugeiconsIcon icon={Delete02Icon} strokeWidth={1.5} />
								<span>Delete</span>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
				{!!node.children.length && (
					<CollapsibleContent>
						<SidebarMenuSub className="translate-x-0 mx-0 px-0 pl-3.5">
							{node.children.map((child) => {
								const childPath = `${path}/${child.name}`;
								return (
									<FileTreeNode
										key={child.name}
										node={child}
										path={childPath}
										defaultOpen={
											!!activeFilePath &&
											activeFilePath.startsWith(`${childPath}/`)
										}
									/>
								);
							})}
						</SidebarMenuSub>
					</CollapsibleContent>
				)}
			</SidebarMenuItem>
		</Collapsible>
	);
}

function FileTreeNode({ node, path, defaultOpen }: FileTreeNodeProps) {
	if (node.kind === "file") return <FileTreeFileNode node={node} path={path} />;
	return <FileTreeDirNode node={node} path={path} defaultOpen={defaultOpen} />;
}

type FileTreeGroupProps = {
	label: string;
	nodes: FileNode[];
	basePath: string;
};

function FileTreeGroup({ label, nodes, basePath }: FileTreeGroupProps) {
	const activeFilePath = useActiveFilePath();
	return (
		<SidebarGroup>
			<SidebarGroupLabel>{label}</SidebarGroupLabel>
			<SidebarGroupContent className="mt-2">
				<SidebarMenu>
					{nodes.map((node, index) => {
						const path = `${basePath}/${node.name}`;
						return (
							<FileTreeNode
								key={node.name}
								node={node}
								path={path}
								defaultOpen={
									index === 0 || !!activeFilePath?.startsWith(`${path}/`)
								}
							/>
						);
					})}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}

function FileTreeDialog() {
	const fileOperationDialog = useFileOperationDialog();
	const {
		createNewFile,
		createNewDir,
		createNewPackage,
		renameFile,
		setFileOperationDialog,
	} = useFileTreeActions();

	const handleOpenChange = (open: boolean) => {
		if (!open) setFileOperationDialog(null);
	};

	const handleSubmit: React.SubmitEventHandler<HTMLFormElement> = (e) => {
		e.preventDefault();
		if (!fileOperationDialog) return;

		const formData = new FormData(e.currentTarget);
		const name = formData.get("name") as string;
		if (!name?.trim()) return;

		const { type, path } = fileOperationDialog;

		if (type === "new-file") {
			createNewFile(`${path}/${name}`);
		} else if (type === "new-folder") {
			createNewDir(`${path}/${name}`);
		} else if (type === "new-package") {
			createNewPackage(path, name);
		} else if (type === "rename-file" || type === "rename-folder") {
			const lastSlash = path.lastIndexOf("/");
			const newPath =
				lastSlash >= 0 ? path.slice(0, lastSlash + 1) + name : `/${name}`;
			renameFile(path, newPath);
		}

		setFileOperationDialog(null);
	};

	if (!fileOperationDialog) return null;

	const type = fileOperationDialog.type;
	const isRename = type.startsWith("rename");

	const metaByType = {
		"new-file": { entityLabel: "File", placeholder: "main.bal" },
		"new-folder": { entityLabel: "Folder", placeholder: "folder_name" },
		"new-package": { entityLabel: "Package", placeholder: "package_name" },
		"rename-file": { entityLabel: "File", placeholder: "main.bal" },
		"rename-folder": { entityLabel: "Folder", placeholder: "folder_name" },
	} as const;

	const meta = metaByType[type];
	const { entityLabel, placeholder } = meta;

	const title = `${isRename ? "Rename" : "Create New"} ${entityLabel}`;

	const description = isRename
		? `Enter a new name for the ${entityLabel.toLowerCase()}.`
		: `Enter a name for the ${entityLabel.toLowerCase()}.`;

	return (
		<Dialog open={!!fileOperationDialog} onOpenChange={handleOpenChange}>
			<DialogContent>
				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription>{description}</DialogDescription>
					</DialogHeader>
					<Input
						name="name"
						placeholder={placeholder}
						defaultValue={fileOperationDialog.defaultName}
						autoFocus
						autoComplete="off"
					/>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setFileOperationDialog(null)}
						>
							Cancel
						</Button>
						<Button type="submit">{isRename ? "Rename" : "Create"}</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const isMobile = useIsMobile();

	const tempTree = useTempTree();
	const localTree = useLocalTree();

	const activeFilePath = useActiveFilePath();
	const { setFileOperationDialog } = useFileTreeActions();

	return (
		<Sidebar {...props}>
			<SidebarContent>
				{/* <FileTreeGroup label="Examples" nodes={tempTree} basePath="/tmp" /> */}
				{/* <SidebarSeparator /> */}
				{/* {!!localTree.length && ( */}
				{/* <FileTreeGroup label="Localspace" nodes={localTree} basePath="/local" /> */}
				{/* )} */}

				<SidebarGroup>
					<SidebarGroupLabel>Examples</SidebarGroupLabel>
					<SidebarGroupContent className="mt-2">
						<SidebarMenu>
							{tempTree.map((node, index) => {
								const path = `/tmp/${node.name}`;
								return (
									<FileTreeNode
										key={node.name}
										node={node}
										path={path}
										defaultOpen={
											index === 0 || !!activeFilePath?.startsWith(`${path}/`)
										}
									/>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarSeparator />

				<SidebarGroup>
					<div className="flex items-center justify-between">
						<SidebarGroupLabel>Localspace</SidebarGroupLabel>
						<DropdownMenu>
							<DropdownMenuTrigger
								render={<Button variant="ghost" size="icon-xs" />}
							>
								<HugeiconsIcon icon={PlusSignIcon} strokeWidth={1.5} />
							</DropdownMenuTrigger>
							<DropdownMenuContent
								side="bottom"
								align={isMobile ? "end" : "start"}
							>
								<DropdownMenuItem
									onClick={() =>
										setFileOperationDialog({
											type: "new-package",
											path: "/local",
										})
									}
								>
									<HugeiconsIcon icon={PackageIcon} strokeWidth={1.5} />
									<span>New Package</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
					<SidebarGroupContent className="mt-2">
						<SidebarMenu>
							{localTree.map((node, index) => {
								const path = `/local/${node.name}`;
								return (
									<FileTreeNode
										key={node.name}
										node={node}
										path={path}
										defaultOpen={
											index === 0 || !!activeFilePath?.startsWith(`${path}/`)
										}
									/>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<FileTreeDialog />
		</Sidebar>
	);
}
