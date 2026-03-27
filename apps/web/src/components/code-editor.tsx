import * as React from "react";

import { createHighlighter } from "shiki";

import { cn } from "@/lib/utils";

import type { BundledLanguage, BundledTheme, HighlighterGeneric } from "shiki";

interface CodeEditorProps {
	value?: string;
	onChange?: (value: string) => void;
	language?: string;
	className?: string;
}

const sharedClasses =
	"p-4 leading-[22.5px] font-sans whitespace-pre overflow-auto absolute inset-0 box-border [tab-size:2]";

function escapeHtml(html: string) {
	return html
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

export function CodeEditor({
	value = "",
	onChange,
	language = "ballerina",
	className,
}: CodeEditorProps) {
	const [highlighted, setHighlighted] = React.useState("");
	const highlighterRef = React.useRef<HighlighterGeneric<
		BundledLanguage,
		BundledTheme
	> | null>(null);
	const textareaRef = React.useRef<HTMLTextAreaElement>(null);
	const preRef = React.useRef<HTMLPreElement>(null);

	const renderHighlight = React.useCallback(
		(
			code: string,
			hl?: HighlighterGeneric<BundledLanguage, BundledTheme> | null,
		) => {
			const instance = hl || highlighterRef.current;
			if (!instance) return;

			try {
				const html = instance.codeToHtml(code || " ", {
					lang: language,
					theme: "github-light",
				});
				const inner = html
					.replace(/^<pre[^>]*><code[^>]*>/, "")
					.replace(/<\/code><\/pre>$/, "");
				setHighlighted(inner);
			} catch {
				setHighlighted(escapeHtml(code));
			}
		},
		[language],
	);

	React.useEffect(() => {
		let isMounted = true;

		async function initShiki() {
			try {
				const hl = await createHighlighter({
					themes: ["github-light"],
					langs: ["ballerina", "toml"],
				});

				if (isMounted) {
					highlighterRef.current = hl;
					renderHighlight(textareaRef.current?.value ?? "", hl);
				}
			} catch {
				if (isMounted)
					setHighlighted(escapeHtml(textareaRef.current?.value ?? ""));
			}
		}

		initShiki();
		return () => {
			isMounted = false;
			highlighterRef.current?.dispose();
			highlighterRef.current = null;
		};
	}, [renderHighlight]);

	React.useEffect(() => {
		renderHighlight(value);
	}, [value, renderHighlight]);

	const syncScroll = React.useCallback(() => {
		if (textareaRef.current && preRef.current) {
			preRef.current.scrollTop = textareaRef.current.scrollTop;
			preRef.current.scrollLeft = textareaRef.current.scrollLeft;
		}
	}, []);

	const handleKeyDown = React.useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key !== "Tab") return;

			e.preventDefault();
			const target = e.currentTarget;
			const { selectionStart, selectionEnd, value: currentValue } = target;

			const newValue =
				currentValue.slice(0, selectionStart) +
				"    " +
				currentValue.slice(selectionEnd);
			onChange?.(newValue);

			setTimeout(() => {
				if (textareaRef.current) {
					textareaRef.current.setSelectionRange(
						selectionStart + 4,
						selectionStart + 4,
					);
				}
			}, 0);
		},
		[onChange],
	);

	return (
		<div
			className={cn(
				"text-[13px] relative flex overflow-hidden h-full min-h-37.5",
				className,
			)}
		>
			<div className="relative grow">
				<pre
					ref={preRef}
					aria-hidden="true"
					className={cn(sharedClasses, "z-10 pointer-events-none no-scrollbar")}
					// biome-ignore lint/security/noDangerouslySetInnerHtml: content is sanitized via Shiki's HTML escaping
					dangerouslySetInnerHTML={{ __html: `${highlighted}\n` }}
				/>
				<textarea
					ref={textareaRef}
					value={value}
					onChange={(e) => onChange?.(e.target.value)}
					onScroll={syncScroll}
					onKeyDown={handleKeyDown}
					spellCheck={false}
					autoCapitalize="off"
					autoComplete="off"
					autoCorrect="off"
					className={cn(
						sharedClasses,
						"z-20 bg-transparent text-transparent caret-blue-500 outline-none resize-none no-scrollbar",
					)}
				/>
			</div>
		</div>
	);
}
