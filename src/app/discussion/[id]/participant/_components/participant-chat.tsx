"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ParticipantChatProps {
	discussionId: string;
	participantId: string;
	displayName: string;
	sessionId: string;
	token: string;
}

export function ParticipantChat({
	discussionId,
	participantId,
	displayName,
	sessionId,
	token,
}: ParticipantChatProps) {
	const [error, setError] = useState<string | null>(null);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// Custom message sending function that works with the chat API
	const sendMessage = async (content: string) => {
		if (!content.trim()) return;

		setIsLoading(true);
		setError(null);

		try {
			const response = await fetch(
				`/api/discussion/${discussionId}/chat-enhanced`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						messages: [
							{
								id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
								role: "user",
								parts: [{ type: "text", text: content.trim() }],
							},
						],
						discussionId,
						participantId,
						sessionId,
					}),
				},
			);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || `HTTP ${response.status}`);
			}

			// Clear input on success
			setInput("");
			textareaRef.current?.focus();
		} catch (err) {
			console.error("Chat error:", err);
			setError(err instanceof Error ? err.message : "Failed to send message");
		} finally {
			setIsLoading(false);
		}
	};

	// Auto-resize textarea
	useEffect(() => {
		const textarea = textareaRef.current;
		if (textarea) {
			textarea.style.height = "auto";
			textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
		}
	}, [input]);

	const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setInput(e.target.value);
		setError(null); // Clear errors when user types
	};

	const handleFormSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		const trimmedInput = input.trim();
		if (!trimmedInput) {
			setError("Message content cannot be empty");
			return;
		}

		if (trimmedInput.length > 2000) {
			setError("Message too long (maximum 2000 characters)");
			return;
		}

		sendMessage(trimmedInput);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleFormSubmit(e);
		}
	};

	const isDisabled = isLoading;
	const characterCount = input.length;
	const isOverLimit = characterCount > 2000;

	return (
		<Card className="sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<CardContent className="p-4">
				{error && (
					<Alert variant="destructive" className="mb-3">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				<form onSubmit={handleFormSubmit} className="space-y-3">
					<div className="relative">
						<Textarea
							ref={textareaRef}
							value={input}
							onChange={handleInputChange}
							onKeyDown={handleKeyDown}
							placeholder="Share your thoughts or ask a question..."
							className="max-h-[120px] min-h-[60px] resize-none pr-12"
							disabled={isDisabled}
							maxLength={2000}
						/>

						{/* Character count */}
						<div
							className={`absolute right-2 bottom-2 text-xs ${
								isOverLimit ? "text-destructive" : "text-muted-foreground"
							}`}
						>
							{characterCount}/2000
						</div>
					</div>

					<div className="flex items-center justify-between gap-2">
						<div className="flex items-center gap-2 text-muted-foreground text-xs">
							<span>Chatting as:</span>
							<span className="font-medium">{displayName}</span>
						</div>

						<div className="flex items-center gap-2">
							<Button
								type="submit"
								size="sm"
								disabled={isDisabled || !input.trim() || isOverLimit}
							>
								{isLoading ? (
									"Sending..."
								) : (
									<>
										<Send className="mr-2 h-4 w-4" />
										Send
									</>
								)}
							</Button>
						</div>
					</div>

					{/* Keyboard shortcut hint */}
					<div className="text-muted-foreground text-xs">
						Press{" "}
						<kbd className="rounded bg-muted px-1.5 py-0.5 text-xs">Enter</kbd>{" "}
						to send,{" "}
						<kbd className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs">
							Shift+Enter
						</kbd>{" "}
						for new line
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
