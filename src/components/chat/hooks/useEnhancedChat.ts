"use client";

import { api } from "@/trpc/react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";

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

	// Handle message history loading
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

	// For authenticated users, use the message router (TODO: implement this)
	// const authenticatedMessagesQuery = api.message.list.useQuery(
	//   { discussionId, limit: 50 },
	//   { enabled: !hasLoadedInitialMessages && !!currentUserId }
	// );

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

	// Merge existing messages with AI SDK messages
	const allMessages = [...existingMessages, ...aiMessages];

	// Update AI SDK messages when existing messages are loaded
	useEffect(() => {
		if (hasLoadedInitialMessages && existingMessages.length > 0) {
			// Only set messages if AI SDK doesn't have messages yet
			if (aiMessages.length === 0) {
				setAiMessages(existingMessages);
			}
		}
	}, [
		hasLoadedInitialMessages,
		existingMessages,
		aiMessages.length,
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
			return {
				senderName: message.metadata?.senderName || displayName,
				timestamp: message.metadata?.timestamp || new Date().toISOString(),
				senderType: message.metadata?.senderType || "participant",
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
			!hasLoadedInitialMessages && messageHistoryQuery.isLoading,

		// Metadata
		participantInfo: {
			id: participantId,
			displayName,
			sessionId,
		},
	};
}
