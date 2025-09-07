"use client";

import { formatDistanceToNow } from "date-fns";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { type MessageEvent, useWebSocket } from "@/hooks/useWebSocket";
import { api } from "@/trpc/react";
import {
	AlertCircle,
	Bot,
	Edit2,
	MoreVertical,
	Reply,
	ThumbsUp,
	Trash2,
	User,
	Users,
	Wifi,
	WifiOff,
} from "lucide-react";

interface MessageListProps {
	discussionId: string;
	onReplyToMessage?: (messageId: string, content: string) => void;
	onEditMessage?: (messageId: string) => void;
}

export function MessageList({
	discussionId,
	onReplyToMessage,
	onEditMessage,
}: MessageListProps) {
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const [replyingTo, setReplyingTo] = useState<string | null>(null);
	const [realTimeMessages, setRealTimeMessages] = useState<any[]>([]);

	const {
		data: messages,
		isLoading,
		error,
	} = api.message.list.useQuery({
		discussionId,
		limit: 50,
	});

	const utils = api.useUtils();

	// WebSocket integration for real-time updates
	const { isConnected, connectionError, connectedUsers, typingUsers } =
		useWebSocket({
			discussionId,
			onNewMessage: (event: MessageEvent) => {
				// Invalidate and refetch messages to get the new message
				void utils.message.list.invalidate({ discussionId });
			},
			onMessageEdited: (event: MessageEvent) => {
				// Invalidate to get the updated message
				void utils.message.list.invalidate({ discussionId });
			},
			onMessageDeleted: (event: MessageEvent) => {
				// Invalidate to remove the deleted message
				void utils.message.list.invalidate({ discussionId });
			},
			onUserJoined: (user) => {
				console.log(`${user.name} joined the discussion`);
			},
			onUserLeft: (userId) => {
				console.log(`User ${userId} left the discussion`);
			},
			onTypingUpdate: (users) => {
				console.log("Typing users:", users);
			},
			onAIThinking: (isThinking) => {
				console.log("AI is thinking:", isThinking);
			},
		});

	const reactToMessageMutation = api.message.react.useMutation({
		onSuccess: () => {
			void utils.message.list.invalidate({ discussionId });
		},
	});

	const deleteMessageMutation = api.message.delete.useMutation({
		onSuccess: () => {
			void utils.message.list.invalidate({ discussionId });
		},
	});

	// Auto-scroll to bottom when new messages arrive
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages?.messages.length]);

	const handleReaction = (
		messageId: string,
		reaction: "👍" | "👎" | "❤️" | "🤔" | "💡" | "🎯",
	) => {
		reactToMessageMutation.mutate({
			messageId,
			reaction,
		});
	};

	const handleDeleteMessage = (messageId: string) => {
		if (confirm("Are you sure you want to delete this message?")) {
			deleteMessageMutation.mutate({ messageId });
		}
	};

	if (isLoading) {
		return (
			<div className="space-y-4">
				{[...Array(5)].map((_, i) => (
					<div key={i} className="flex gap-3">
						<Skeleton className="h-8 w-8 rounded-full" />
						<div className="flex-1 space-y-2">
							<Skeleton className="h-4 w-1/4" />
							<Skeleton className="h-16 w-full" />
						</div>
					</div>
				))}
			</div>
		);
	}

	if (error) {
		return (
			<Alert variant="destructive">
				<AlertCircle className="h-4 w-4" />
				<AlertTitle>Error loading messages</AlertTitle>
				<AlertDescription>{error.message}</AlertDescription>
			</Alert>
		);
	}

	if (!messages?.messages || messages.messages.length === 0) {
		return (
			<Card>
				<CardContent className="py-12 text-center">
					<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
						<User className="h-6 w-6 text-muted-foreground" />
					</div>
					<h3 className="mt-4 font-semibold">No messages yet</h3>
					<p className="mt-2 text-muted-foreground text-sm">
						Be the first to start the discussion! Share your thoughts or ask a
						question.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-4">
			{/* Connection status and active users */}
			<div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
				<div className="flex items-center gap-2 text-sm">
					{isConnected ? (
						<>
							<Wifi className="h-4 w-4 text-green-500" />
							<span className="text-green-600">Connected</span>
						</>
					) : (
						<>
							<WifiOff className="h-4 w-4 text-red-500" />
							<span className="text-red-600">
								{connectionError || "Disconnected"}
							</span>
						</>
					)}
				</div>

				{connectedUsers.length > 0 && (
					<div className="flex items-center gap-2 text-muted-foreground text-sm">
						<Users className="h-4 w-4" />
						<span>{connectedUsers.length} online</span>
					</div>
				)}
			</div>

			{messages.messages.map((message) => (
				<MessageItem
					key={message.id}
					message={message}
					onReact={handleReaction}
					onReply={() => setReplyingTo(message.id)}
					onEdit={() => onEditMessage?.(message.id)}
					onDelete={() => handleDeleteMessage(message.id)}
					isReplying={replyingTo === message.id}
					onCancelReply={() => setReplyingTo(null)}
				/>
			))}

			{/* Typing indicators */}
			{typingUsers.length > 0 && (
				<div className="flex gap-3">
					<Avatar className="h-8 w-8">
						<div className="flex h-full w-full items-center justify-center bg-muted">
							<div className="flex gap-0.5">
								<div className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
								<div className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
								<div className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground" />
							</div>
						</div>
					</Avatar>
					<div className="flex items-center">
						<span className="text-muted-foreground text-sm">
							{typingUsers.length === 1
								? `${typingUsers[0].name} is typing...`
								: `${typingUsers.length} people are typing...`}
						</span>
					</div>
				</div>
			)}

			<div ref={messagesEndRef} />
		</div>
	);
}

