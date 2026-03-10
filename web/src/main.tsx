import "@/styles.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "@/app";

import { enableMapSet } from "immer";

enableMapSet();

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
