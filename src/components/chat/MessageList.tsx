"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { UIMessage } from "ai";
import { useEffect, useRef } from "react";
import { MessageItem } from "./MessageItem";

interface MessageListProps {
	messages: UIMessage[];
	currentUserId?: string;
	currentParticipantId?: string;
	displayName: string;
	isLoading?: boolean;
}

export function MessageList({
	messages,
	currentUserId,
	currentParticipantId,
	displayName,
	isLoading = false,
}: MessageListProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const lastMessageCountRef = useRef(messages.length);

	// Auto-scroll to bottom when new messages arrive
	useEffect(() => {
		if (messages.length > lastMessageCountRef.current) {
			scrollRef.current?.scrollIntoView({ behavior: "smooth" });
		}
		lastMessageCountRef.current = messages.length;
	}, [messages.length]);

	// Determine if a message is from the current user
	const isCurrentUserMessage = (message: UIMessage) => {
		// For authenticated users
		if (currentUserId && message.metadata?.userId === currentUserId) {
			return true;
		}
		// For participants
		if (
			currentParticipantId &&
			message.metadata?.participantId === currentParticipantId
		) {
			return true;
		}
		// Don't use role as fallback - this was causing all user messages to appear as current user
		return false;
	};

	if (messages.length === 0 && !isLoading) {
		return (
			<div className="flex flex-1 items-center justify-center p-8">
				<div className="space-y-2 text-center">
					<p className="text-muted-foreground">No messages yet</p>
					<p className="text-muted-foreground text-sm">
						Start the conversation by sending a message below
					</p>
				</div>
			</div>
		);
	}

	return (
		<ScrollArea className="flex-1">
			<div className="space-y-1 py-4">
				{/* Loading skeleton for initial load */}
				{isLoading && messages.length === 0 && (
					<>
						{[...Array(3)].map((_, i) => (
							<MessageSkeleton key={i} />
						))}
					</>
				)}

				{/* Render messages */}
				{messages.map((message, index) => (
					<MessageItem
						key={`${message.id}-${index}`}
						message={message}
						displayName={displayName}
						isCurrentUser={isCurrentUserMessage(message)}
					/>
				))}

				{/* Scroll anchor */}
				<div ref={scrollRef} />
			</div>
		</ScrollArea>
	);
}

function MessageSkeleton() {
	return (
		<div className="flex gap-3 px-4 py-3">
			<Skeleton className="h-8 w-8 rounded-full" />
			<div className="flex max-w-[70%] flex-1 flex-col gap-2">
				<div className="flex items-center gap-2">
					<Skeleton className="h-3 w-16" />
					<Skeleton className="h-3 w-12" />
				</div>
				<Skeleton className="h-16 w-full rounded-2xl" />
			</div>
		</div>
	);
}
