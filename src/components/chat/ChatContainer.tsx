"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";
import { TypingIndicator } from "./TypingIndicator";
import { useEnhancedChat } from "./hooks/useEnhancedChat";

interface ChatContainerProps {
	discussionId: string;
	participantId: string;
	sessionId: string;
	displayName: string;
	currentUserId?: string;
	className?: string;
	isMobile?: boolean;
}

export function ChatContainer({
	discussionId,
	participantId,
	sessionId,
	displayName,
	currentUserId,
	className,
	isMobile = false,
}: ChatContainerProps) {
	const [showError, setShowError] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const {
		messages,
		status,
		error,
		sendTextMessage,
		stop,
		canSendMessage,
		isSending,
		isLoadingHistory,
		participantInfo,
	} = useEnhancedChat({
		discussionId,
		participantId,
		sessionId,
		displayName,
		currentUserId,
		onError: (error) => {
			setErrorMessage(error.message);
			setShowError(true);
			// Auto-hide error after 5 seconds
			setTimeout(() => setShowError(false), 5000);
		},
	});

	// Handle viewport height on mobile
	useEffect(() => {
		if (isMobile) {
			const updateHeight = () => {
				const vh = window.innerHeight * 0.01;
				document.documentElement.style.setProperty("--vh", `${vh}px`);
			};

			updateHeight();
			window.addEventListener("resize", updateHeight);
			window.addEventListener("orientationchange", updateHeight);

			return () => {
				window.removeEventListener("resize", updateHeight);
				window.removeEventListener("orientationchange", updateHeight);
			};
		}
	}, [isMobile]);

	return (
		<div
			className={cn(
				"flex flex-col overflow-hidden bg-background border",
				isMobile
					? "h-[calc(var(--vh,1vh)*100)] border-0"
					: "h-[600px] rounded-lg",
				className,
			)}
		>
			{/* Header */}
			<div className="border-b bg-muted/30 px-4 py-3">
				<div className="flex items-center justify-between">
					<div>
						<h3 className="font-semibold">Discussion Chat</h3>
						<p className="text-muted-foreground text-xs">
							Chatting as {displayName}
						</p>
					</div>
					<div className="flex items-center gap-2">
						{isSending && <TypingIndicator />}
					</div>
				</div>
			</div>

			{/* Error Alert */}
			{showError && errorMessage && (
				<Alert variant="destructive" className="mx-4 mt-2">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>{errorMessage}</AlertDescription>
				</Alert>
			)}

			{/* Message List */}
			<MessageList
				messages={messages}
				currentUserId={currentUserId}
				currentParticipantId={participantId}
				displayName={displayName}
				isLoading={isLoadingHistory || status === "submitted"}
			/>

			{/* Input Area */}
			<ChatInput
				onSendMessage={sendTextMessage}
				isDisabled={!canSendMessage}
				isSending={isSending}
				placeholder="Share your thoughts..."
				onStop={stop}
			/>
		</div>
	);
}
