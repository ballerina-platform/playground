import { TooltipProvider } from "@/components/ui/tooltip";

import { FSProvider } from "@/providers/fs-provider";

import { Editor } from "@/components/editor";

export default function App() {
	return (
		<TooltipProvider>
			<FSProvider>
				<Editor />
			</FSProvider>
		</TooltipProvider>
	);
}
