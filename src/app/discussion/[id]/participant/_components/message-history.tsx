"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";
import { formatDistanceToNow } from "date-fns";
import {
	AlertCircle,
	Bot,
	ChevronUp,
	Loader2,
	Settings,
	User,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface MessageData {
	id: string;
	content: string;
	senderName: string;
	senderType: "user" | "participant" | "system";
	createdAt: string;
}

interface MessageHistoryProps {
	discussionId: string;
	participantId: string;
	token: string;
	initialMessages: MessageData[];
}

export function MessageHistory({
	discussionId,
	participantId,
	token,
	initialMessages,
}: MessageHistoryProps) {
	const [messages, setMessages] = useState<MessageData[]>(initialMessages);
	const [hasMore, setHasMore] = useState(true);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const messagesContainerRef = useRef<HTMLDivElement>(null);
	const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

	// Query for loading more messages
	const {
		data,
		isLoading,
		error: queryError,
		refetch,
	} = api.participant.getMessageHistory.useQuery(
		{
			discussionId,
			before: messages.length > 0 ? messages[0]?.id : undefined,
			limit: 20,
		},
		{
			enabled: false, // We'll trigger this manually
		},
	);

	// Auto-scroll to bottom for new messages
	useEffect(() => {
		if (shouldAutoScroll && messagesEndRef.current) {
			messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, [messages, shouldAutoScroll]);

	// Set up scroll listener to detect if user has scrolled away from bottom
	useEffect(() => {
		const container = messagesContainerRef.current;
		if (!container) return;

		const handleScroll = () => {
			const { scrollTop, scrollHeight, clientHeight } = container;
			const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
			setShouldAutoScroll(isNearBottom);
		};

		container.addEventListener("scroll", handleScroll);
		return () => container.removeEventListener("scroll", handleScroll);
	}, []);

	// Listen for new messages via real-time updates
	useEffect(() => {
		// Set up Server-Sent Events connection for real-time updates
		const eventSource = new EventSource(
			`/api/discussion/${discussionId}/stream?participantToken=${encodeURIComponent(token)}&participantId=${encodeURIComponent(participantId)}`,
		);

		eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);

				if (data.type === "message_received") {
					const newMessage: MessageData = {
						id: data.messageId,
						content: data.content,
						senderName: data.senderName,
						senderType: data.senderType,
						createdAt: new Date(data.timestamp).toISOString(),
					};

					setMessages((prev) => {
						// Avoid duplicates
						if (prev.some((msg) => msg.id === newMessage.id)) {
							return prev;
						}
						return [...prev, newMessage];
					});
				}
			} catch (error) {
				console.error("Error parsing SSE message:", error);
			}
		};

		eventSource.onerror = (error) => {
			console.error("SSE connection error:", error);
			eventSource.close();
		};

		return () => {
			eventSource.close();
		};
	}, [discussionId, participantId, token]);

	// Load more messages (pagination)
	const loadMoreMessages = useCallback(async () => {
		if (isLoadingMore || !hasMore) return;

		setIsLoadingMore(true);
		setError(null);

		try {
			const result = await refetch();

			if (result.data) {
				const newMessages = result.data.messages;

				if (newMessages.length === 0) {
					setHasMore(false);
				} else {
					setMessages((prev) => {
						// Prepend new messages and avoid duplicates
						const existingIds = new Set(prev.map((msg) => msg.id));
						const uniqueNewMessages = newMessages.filter(
							(msg) => !existingIds.has(msg.id),
						);
						return [...uniqueNewMessages, ...prev];
					});
					setHasMore(result.data.hasMore);
				}
			}
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to load more messages",
			);
		} finally {
			setIsLoadingMore(false);
		}
	}, [refetch, isLoadingMore, hasMore]);

	// Handle scroll to top for infinite scroll
	useEffect(() => {
		const container = messagesContainerRef.current;
		if (!container) return;

		const handleScroll = () => {
			if (container.scrollTop === 0 && hasMore && !isLoadingMore) {
				loadMoreMessages();
			}
		};

		container.addEventListener("scroll", handleScroll);
		return () => container.removeEventListener("scroll", handleScroll);
	}, [loadMoreMessages, hasMore, isLoadingMore]);

	const scrollToBottom = () => {
		setShouldAutoScroll(true);
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	if (queryError && messages.length === 0) {
		return (
			<Alert variant="destructive">
				<AlertCircle className="h-4 w-4" />
				<AlertDescription>
					Failed to load message history: {queryError.message}
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<div className="flex h-full flex-col">
			{error && (
				<Alert variant="destructive" className="mb-4">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			<Card className="flex min-h-0 flex-1 flex-col">
				<CardContent
					ref={messagesContainerRef}
					className="flex-1 space-y-4 overflow-y-auto p-4"
				>
					{/* Load more indicator */}
					{hasMore && (
						<div className="flex justify-center">
							{isLoadingMore ? (
								<div className="flex items-center gap-2 text-muted-foreground text-sm">
									<Loader2 className="h-4 w-4 animate-spin" />
									Loading more messages...
								</div>
							) : (
								<Button
									variant="ghost"
									size="sm"
									onClick={loadMoreMessages}
									className="text-muted-foreground"
								>
									<ChevronUp className="mr-2 h-4 w-4" />
									Load more messages
								</Button>
							)}
						</div>
					)}

					{/* Messages */}
					{messages.length === 0 ? (
						<div className="flex flex-1 items-center justify-center">
							<div className="text-center text-muted-foreground">
								<User className="mx-auto mb-2 h-8 w-8" />
								<p className="text-sm">No messages yet</p>
								<p className="text-xs">
									Be the first to start the conversation!
								</p>
							</div>
						</div>
					) : (
						messages.map((message, index) => (
							<MessageItem
								key={message.id}
								message={message}
								isFirst={index === 0}
							/>
						))
					)}

					{/* Scroll to bottom anchor */}
					<div ref={messagesEndRef} />
				</CardContent>
			</Card>

			{/* Scroll to bottom button */}
			{!shouldAutoScroll && (
				<div className="absolute right-4 bottom-20">
					<Button
						size="sm"
						variant="secondary"
						onClick={scrollToBottom}
						className="shadow-lg"
					>
						<ChevronUp className="h-4 w-4 rotate-180" />
					</Button>
				</div>
			)}
		</div>
	);
}

interface MessageItemProps {
	message: MessageData;
	isFirst: boolean;
}

function MessageItem({ message, isFirst }: MessageItemProps) {
	const isSystem = message.senderType === "system";
	const isAI =
		message.senderName.toLowerCase().includes("ai") ||
		message.senderName.toLowerCase().includes("bot");
	const isUser = message.senderType === "user";

	if (isSystem) {
		return (
			<div className="my-2 flex justify-center">
				<div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-muted-foreground text-xs">
					<Settings className="h-3 w-3" />
					{message.content}
				</div>
			</div>
		);
	}

	return (
		<div className="flex gap-3">
			<Avatar className="h-8 w-8 flex-shrink-0">
				{isAI ? (
					<div className="flex h-full w-full items-center justify-center bg-blue-500">
						<Bot className="h-4 w-4 text-white" />
					</div>
				) : (
					<>
						<AvatarImage src="" alt={message.senderName} />
						<AvatarFallback>
							{message.senderName.charAt(0).toUpperCase()}
						</AvatarFallback>
					</>
				)}
			</Avatar>

			<div className="min-w-0 flex-1">
				<div className="mb-1 flex items-center gap-2">
					<span className="font-medium text-sm">{message.senderName}</span>
					{isAI && (
						<Badge variant="secondary" className="text-xs">
							AI
						</Badge>
					)}
					{isUser && (
						<Badge variant="outline" className="text-xs">
							User
						</Badge>
					)}
					<span className="text-muted-foreground text-xs">
						{formatDistanceToNow(new Date(message.createdAt), {
							addSuffix: true,
						})}
					</span>
				</div>

				<Card>
					<CardContent className="p-3">
						<div className="prose prose-sm dark:prose-invert max-w-none">
							{message.content}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
