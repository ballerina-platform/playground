import fs from "node:fs/promises";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

import type { Plugin } from "vite";

function githubPagesSpa(): Plugin {
	let outDir: string;
	return {
		name: "github-pages-spa",
		apply: "build",
		configResolved(config) {
			outDir = path.resolve(config.root, config.build.outDir);
		},
		async closeBundle() {
			const indexHtml = path.join(outDir, "index.html");
			await fs.copyFile(indexHtml, path.join(outDir, "404.html"));
		},
	};
}

export default defineConfig({
	plugins: [
		tanstackRouter({
			target: "react",
			autoCodeSplitting: true,
		}),
		tailwindcss(),
		react(),
		githubPagesSpa(),
	],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