interface MessageItemProps {
	message: any;
	onReact: (messageId: string, emoji: string) => void;
	onReply: () => void;
	onEdit: () => void;
	onDelete: () => void;
	isReplying: boolean;
	onCancelReply: () => void;
}

function MessageItem({
	message,
	onReact,
	onReply,
	onEdit,
	onDelete,
	isReplying,
	onCancelReply,
}: MessageItemProps) {
	const isAI = message.author?.id === "ai-facilitator";
	const isCurrentUser = true; // We'll need to get this from session context

	return (
		<div
			className={`flex gap-3 ${message.parentId ? "ml-8 border-muted border-l-2 pl-4" : ""}`}
		>
			<Avatar className="h-8 w-8">
				{isAI ? (
					<div className="flex h-full w-full items-center justify-center bg-blue-500">
						<Bot className="h-4 w-4 text-white" />
					</div>
				) : (
					<>
						<AvatarImage src={message.author?.image} />
						<AvatarFallback>
							{message.author?.name?.charAt(0)?.toUpperCase() || "U"}
						</AvatarFallback>
					</>
				)}
			</Avatar>

			<div className="min-w-0 flex-1">
				<div className="mb-2 flex items-center gap-2">
					<span className="font-medium text-sm">
						{isAI ? "AI Facilitator" : message.author?.name || "Unknown User"}
					</span>
					{isAI && (
						<Badge variant="secondary" className="text-xs">
							AI
						</Badge>
					)}
					<span className="text-muted-foreground text-xs">
						{formatDistanceToNow(message.createdAt, { addSuffix: true })}
					</span>
					{message.isEdited && (
						<Badge variant="outline" className="text-xs">
							Edited
						</Badge>
					)}
				</div>

				<Card className="mb-2">
					<CardContent className="p-3">
						<div className="prose prose-sm dark:prose-invert max-w-none">
							{message.content}
						</div>

						{/* AI Suggestions */}
						{message.aiSuggestions && message.aiSuggestions.length > 0 && (
							<div className="mt-3 border-t pt-3">
								<p className="mb-2 text-muted-foreground text-xs">
									AI Suggestions:
								</p>
								<div className="flex flex-wrap gap-2">
									{message.aiSuggestions.map(
										(suggestion: string, index: number) => (
											<Button
												key={index}
												variant="outline"
												size="sm"
												className="h-7 text-xs"
												onClick={() => {
													// Handle suggestion click - could trigger a reply
													onReply();
												}}
											>
												{suggestion}
											</Button>
										),
									)}
								</div>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Message Actions */}
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						className="h-7 gap-1"
						onClick={() => onReact(message.id, "👍")}
					>
						<ThumbsUp className="h-3 w-3" />
						{message.reactions?.["👍"] || 0}
					</Button>

					<Button
						variant="ghost"
						size="sm"
						className="h-7 gap-1"
						onClick={onReply}
					>
						<Reply className="h-3 w-3" />
						Reply
					</Button>

					{(isCurrentUser || message.canEdit) && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon" className="h-7 w-7">
									<MoreVertical className="h-3 w-3" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={onEdit}>
									<Edit2 className="mr-2 h-4 w-4" />
									Edit
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={onDelete}
									className="text-destructive"
								>
									<Trash2 className="mr-2 h-4 w-4" />
									Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					)}
				</div>

				{/* Reply Indicators */}
				{message.replyCount > 0 && (
					<div className="mt-2">
						<Button
							variant="ghost"
							size="sm"
							className="text-muted-foreground text-xs"
						>
							{message.replyCount}{" "}
							{message.replyCount === 1 ? "reply" : "replies"}
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}
