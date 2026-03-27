import type * as React from "react";

type AnsiStyleState = {
	color?: string;
	weight?: "normal" | "bold";
};

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape sequences require control characters
const ANSI_PATTERN = /\x1b\[(\d+(?:;\d+)*)m/g;

function ansiCodesToStyle(
	prev: AnsiStyleState,
	codes: number[],
): AnsiStyleState {
	let next: AnsiStyleState = { ...prev };

	for (const code of codes) {
		if (code === 0) {
			next = {};
			continue;
		}

		if (code === 1) {
			next.weight = "bold";
			continue;
		}

		if (code === 22) {
			next.weight = "normal";
			continue;
		}

		if (code === 39) {
			next.color = undefined;
			continue;
		}

		switch (code) {
			case 30:
				next.color = "--ansi-fg-black";
				break;
			case 31:
				next.color = "--ansi-fg-red";
				break;
			case 32:
				next.color = "--ansi-fg-green";
				break;
			case 33:
				next.color = "--ansi-fg-yellow";
				break;
			case 34:
				next.color = "--ansi-fg-blue";
				break;
			case 35:
				next.color = "--ansi-fg-magenta";
				break;
			case 36:
				next.color = "--ansi-fg-cyan";
				break;
			case 37:
				next.color = "--ansi-fg-white";
				break;
			case 90:
				next.color = "--ansi-fg-bright-black";
				break;
			case 91:
				next.color = "--ansi-fg-bright-red";
				break;
			case 92:
				next.color = "--ansi-fg-bright-green";
				break;
			case 93:
				next.color = "--ansi-fg-bright-yellow";
				break;
			case 94:
				next.color = "--ansi-fg-bright-blue";
				break;
			case 95:
				next.color = "--ansi-fg-bright-magenta";
				break;
			case 96:
				next.color = "--ansi-fg-bright-cyan";
				break;
			case 97:
				next.color = "--ansi-fg-bright-white";
				break;
		}
	}

	return next;
}

export function renderAnsi(value: string): React.ReactNode {
	if (!value) return null;

	const nodes: React.ReactNode[] = [];

	let lastIndex = 0;
	let match: RegExpExecArray | null;
	let state: AnsiStyleState = {};
	let key = 0;

	// biome-ignore lint/suspicious/noAssignInExpressions: assignment in while condition is idiomatic for regex exec loops
	while ((match = ANSI_PATTERN.exec(value)) !== null) {
		if (match.index > lastIndex) {
			const text = value.slice(lastIndex, match.index);
			if (text) {
				nodes.push(
					<span
						key={key++}
						style={{
							color: state.color ? `var(${state.color})` : undefined,
							fontWeight: state.weight,
						}}
					>
						{text}
					</span>,
				);
			}
		}

		const codes = match[1]
			.split(";")
			.map((c) => Number.parseInt(c, 10))
			.filter((n) => !Number.isNaN(n));

		state = ansiCodesToStyle(state, codes);
		lastIndex = ANSI_PATTERN.lastIndex;
	}

	if (lastIndex < value.length) {
		const text = value.slice(lastIndex);
		if (text) {
			nodes.push(
				<span
					key={key++}
					style={{
						color: state.color ? `var(${state.color})` : undefined,
						fontWeight: state.weight,
					}}
				>
					{text}
				</span>,
			);
		}
	}

	return nodes;
}
export function ANSI({ value }: { value: string }) {
	return <>{renderAnsi(value)}</>;
}
