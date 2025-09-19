"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

	// Get initials for avatar - safer approach without non-null assertions
	const getInitials = (name: string): string => {
		if (!name || name.trim() === "" || name === "Anonymous") {
			return "A";
		}

		const cleanName = name.trim();

		// Handle single character names
		if (cleanName.length === 1) {
			return cleanName.toUpperCase();
		}

		// Split by spaces and filter empty strings
		const words = cleanName.split(/\s+/).filter((word) => word.length > 0);

		if (words.length === 0) {
			return "A";
		}

		if (words.length === 1) {
			// Single word: take first 2 characters
			const word = words[0];
			if (!word) return "A";
			return word.length >= 2
				? word.substring(0, 2).toUpperCase()
				: word.toUpperCase();
		}

		// Multiple words: take first letter of first two words
		const firstWord = words[0];
		const secondWord = words[1];

		if (!firstWord || !secondWord) {
			return firstWord ? firstWord.charAt(0).toUpperCase() : "A";
		}

		return (firstWord.charAt(0) + secondWord.charAt(0)).toUpperCase();
	};

	const initials = isAIFacilitator ? "🤖" : getInitials(senderName);

	// Generate consistent color based on sender name
	const getAvatarColor = (name: string): string => {
		if (isAIFacilitator) return "bg-blue-500";

		// Simple hash function to generate consistent colors
		let hash = 0;
		for (let i = 0; i < name.length; i++) {
			hash = name.charCodeAt(i) + ((hash << 5) - hash);
		}

		// Array of pleasant colors
		const colors = [
			"bg-red-500",
			"bg-orange-500",
			"bg-amber-500",
			"bg-yellow-500",
			"bg-lime-500",
			"bg-green-500",
			"bg-emerald-500",
			"bg-teal-500",
			"bg-cyan-500",
			"bg-sky-500",
			"bg-blue-500",
			"bg-indigo-500",
			"bg-violet-500",
			"bg-purple-500",
			"bg-fuchsia-500",
			"bg-pink-500",
			"bg-rose-500"
		];

		return colors[Math.abs(hash) % colors.length] || "bg-gray-500";
	};

	const avatarColor = getAvatarColor(senderName);

	return (
		<div
			className={cn(
				"group flex gap-3 px-4 py-3",
				isCurrentUser && "flex-row-reverse",
			)}
		>
			{/* Avatar */}
			<Avatar className="h-8 w-8 shrink-0">
				<AvatarFallback className={cn("text-xs text-white font-medium", avatarColor)}>
					{initials}
				</AvatarFallback>
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
