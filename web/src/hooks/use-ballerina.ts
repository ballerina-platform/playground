import "@/wasm_exec";

import * as React from "react";

export function useBallerina() {
    const [isReady, setIsReady] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;

        async function load() {
            const go = new window.Go();
            const result = await WebAssembly.instantiateStreaming(
                fetch("ballerina.wasm"),
                go.importObject,
            );
            go.run(result.instance);
            if (!cancelled) setIsReady(true);
        }

        load().catch(() => {
            if (!cancelled) setIsReady(false);
        });

        return () => {
            cancelled = true;
        };
    }, []);

    function updateFile(
        path: string,
        content: string,
    ): { error?: string } | null {
        if (typeof window.updateFile !== "function") {
            return { error: "Ballerina runtime is not ready" };
        }
        const result = window.updateFile(path, content);
        if (result && typeof result === "object" && "error" in result) {
            return result as { error?: string };
        }
        return null;
    }

    function run(path: string): { error?: string } | null {
        if (typeof window.run !== "function") {
            return { error: "Ballerina runtime is not ready" };
        }
        const result = window.run(path);
        if (result && typeof result === "object" && "error" in result) {
            return result as { error?: string };
        }
        return null;
    }

    return { isReady, updateFile, run };
}
