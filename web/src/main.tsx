import "@/styles.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { RouterProvider, createRouter } from "@tanstack/react-router"

import { enableMapSet } from "immer";

import { getRouterBasePath } from "@/lib/router-utils";

import { routeTree } from "@/routeTree.gen";

enableMapSet();

const router = createRouter({
	routeTree,
	basepath: getRouterBasePath(import.meta.env.BASE_URL),
	defaultPreload: "intent"
});

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<RouterProvider router={router} />
	</StrictMode>,
);
