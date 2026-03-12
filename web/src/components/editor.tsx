import * as React from "react";

import { HugeiconsIcon } from "@hugeicons/react";
import {
    ChevronDown,
    ChevronUp,
    CleanIcon,
    GithubFreeIcons,
    PlayIcon,
} from "@hugeicons/core-free-icons";
import { useHotkeys } from "react-hotkeys-hook";

import { Button } from "@/components/ui/button";
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar";

import { AppSidebar } from "@/components/app-sidebar";
import { CodeEditor } from "@/components/code-editor";
import { ANSI } from "@/components/ansi";

import { useEditorStore } from "@/stores/editor-store";
import { useFileStore, useSelectedFile } from "@/stores/file-store";

import { useBallerina } from "@/hooks/use-ballerina";

import { cn } from "@/lib/utils";

import type { FilePath } from "@/types/files";

function WasmLoadingScreen({ progress }: { progress: number }) {
    const pct = Math.max(0, Math.min(100, progress));
    return (
        <div className="w-full flex items-center justify-center min-h-dvh">
            <div className="flex flex-col items-center gap-3">
                <div className="text-sm text-muted-foreground">
                    Loading WASM binaries... {pct}%
                </div>
                <div className="w-48 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                        className="h-full bg-emerald-500 transition-[width] duration-150"
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>
        </div>
    );
}

function getLanguage(path: FilePath): string {
    const ext = path.split(".").pop();
    switch (ext) {
        case "toml":
            return "toml";
        default:
            return "ballerina";
    }
}

function OutputPane() {
    const output = useEditorStore((s) => s.output);
    const outputOpen = useEditorStore((s) => s.outputOpen);
    const toggleOutputOpen = useEditorStore((s) => s.toggleOutputOpen);
    const clearOutput = useEditorStore((s) => s.clearOutput);

    return (
        <div
            className={cn(
                "flex flex-col min-h-0 min-w-0",
                "lg:w-1/2 lg:flex-none",
                outputOpen ? "flex-1 lg:flex" : "shrink-0 lg:flex",
            )}
        >
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-t lg:border-t-0">
                <div className="flex items-center h-full">
                    <span className="px-4 h-full text-xs text-muted-foreground flex items-center">
                        Output
                    </span>
                </div>
                <div className="flex items-center h-full">
                    <Button
                        className="h-full border-l lg:hidden"
                        variant="ghost"
                        onClick={toggleOutputOpen}
                    >
                        <HugeiconsIcon
                            icon={outputOpen ? ChevronDown : ChevronUp}
                            strokeWidth={1.5}
                        />
                        <span className="text-xs">
                            {outputOpen ? "Minimize" : "Show Output"}
                        </span>
                    </Button>
                    <Button
                        className="h-full border-l"
                        variant="ghost"
                        onClick={clearOutput}
                    >
                        <HugeiconsIcon icon={CleanIcon} strokeWidth={1.5} />
                        <span className="hidden sm:inline">Clear</span>
                    </Button>
                </div>
            </div>
            <div
                className={cn(
                    "min-h-0 overflow-y-auto p-4",
                    outputOpen ? "flex-1" : "hidden lg:block lg:flex-1",
                )}
            >
                <pre className="text-[13px] font-sans whitespace-pre-wrap wrap-break-word">
                    <ANSI value={output} />
                </pre>
            </div>
        </div>
    );
}

function EditorPane({ onRun }: { onRun: () => void }) {
    const selectedFilePath = useFileStore((s) => s.selectedFilePath);
    const selectedFile = useSelectedFile();
    const updateFileContent = useFileStore((s) => s.updateFile);
    const outputOpen = useEditorStore((s) => s.outputOpen);

    const handleChange = React.useCallback(
        (next: string) => {
            if (!selectedFilePath) return;
            updateFileContent(selectedFilePath, next);
        },
        [selectedFilePath, updateFileContent],
    );
    return (
        <div
            className={cn(
                "flex flex-col lg:border-b-0 lg:border-r min-h-0",
                "lg:w-1/2 lg:flex-none lg:h-full",
                outputOpen ? "h-1/2" : "flex-1",
            )}
        >
            <div className="flex h-10 shrink-0 items-center justify-between border-b">
                <span className="px-4 h-full text-xs border-r flex items-center truncate max-w-[60%]">
                    {selectedFile?.name || "No file selected"}
                </span>
                <Button
                    className="h-full rounded-none"
                    variant="ghost"
                    onClick={onRun}
                    disabled={
                        !selectedFile ||
                        getLanguage(selectedFile.name) !== "ballerina"
                    }
                >
                    <HugeiconsIcon icon={PlayIcon} strokeWidth={1.5} />
                    <span>Run</span>
                </Button>
            </div>
            <CodeEditor
                className="flex-1 min-h-0 w-full"
                value={selectedFile?.content ?? ""}
                onChange={handleChange}
                language={
                    selectedFile ? getLanguage(selectedFile.name) : undefined
                }
            />
        </div>
    );
}

function EditorHeader() {
    return (
        <header className="flex h-16 shrink-0 items-center justify-between border-b px-4">
            <div className="flex items-center gap-4">
                <SidebarTrigger className="-ml-1" />
                <h1 className="text-sm font-medium">Ballerina Playground</h1>
            </div>
            <div>
                <a
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-secondary-foreground"
                    href="https://github.com/ballerina-platform/playground"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <HugeiconsIcon
                        icon={GithubFreeIcons}
                        strokeWidth={1.5}
                        size={16}
                    />
                    <span>GitHub</span>
                </a>
            </div>
        </header>
    );
}

function EditorContent() {
    const { isReady, progress, run, updateFile } = useBallerina();

    const openOutputWith = useEditorStore((s) => s.openOutputWith);

    const selectedFilePath = useFileStore((s) => s.selectedFilePath);
    const selectedFile = useSelectedFile();

    const handleRun = React.useCallback(() => {
        if (
            !selectedFilePath ||
            !selectedFile ||
            getLanguage(selectedFile.name) !== "ballerina"
        )
            return;

        const oldConsole = console.log;
        let captured = "";

        console.log = (...args) => {
            captured += args.join(" ") + "\n";
            oldConsole.apply(console, args);
        };

        try {
            const updateFileResult = updateFile(
                selectedFilePath,
                selectedFile.content,
            );
            if (updateFileResult?.error) {
                captured += updateFileResult.error + "\n";
            }
            const runResult = run(selectedFilePath);
            if (runResult?.error) {
                captured += runResult.error + "\n";
            }
        } finally {
            console.log = oldConsole;
        }

        openOutputWith(captured);
    }, [selectedFile, selectedFilePath, updateFile, run, openOutputWith]);

    useHotkeys(
        "mod+enter",
        (e) => {
            e.preventDefault();
            handleRun();
        },
        {
            enableOnFormTags: ["TEXTAREA"],
            preventDefault: true,
        },
    );

    if (!isReady) {
        return <WasmLoadingScreen progress={progress ?? 0} />;
    }

    return (
        <>
            <AppSidebar />
            <SidebarInset className="flex flex-col h-dvh overflow-hidden">
                <EditorHeader />
                <main className="flex flex-col lg:flex-row flex-1 min-h-0">
                    <EditorPane onRun={handleRun} />
                    <OutputPane />
                </main>
            </SidebarInset>
        </>
    );
}

export function Editor() {
    return (
        <SidebarProvider>
            <EditorContent />
        </SidebarProvider>
    );
}
