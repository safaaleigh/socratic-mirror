"use client";

export function TypingIndicator() {
	return (
		<div className="flex items-center gap-1">
			<span className="text-muted-foreground text-xs">Sending</span>
			<div className="flex gap-0.5">
				<span className="inline-block h-1 w-1 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
				<span className="inline-block h-1 w-1 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
				<span className="inline-block h-1 w-1 animate-bounce rounded-full bg-muted-foreground" />
			</div>
		</div>
	);
}
