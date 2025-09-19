"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Send, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface ChatInputProps {
	onSendMessage: (message: string) => void;
	isDisabled?: boolean;
	isSending?: boolean;
	placeholder?: string;
	maxLength?: number;
	onStop?: () => void;
	isMobile?: boolean;
}

export function ChatInput({
	onSendMessage,
	isDisabled = false,
	isSending = false,
	placeholder = "Type a message...",
	maxLength = 2000,
	onStop,
	isMobile = false,
}: ChatInputProps) {
	const [input, setInput] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [isFocused, setIsFocused] = useState(false);

	// Auto-resize textarea
	useEffect(() => {
		const textarea = textareaRef.current;
		if (textarea) {
			textarea.style.height = "auto";
			const newHeight = Math.min(textarea.scrollHeight, 120);
			textarea.style.height = `${newHeight}px`;
		}
	});

	// Handle submit
	const handleSubmit = useCallback(
		(e?: React.FormEvent) => {
			e?.preventDefault();

			const trimmedInput = input.trim();
			if (!trimmedInput || isDisabled || isSending) return;

			if (trimmedInput.length > maxLength) return;

			onSendMessage(trimmedInput);
			setInput("");

			// Keep focus on input after sending
			setTimeout(() => {
				textareaRef.current?.focus();
			}, 0);
		},
		[input, isDisabled, isSending, maxLength, onSendMessage],
	);

	// Handle keyboard shortcuts
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			// Send on Enter (without shift)
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleSubmit();
			}

			// Stop generation on Escape
			if (e.key === "Escape" && isSending && onStop) {
				e.preventDefault();
				onStop();
			}
		},
		[handleSubmit, isSending, onStop],
	);

	const characterCount = input.length;
	const isOverLimit = characterCount > maxLength;
	const showCharCount = characterCount > maxLength * 0.8; // Show when > 80% of limit

	return (
		<div
			className={cn(
				"border-t bg-background transition-all",
				isMobile ? "p-3" : "p-4",
				isFocused && "bg-accent/5",
			)}
		>
			<form onSubmit={handleSubmit} className="relative">
				<div className="relative">
					<Textarea
						ref={textareaRef}
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
						onFocus={() => setIsFocused(true)}
						onBlur={() => setIsFocused(false)}
						placeholder={placeholder}
						disabled={isDisabled}
						maxLength={maxLength + 100} // Allow slight overflow for better UX
						className={cn(
							"resize-none transition-all duration-200",
							isMobile
								? "max-h-[100px] min-h-[48px] pr-14 text-base" // Larger touch target on mobile
								: "max-h-[120px] min-h-[44px] pr-12",
							isOverLimit && "border-destructive focus:ring-destructive",
						)}
						aria-label="Message input"
					/>

					{/* Send/Stop button - positioned inside input */}
					<div className={cn(
						"absolute top-2 right-2",
						isMobile && "top-3 right-3" // Better positioning on mobile
					)}>
						{isSending ? (
							<Button
								type="button"
								onClick={onStop}
								size="icon"
								variant="ghost"
								className={cn(
									isMobile ? "h-10 w-10" : "h-8 w-8" // Larger touch target on mobile
								)}
								aria-label="Stop generating"
							>
								<Square className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />
							</Button>
						) : (
							<Button
								type="submit"
								size="icon"
								variant="ghost"
								disabled={isDisabled || !input.trim() || isOverLimit}
								className={cn(
									isMobile ? "h-10 w-10" : "h-8 w-8" // Larger touch target on mobile
								)}
								aria-label="Send message"
							>
								<Send className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />
							</Button>
						)}
					</div>

					{/* Character count */}
					{showCharCount && (
						<div
							className={cn(
								"absolute bottom-2 text-xs transition-opacity",
								isMobile ? "right-16" : "right-12",
								isOverLimit ? "text-destructive" : "text-muted-foreground/70",
							)}
						>
							{characterCount}/{maxLength}
						</div>
					)}
				</div>

				{/* Helper text - hide on mobile to save space */}
				{!isMobile && (
					<div className="mt-2 flex items-center justify-between text-muted-foreground text-xs">
						<span>
							{isSending ? (
								"Sending..."
							) : (
								<>
									<kbd className="rounded bg-muted px-1.5 py-0.5">Enter</kbd> to
									send,{" "}
									<kbd className="rounded bg-muted px-1.5 py-0.5">
										Shift+Enter
									</kbd>{" "}
									for new line
								</>
							)}
						</span>

						{isSending && onStop && (
							<span>
								Press <kbd className="rounded bg-muted px-1.5 py-0.5">Esc</kbd> to
								stop
							</span>
						)}
					</div>
				)}
			</form>
		</div>
	);
}
