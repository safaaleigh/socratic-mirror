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
}

export function ChatInput({
	onSendMessage,
	isDisabled = false,
	isSending = false,
	placeholder = "Type a message...",
	maxLength = 2000,
	onStop,
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
	}, [input]);

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
				"border-t bg-background p-4 transition-all",
				isFocused && "bg-accent/5",
			)}
		>
			<form onSubmit={handleSubmit} className="relative">
				<div className="flex gap-2">
					<div className="relative flex-1">
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
								"max-h-[120px] min-h-[44px] resize-none pr-12",
								"transition-all duration-200",
								isOverLimit && "border-destructive focus:ring-destructive",
							)}
							aria-label="Message input"
						/>

						{/* Character count */}
						{showCharCount && (
							<div
								className={cn(
									"absolute right-2 bottom-2 text-xs transition-opacity",
									isOverLimit ? "text-destructive" : "text-muted-foreground/70",
								)}
							>
								{characterCount}/{maxLength}
							</div>
						)}
					</div>

					{/* Send/Stop button */}
					{isSending ? (
						<Button
							type="button"
							onClick={onStop}
							size="icon"
							variant="secondary"
							className="h-[44px] w-[44px]"
							aria-label="Stop generating"
						>
							<Square className="h-4 w-4" />
						</Button>
					) : (
						<Button
							type="submit"
							size="icon"
							disabled={isDisabled || !input.trim() || isOverLimit}
							className="h-[44px] w-[44px]"
							aria-label="Send message"
						>
							<Send className="h-4 w-4" />
						</Button>
					)}
				</div>

				{/* Helper text */}
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
			</form>
		</div>
	);
}
