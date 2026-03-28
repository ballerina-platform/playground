import "@/wasm_exec";

import * as React from "react";

import { useFS } from "@/providers/fs-provider";

export function useBallerina() {
	const fs = useFS();

	const [isReady, setIsReady] = React.useState(false);
	const [progress, setProgress] = React.useState(0);

	React.useEffect(() => {
		let cancelled = false;

		async function load() {
			const go = new window.Go();

			const wasmUrl = new URL(
				"ballerina.wasm",
				new URL(import.meta.env.BASE_URL, window.location.origin),
			).toString();

			const result = await WebAssembly.instantiateStreaming(
				fetchResponseWithProgress(wasmUrl, (pct) => {
					if (!cancelled) setProgress(pct);
				}),
				go.importObject,
			);

			go.run(result.instance);

			if (!cancelled) {
				setProgress(100);
				setIsReady(true);
			}
		}

		load().catch(() => {
			if (!cancelled) setIsReady(false);
		});

		return () => {
			cancelled = true;
		};
	}, []);

	function run(path: string): { error?: string } | null {
		if (typeof window.run !== "function")
			return { error: "Ballerina runtime is not ready" };
		if (!fs) return { error: "Virtual file system is not available" };

		const result = window.run(fs, path);
		if (result && typeof result === "object" && "error" in result) {
			return result as { error?: string };
		}
		return null;
	}

	return { isReady, progress, run };
}

async function fetchResponseWithProgress(
	url: string,
	onProgress: (pct: number) => void,
): Promise<Response> {
	const res = await fetch(url);
	const total = Number(res.headers.get("content-length") ?? 0);

	if (!res.body || !total) return res;

	const reader = res.body.getReader();
	const stream = new ReadableStream({
		async start(controller) {
			let loaded = 0;
			for (;;) {
				const { done, value } = await reader.read();
				if (done) {
					controller.close();
					break;
				}
				if (value) {
					loaded += value.byteLength;
					onProgress(Math.round((loaded / total) * 100));
					controller.enqueue(value);
				}
			}
		},
	});

	return new Response(stream, { headers: res.headers });
}
