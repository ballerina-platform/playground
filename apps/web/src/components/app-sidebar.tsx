import * as React from "react";

import { HugeiconsIcon } from "@hugeicons/react";
import {
	AlertSquareIcon,
	FolderIcon,
	File01Icon,
	ChevronDown,
	PlusSignIcon,
	MoreVerticalIcon,
	Delete02Icon,
	Edit02Icon,
	PackageIcon,
	Share08Icon,
	GitForkIcon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
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

import { FileTreeDialog } from "@/components/file-tree-dialog";

import {
	useActiveFilePath,
	useFileTreeActions,
	useLocalTree,
	useTempTree,
	useExpandedPaths,
} from "@/stores/file-tree-store";

import { useCopyShareLink } from "@/hooks/use-copy-share-link";
import { useIsMobile } from "@/hooks/use-mobile";

import { getExamplesSubtree, getSharedSubtree } from "@/lib/file-tree-utils";
import {
	basename,
	dirname,
	isActiveOrAncestor,
	isSharedPath,
	sharedToLocalDestination,
} from "@/lib/fs/core/path-utils";
import { cn } from "@/lib/utils";

import { LOCAL_ROOT } from "@/lib/fs/fs-roots";

import type { FileNode } from "@/lib/fs/core/file-node.types";

type FileTreeNodeProps = {
	node: FileNode;
	path: string;
	defaultOpen?: boolean;
};

function FileTreeFileNode({ node, path }: FileTreeNodeProps) {
	const { copyShareLink } = useCopyShareLink();

	const isMobile = useIsMobile();

	const shared = isSharedPath(path);

	const { toggleSidebar } = useSidebar();

	const activeFilePath = useActiveFilePath();

	const {
		openFile,
		saveFile,
		setFileOperationDialog,
		renameFile,
		exists,
		expandDir,
	} = useFileTreeActions();

	function handleClick() {
		// TODO: This is a bit hacky, we should ideally have a separate "switchFile" action that doesn't mark the file as dirty
		saveFile();
		openFile(path);
		if (isMobile) toggleSidebar();
	}

	return (
		<SidebarMenuItem>
			<div
				className={cn(
					"group/row relative w-full rounded-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-hover/row:**:data-[sidebar=menu-button]:bg-transparent",
					isSharedPath(path) && "opacity-75 text-muted-foreground",
				)}
			>
				<SidebarMenuButton
					isActive={activeFilePath === path}
					onClick={handleClick}
				>
					<HugeiconsIcon
						icon={shared ? AlertSquareIcon : File01Icon}
						strokeWidth={1.5}
					/>
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
						<DropdownMenuItem onClick={() => void copyShareLink(path)}>
							<HugeiconsIcon icon={Share08Icon} strokeWidth={1.5} />
							<span>Share</span>
						</DropdownMenuItem>
						{isSharedPath(path) && (
							<DropdownMenuItem
								onClick={() => {
									saveFile();
									const dest = sharedToLocalDestination(path);
									if (!dest) return;
									if (exists(dest)) {
										setFileOperationDialog({
											type: "fork-file",
											path,
											defaultName: basename(path),
										});
									} else if (renameFile(path, dest)) {
										expandDir(dirname(dest));
									}
								}}
							>
								<HugeiconsIcon icon={GitForkIcon} strokeWidth={1.5} />
								<span>Fork</span>
							</DropdownMenuItem>
						)}
						<DropdownMenuItem
							variant="destructive"
							onClick={() =>
								setFileOperationDialog({
									type: "delete-file",
									path,
									defaultName: node.name,
								})
							}
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
	const { copyShareLink } = useCopyShareLink();

	const isMobile = useIsMobile();

	const shared = isSharedPath(path);

	const activeFilePath = useActiveFilePath();
	const expandedPaths = useExpandedPaths();
	const {
		setFileOperationDialog,
		toggleDir,
		saveFile,
		renameFile,
		exists,
		expandDir,
	} = useFileTreeActions();

	const [hasInteracted, setHasInteracted] = React.useState(false);
	const expanded = (!hasInteracted && defaultOpen) || expandedPaths.has(path);

	const handleToggle = () => {
		if (!hasInteracted) {
			setHasInteracted(true);
			if (defaultOpen && !expandedPaths.has(path)) return;
		}
		toggleDir(path);
	};

	return (
		<Collapsible
			open={expanded}
			className="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
		>
			<SidebarMenuItem>
				<div
					className={cn(
						"group/row relative w-full rounded-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-hover/row:**:data-[sidebar=menu-button]:bg-transparent",
						isSharedPath(path) && "opacity-75 text-muted-foreground",
					)}
				>
					<SidebarMenuButton className="w-full" onClick={handleToggle}>
						<HugeiconsIcon icon={ChevronDown} strokeWidth={1.5} />
						<HugeiconsIcon
							icon={shared ? AlertSquareIcon : FolderIcon}
							strokeWidth={1.5}
						/>
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
							<DropdownMenuItem onClick={() => void copyShareLink(path)}>
								<HugeiconsIcon icon={Share08Icon} strokeWidth={1.5} />
								<span>Share</span>
							</DropdownMenuItem>
							{isSharedPath(path) && (
								<DropdownMenuItem
									onClick={() => {
										saveFile();
										const dest = sharedToLocalDestination(path);
										if (!dest) return;
										if (exists(dest)) {
											setFileOperationDialog({
												type: "fork-folder",
												path,
												defaultName: basename(path),
											});
										} else if (renameFile(path, dest)) {
											expandDir(dirname(dest));
										}
									}}
								>
									<HugeiconsIcon icon={GitForkIcon} strokeWidth={1.5} />
									<span>Fork</span>
								</DropdownMenuItem>
							)}
							<DropdownMenuItem
								variant="destructive"
								onClick={() =>
									setFileOperationDialog({
										type: "delete-folder",
										path,
										defaultName: node.name,
									})
								}
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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const isMobile = useIsMobile();

	const tempTree = useTempTree();
	const localTree = useLocalTree();

	const { entries: exampleEntries } = React.useMemo(
		() => getExamplesSubtree(tempTree),
		[tempTree],
	);

	const { entries: sharedEntries } = React.useMemo(
		() => getSharedSubtree(tempTree),
		[tempTree],
	);

	const activeFilePath = useActiveFilePath();
	const { setFileOperationDialog } = useFileTreeActions();

	const noLocalFiles = localTree.length === 0;

	return (
		<Sidebar {...props}>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel className="uppercase">Examples</SidebarGroupLabel>
					<SidebarGroupContent className="mt-2">
						<SidebarMenu>
							{exampleEntries.map(({ node, path }) => (
								<FileTreeNode
									key={node.name}
									node={node}
									path={path}
									defaultOpen={isActiveOrAncestor(path, activeFilePath)}
								/>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				<SidebarSeparator />
				<SidebarGroup>
					<div className="flex items-center justify-between">
						<SidebarGroupLabel className="uppercase">
							Localspace
						</SidebarGroupLabel>
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
							{sharedEntries.map(({ node, path }) => (
								<FileTreeNode
									key={`shared:${node.name}`}
									node={node}
									path={path}
									defaultOpen={isActiveOrAncestor(path, activeFilePath)}
								/>
							))}
							{localTree.map((node, index) => {
								const path = `${LOCAL_ROOT}/${node.name}`;
								return (
									<FileTreeNode
										key={`local:${node.name}`}
										node={node}
										path={path}
										defaultOpen={
											isActiveOrAncestor(path, activeFilePath) ||
											(noLocalFiles && index === 0)
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
