"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { UIMessage } from "ai";

interface MessageItemProps {
	message: UIMessage;
	displayName?: string;
	isCurrentUser?: boolean;
}

export function MessageItem({
	message,
	displayName,
	isCurrentUser = false,
}: MessageItemProps) {
	// Extract text from message parts
	const text = message.parts
		.filter((part) => part.type === "text")
		.map((part) => part.text)
		.join("");

	// Get metadata
	const senderName = message.metadata?.senderName || displayName || "Anonymous";
	const senderType = message.metadata?.senderType || "USER";
	const messageType = message.metadata?.type || "USER";
	const timestamp = message.metadata?.timestamp
		? new Date(message.metadata.timestamp).toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
			})
		: "";

	// Check if this is an AI facilitator message
	const isAIFacilitator =
		senderType === "SYSTEM" &&
		(messageType === "AI_QUESTION" || messageType === "AI_PROMPT");
	const isSystemMessage = senderType === "SYSTEM";

	// Get initials for avatar
	const initials = isAIFacilitator
		? "🤖"
		: senderName
				.split(" ")
				.map((n) => n[0])
				.join("")
				.toUpperCase()
				.slice(0, 2);

	return (
		<div
			className={cn(
				"group flex gap-3 px-4 py-3",
				isCurrentUser && "flex-row-reverse",
			)}
		>
			{/* Avatar */}
			<Avatar className="h-8 w-8 shrink-0">
				<AvatarImage src={undefined} alt={senderName} />
				<AvatarFallback className="text-xs">{initials}</AvatarFallback>
			</Avatar>

			{/* Message Content */}
			<div
				className={cn(
					"flex max-w-[70%] flex-col gap-1",
					isCurrentUser && "items-end",
				)}
			>
				{/* Header */}
				<div
					className={cn(
						"flex items-center gap-2 text-muted-foreground text-xs",
						isCurrentUser && "flex-row-reverse",
					)}
				>
					<span className="font-medium">{senderName}</span>
					{timestamp && (
						<>
							<span>·</span>
							<span>{timestamp}</span>
						</>
					)}
				</div>

				{/* Message Bubble */}
				<div
					className={cn(
						"break-words rounded-2xl px-4 py-2",
						isAIFacilitator
							? "border border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100"
							: isCurrentUser
								? "bg-primary text-primary-foreground"
								: "bg-muted",
					)}
				>
					<p className="whitespace-pre-wrap text-sm">{text}</p>
				</div>
			</div>
		</div>
	);
}
