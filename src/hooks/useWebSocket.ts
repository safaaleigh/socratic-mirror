"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";

// WebSocket data types
type WebSocketData =
	| { user: ConnectedUser } // for user_joined
	| { userId: string } // for user_left
	| { messageId?: string; content?: string } // for messages
	| Record<string, unknown>; // fallback for other data

export interface WebSocketMessage {
	type: "message" | "typing" | "join" | "leave" | "error" | "ping" | "pong";
	discussionId?: string;
	userId?: string;
	data?: WebSocketData;
	timestamp: number;
}

export interface MessageEvent {
	type:
		| "new_message"
		| "message_edited"
		| "message_deleted"
		| "user_joined"
		| "user_left"
		| "typing"
		| "ai_thinking";
	discussionId: string;
	userId?: string;
	data: WebSocketData;
	timestamp: number;
}

export interface ConnectedUser {
	id: string;
	name: string;
}

export interface TypingUser {
	id: string;
	name: string;
}

interface UseWebSocketProps {
	discussionId: string;
	onNewMessage?: (event: MessageEvent) => void;
	onMessageEdited?: (event: MessageEvent) => void;
	onMessageDeleted?: (event: MessageEvent) => void;
	onUserJoined?: (user: ConnectedUser) => void;
	onUserLeft?: (userId: string) => void;
	onTypingUpdate?: (users: TypingUser[]) => void;
	onAIThinking?: (isThinking: boolean) => void;
}

