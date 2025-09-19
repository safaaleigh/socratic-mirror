"use client";

import { api } from "@/trpc/react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";

interface MessageMetadata {
	senderName?: string;
	timestamp?: string;
	senderType?: string;
	createdAt?: string;
}

interface UseEnhancedChatProps {
	discussionId: string;
	participantId: string;
	sessionId: string;
	displayName: string;
	currentUserId?: string; // If provided, user is authenticated
	onMessageSent?: () => void;
	onError?: (error: Error) => void;
}

// Helper function to convert participant router messages to AI SDK format
function convertToUIMessage(message: {
	id: string;
	content: string;
	senderName: string;
	senderType: string;
	createdAt: string;
}): UIMessage {
	return {
		id: message.id,
		role: "user", // All user messages in the chat are "user" role for AI SDK
		parts: [{ type: "text", text: message.content }],
		metadata: {
			senderName: message.senderName,
			senderType: message.senderType,
			createdAt: message.createdAt,
		},
	};
}

export function useEnhancedChat({
	discussionId,
	participantId,
	sessionId,
	displayName,
	currentUserId,
	onMessageSent,
	onError,
}: UseEnhancedChatProps) {
	const lastMessageIdRef = useRef<string | null>(null);
	const [existingMessages, setExistingMessages] = useState<UIMessage[]>([]);
	const [hasLoadedInitialMessages, setHasLoadedInitialMessages] =
		useState(false);

	// Fetch existing messages using the appropriate endpoint
	const messageHistoryQuery = api.participant.getMessageHistory.useQuery(
		{ discussionId, limit: 50 },
		{
			enabled: !hasLoadedInitialMessages && !currentUserId, // Only for anonymous participants
		},
	);

	// For authenticated users, use the message router
	const authenticatedMessagesQuery = api.message.list.useQuery(
		{ discussionId, limit: 50 },
		{
			enabled: !!currentUserId, // Always enabled for authenticated users
		},
	);

	// Handle message history loading for anonymous participants
	useEffect(() => {
		if (messageHistoryQuery.isSuccess && messageHistoryQuery.data) {
			const convertedMessages =
				messageHistoryQuery.data.messages.map(convertToUIMessage);
			setExistingMessages(convertedMessages);
			setHasLoadedInitialMessages(true);
		} else if (messageHistoryQuery.isError) {
			console.error(
				"Failed to load message history:",
				messageHistoryQuery.error,
			);
			setHasLoadedInitialMessages(true); // Still mark as loaded to prevent retry
		}
	}, [
		messageHistoryQuery.isSuccess,
		messageHistoryQuery.data,
		messageHistoryQuery.isError,
		messageHistoryQuery.error,
	]);

	// Handle message history loading for authenticated users
	useEffect(() => {
		if (authenticatedMessagesQuery.isSuccess && authenticatedMessagesQuery.data) {
			// Convert authenticated messages to UI format
			const convertedMessages = authenticatedMessagesQuery.data.messages.map((message) => {
				// Determine sender info - check if it's an AI message or user message
				let senderName: string;
				let senderType: string;

				if (message.type === "AI_QUESTION" || message.type === "AI_PROMPT" || message.type === "SYSTEM") {
					senderName = "AI Facilitator";
					senderType = "ai";
				} else if (message.type === "MODERATOR") {
					senderName = message.author?.name || "Moderator";
					senderType = "moderator";
				} else {
					senderName = message.author?.name || "Unknown User";
					senderType = "user";
				}

				return {
					id: message.id,
					role: "user" as const,
					parts: [{ type: "text" as const, text: message.content }],
					metadata: {
						senderName,
						senderType,
						createdAt: message.createdAt.toISOString(),
					},
				};
			});
			setExistingMessages(convertedMessages.reverse()); // Reverse to show chronological order
			setHasLoadedInitialMessages(true);
		} else if (authenticatedMessagesQuery.isError) {
			console.error(
				"Failed to load authenticated message history:",
				authenticatedMessagesQuery.error,
			);
			setHasLoadedInitialMessages(true); // Still mark as loaded to prevent retry
		}
	}, [
		authenticatedMessagesQuery.isSuccess,
		authenticatedMessagesQuery.data,
		authenticatedMessagesQuery.isError,
		authenticatedMessagesQuery.error,
	]);

	// Configure the transport with the enhanced API endpoint
	const transport = new DefaultChatTransport({
		api: `/api/discussion/${discussionId}/chat-enhanced`,
		prepareSendMessagesRequest: ({ messages }) => ({
			body: {
				messages,
				participantId,
				discussionId,
				sessionId,
			},
		}),
	});

	const {
		messages: aiMessages,
		sendMessage,
		status,
		error,
		setMessages: setAiMessages,
		stop,
		regenerate,
	} = useChat({
		transport,
		experimental_throttle: 50, // Smooth UI updates
		onFinish: () => {
			onMessageSent?.();
		},
		onError: (error) => {
			console.error("Chat error:", error);
			onError?.(error);
		},
	});

	// Use existing messages from server or AI SDK messages for new messages
	const allMessages = hasLoadedInitialMessages ? aiMessages : [];

	// Update AI SDK messages when existing messages are loaded or refreshed
	useEffect(() => {
		if (hasLoadedInitialMessages && existingMessages.length >= 0) {
			// Always update AI SDK messages when existingMessages change (including after invalidation)
			setAiMessages(existingMessages);
		}
	}, [
		hasLoadedInitialMessages,
		existingMessages,
		setAiMessages,
	]);

	// Helper to send a text message
	const sendTextMessage = useCallback(
		(text: string) => {
			const trimmedText = text.trim();
			if (!trimmedText) return;

			// Generate a unique ID for the message
			const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
			lastMessageIdRef.current = messageId;

			sendMessage({
				text: trimmedText,
			});
		},
		[sendMessage],
	);

	// Helper to check if we can send messages
	const canSendMessage = status === "ready";

	// Helper to check if we're currently sending
	const isSending = status === "submitted" || status === "streaming";

	// Auto-scroll behavior
	const scrollToBottom = useCallback(() => {
		// This will be called from the message list component
		// when new messages arrive
	}, []);

	// Message formatting helpers
	const getMessageText = useCallback((message: UIMessage) => {
		if (!message.parts) return "";
		return message.parts
			.filter((part) => part.type === "text")
			.map((part) => part.text)
			.join("");
	}, []);

	const getMessageMetadata = useCallback(
		(message: UIMessage) => {
			const metadata = message.metadata as MessageMetadata | undefined;
			return {
				senderName: metadata?.senderName || displayName,
				timestamp: metadata?.timestamp || new Date().toISOString(),
				senderType: metadata?.senderType || "participant",
			};
		},
		[displayName],
	);

	return {
		// Core chat state
		messages: allMessages, // Use merged messages
		status,
		error,

		// Actions
		sendTextMessage,
		setMessages: setAiMessages, // Still use AI SDK's setMessages
		stop,
		regenerate,

		// Helpers
		canSendMessage,
		isSending,
		scrollToBottom,
		getMessageText,
		getMessageMetadata,

		// Loading state
		isLoadingHistory:
			!hasLoadedInitialMessages &&
			(messageHistoryQuery.isLoading || authenticatedMessagesQuery.isLoading),

		// Metadata
		participantInfo: {
			id: participantId,
			displayName,
			sessionId,
		},
	};
}
