import { ThemeProvider } from "next-themes";
import { Outlet, createRootRoute } from "@tanstack/react-router";

import { Toaster } from "@/components/ui/sonner";

export const Route = createRootRoute({
	component: RootComponent,
});

function RootComponent() {
	return (
		<ThemeProvider>
			<Outlet />
			<Toaster />
		</ThemeProvider>
	);
}