export function useWebSocket({
	discussionId,
	onNewMessage,
	onMessageEdited,
	onMessageDeleted,
	onUserJoined,
	onUserLeft,
	onTypingUpdate,
	onAIThinking,
}: UseWebSocketProps) {
	const { data: session } = useSession();
	const [isConnected, setIsConnected] = useState(false);
	const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
	const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
	const [connectionError, setConnectionError] = useState<string | null>(null);

	const wsRef = useRef<WebSocket | null>(null);
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	const [reconnectAttempts, setReconnectAttempts] = useState(0);
	const maxReconnectAttempts = 5;

	// Connect to WebSocket
	const connect = useCallback(() => {
		if (!session?.user?.id || !discussionId) {
			return;
		}

		try {
			const wsUrl = new URL("/ws", window.location.origin);
			wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
			wsUrl.searchParams.set("token", session.user.id); // Use user ID as token for now
			wsUrl.searchParams.set("discussionId", discussionId);
			wsUrl.searchParams.set("userId", session.user.id);
			wsUrl.searchParams.set("userName", session.user.name || "Anonymous");

			const ws = new WebSocket(wsUrl.toString());
			wsRef.current = ws;

			ws.onopen = () => {
				console.log("🔌 WebSocket connected");
				setIsConnected(true);
				setConnectionError(null);
				setReconnectAttempts(0);

				// Start heartbeat
				startHeartbeat();
			};

			ws.onmessage = (event) => {
				try {
					const message = JSON.parse(event.data);
					handleMessage(message);
				} catch (error) {
					console.error("Failed to parse WebSocket message:", error);
				}
			};

			ws.onclose = (event) => {
				console.log("🔌 WebSocket disconnected:", event.code, event.reason);
				setIsConnected(false);
				stopHeartbeat();

				// Attempt to reconnect unless it was a clean close
				if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
					const delay = Math.min(1000 * 2 ** reconnectAttempts, 30000);
					console.log(
						`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1})`,
					);

					reconnectTimeoutRef.current = setTimeout(() => {
						setReconnectAttempts((prev) => prev + 1);
						connect();
					}, delay);
				}
			};

			ws.onerror = (error) => {
				console.error("🔌 WebSocket error:", error);
				setConnectionError("Connection failed");
			};
		} catch (error) {
			console.error("Failed to create WebSocket connection:", error);
			setConnectionError("Failed to connect");
		}
	}, [session, discussionId, reconnectAttempts]);

	// Handle incoming messages
	const handleMessage = useCallback(
		(message: { type?: string; data?: unknown }) => {
			if (message.type === "message" && message.data) {
				const event = message.data as MessageEvent;

				switch (event.type) {
					case "new_message":
						onNewMessage?.(event);
						break;

					case "message_edited":
						onMessageEdited?.(event);
						break;

					case "message_deleted":
						onMessageDeleted?.(event);
						break;

					case "user_joined":
						if (event.data && 'user' in event.data && event.data.user) {
							const user = event.data.user as ConnectedUser;
							onUserJoined?.(user);
							setConnectedUsers((prev) => {
								const exists = prev.some((u) => u.id === user.id);
								return exists ? prev : [...prev, user];
							});
						}
						break;

					case "user_left":
						if (event.data && 'userId' in event.data && event.data.userId) {
							const userId = event.data.userId as string;
							onUserLeft?.(userId);
							setConnectedUsers((prev) =>
								prev.filter((u) => u.id !== userId),
							);
						}
						break;

					case "typing": {
						const users = (event.data && 'users' in event.data ? event.data.users : []) as TypingUser[];
						setTypingUsers(users);
						onTypingUpdate?.(users);
						break;
					}

					case "ai_thinking":
						const isThinking = event.data && 'isThinking' in event.data ? event.data.isThinking === true : false;
						onAIThinking?.(isThinking);
						break;
				}
			} else if (message.type === "pong") {
				// Heartbeat response - connection is alive
			}
		},
		[
			onNewMessage,
			onMessageEdited,
			onMessageDeleted,
			onUserJoined,
			onUserLeft,
			onTypingUpdate,
			onAIThinking,
		],
	);

	// Send message to WebSocket
	const sendMessage = useCallback(
		(message: Omit<WebSocketMessage, "timestamp">) => {
			if (wsRef.current?.readyState === WebSocket.OPEN) {
				wsRef.current.send(
					JSON.stringify({
						...message,
						timestamp: Date.now(),
					}),
				);
				return true;
			}
			return false;
		},
		[],
	);

	// Send typing indicator
	const sendTyping = useCallback(
		(isTyping: boolean) => {
			return sendMessage({
				type: "typing",
				discussionId,
				data: { isTyping },
			});
		},
		[sendMessage, discussionId],
	);

	// Start typing with auto-stop
	const startTyping = useCallback(() => {
		sendTyping(true);

		// Clear existing timeout
		if (typingTimeoutRef.current) {
			clearTimeout(typingTimeoutRef.current);
		}

		// Auto-stop typing after 3 seconds
		typingTimeoutRef.current = setTimeout(() => {
			sendTyping(false);
		}, 3000);
	}, [sendTyping]);

	// Stop typing
	const stopTyping = useCallback(() => {
		sendTyping(false);

		if (typingTimeoutRef.current) {
			clearTimeout(typingTimeoutRef.current);
			typingTimeoutRef.current = null;
		}
	}, [sendTyping]);

	// Start heartbeat ping
	const startHeartbeat = useCallback(() => {
		heartbeatIntervalRef.current = setInterval(() => {
			sendMessage({ type: "ping" });
		}, 30000); // Ping every 30 seconds
	}, [sendMessage]);

	// Stop heartbeat
	const stopHeartbeat = useCallback(() => {
		if (heartbeatIntervalRef.current) {
			clearInterval(heartbeatIntervalRef.current);
			heartbeatIntervalRef.current = null;
		}
	}, []);

	// Connect on mount and when dependencies change
	useEffect(() => {
		connect();

		return () => {
			// Cleanup on unmount
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}
			if (typingTimeoutRef.current) {
				clearTimeout(typingTimeoutRef.current);
			}
			stopHeartbeat();

			if (wsRef.current) {
				wsRef.current.close(1000, "Component unmounting");
			}
		};
	}, [connect, stopHeartbeat]);

	return {
		isConnected,
		connectionError,
		connectedUsers,
		typingUsers,
		sendMessage,
		startTyping,
		stopTyping,
		reconnect: connect,
	};
}
