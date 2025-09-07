"use client";

import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useWebSocket } from "@/hooks/useWebSocket";
import { api } from "@/trpc/react";
import { AlertCircle, Bot, Send, X } from "lucide-react";

interface MessageInputProps {
	discussionId: string;
	replyToMessageId?: string;
	replyToContent?: string;
	onSent?: () => void;
	onCancelReply?: () => void;
}

export function MessageInput({
	discussionId,
	replyToMessageId,
	replyToContent,
	onSent,
	onCancelReply,
}: MessageInputProps) {
	const [content, setContent] = useState("");
	const [isTyping, setIsTyping] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	const utils = api.useUtils();

	// WebSocket integration for typing indicators
	const { startTyping, stopTyping } = useWebSocket({
		discussionId,
		onNewMessage: () => {
			// Message list component will handle this
		},
	});

	const sendMessageMutation = api.message.send.useMutation({
		onSuccess: () => {
			setContent("");
			setError(null);
			void utils.message.list.invalidate({ discussionId });
			onSent?.();
		},
		onError: (error) => {
			setError(error.message);
		},
	});

	const requestAIResponseMutation = api.message.getAIResponse.useMutation({
		onSuccess: () => {
			void utils.message.list.invalidate({ discussionId });
		},
		onError: (error) => {
			setError(error.message);
		},
	});

	const setTypingMutation = api.message.setTyping.useMutation();

	// Handle typing indicator
	const handleTypingChange = (typing: boolean) => {
		if (isTyping !== typing) {
			setIsTyping(typing);
			// Use WebSocket for real-time typing indicators
			if (typing) {
				startTyping();
			} else {
				stopTyping();
			}
		}

		if (typing) {
			// Clear existing timeout
			if (typingTimeoutRef.current) {
				clearTimeout(typingTimeoutRef.current);
			}
			// Set new timeout to stop typing indicator
			typingTimeoutRef.current = setTimeout(() => {
				setIsTyping(false);
				stopTyping();
			}, 3000);
		}
	};

	// Clean up typing timeout on unmount
	useEffect(() => {
		return () => {
			if (typingTimeoutRef.current) {
				clearTimeout(typingTimeoutRef.current);
			}
			// Ensure typing indicator is stopped on unmount
			stopTyping();
		};
	}, [stopTyping]);

	const handleContentChange = (value: string) => {
		setContent(value);
		setError(null);

		// Handle typing indicator
		if (value.trim()) {
			handleTypingChange(true);
		} else {
			handleTypingChange(false);
		}
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		const trimmedContent = content.trim();
		if (!trimmedContent) {
			setError("Message content cannot be empty");
			return;
		}

		if (trimmedContent.length > 2000) {
			setError("Message too long (maximum 2000 characters)");
			return;
		}

		// Stop typing indicator
		handleTypingChange(false);

		sendMessageMutation.mutate({
			discussionId,
			content: trimmedContent,
			parentId: replyToMessageId,
		});
	};

	const handleRequestAIResponse = () => {
		requestAIResponseMutation.mutate({
			discussionId,
		});
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmit(e);
		}
	};

	const handleCancel = () => {
		setContent("");
		setError(null);
		handleTypingChange(false);
		stopTyping();
		onCancelReply?.();
	};

	const isDisabled =
		sendMessageMutation.isPending || requestAIResponseMutation.isPending;
	const characterCount = content.length;
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

				{/* Reply Context */}
				{replyToMessageId && replyToContent && (
					<div className="mb-3 rounded-md bg-muted p-3">
						<div className="flex items-start justify-between gap-2">
							<div className="min-w-0 flex-1">
								<div className="mb-1 text-muted-foreground text-xs">
									Replying to:
								</div>
								<div className="line-clamp-2 text-muted-foreground text-sm">
									{replyToContent}
								</div>
							</div>
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6"
								onClick={handleCancel}
							>
								<X className="h-3 w-3" />
							</Button>
						</div>
					</div>
				)}

				<form onSubmit={handleSubmit} className="space-y-3">
					<div className="relative">
						<Textarea
							ref={textareaRef}
							value={content}
							onChange={(e) => handleContentChange(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder={
								replyToMessageId
									? "Write your reply..."
									: "Share your thoughts or ask a question..."
							}
							className="min-h-[80px] resize-none pr-12"
							disabled={isDisabled}
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
						<div className="flex items-center gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={handleRequestAIResponse}
								disabled={isDisabled}
							>
								<Bot className="mr-2 h-4 w-4" />
								Ask AI Facilitator
							</Button>
						</div>

						<div className="flex items-center gap-2">
							{replyToMessageId && (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={handleCancel}
									disabled={isDisabled}
								>
									Cancel
								</Button>
							)}

							<Button
								type="submit"
								size="sm"
								disabled={isDisabled || !content.trim() || isOverLimit}
							>
								{sendMessageMutation.isPending ? (
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
						to send,
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
