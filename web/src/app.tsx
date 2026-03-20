import { TooltipProvider } from "@/components/ui/tooltip";

import { FSProvider } from "@/providers/fs-provider";

import { FileRouteSync } from "@/components/file-route-sync";
import { Editor } from "@/components/editor";

export default function App() {
	return (
		<TooltipProvider>
			<FSProvider>
				<FileRouteSync>
					<Editor />
				</FileRouteSync>
			</FSProvider>
		</TooltipProvider>
	);
}
