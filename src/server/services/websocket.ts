import type { IncomingMessage } from "node:http";
import type { Server } from "node:http";
import { parse } from "node:url";
import { env } from "@/env";
import { verify } from "jsonwebtoken";
import { WebSocket, WebSocketServer } from "ws";

interface WebSocketMessage {
	type: "message" | "typing" | "join" | "leave" | "error" | "ping" | "pong";
	discussionId?: string;
	userId?: string;
	data?: Record<string, unknown>;
	timestamp: number;
}

interface MessageEvent {
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
	data: Record<string, unknown>;
	timestamp: number;
}

interface ConnectedUser {
	userId: string;
	userName: string;
	discussionId: string;
	ws: WebSocket;
	isAlive: boolean;
	lastActivity: number;
}

interface TypingUser {
	userId: string;
	userName: string;
	discussionId: string;
	timestamp: number;
}

export class WebSocketService {
	private wss: WebSocketServer | null = null;
	private connectedUsers = new Map<string, ConnectedUser>(); // websocket id -> user info
	private discussionUsers = new Map<string, Set<string>>(); // discussionId -> Set of websocket ids
	private typingUsers = new Map<string, Map<string, TypingUser>>(); // discussionId -> userId -> typing info
	private heartbeatInterval: NodeJS.Timeout | null = null;
	private typingCleanupInterval: NodeJS.Timeout | null = null;

	constructor(private server: Server) {}

	/**
	 * Initialize WebSocket server
	 */
	initialize(): void {
		if (this.wss) {
			return; // Already initialized
		}

		const wsPort = Number.parseInt(env.WS_PORT || "3002");

		this.wss = new WebSocketServer({
			server: this.server,
			path: "/ws",
			verifyClient: this.verifyClient.bind(this),
		});

		this.wss.on("connection", this.handleConnection.bind(this));
		this.startHeartbeat();
		this.startTypingCleanup();

		console.log(`🔌 WebSocket server initialized on port ${wsPort}`);
	}

	/**
	 * Verify client connection (authentication check)
	 */
	private verifyClient(info: {
		origin: string;
		secure: boolean;
		req: IncomingMessage;
	}): boolean {
		try {
			const url = parse(info.req.url || "", true);
			const token = url.query.token as string;

			if (!token) {
				console.warn("WebSocket connection rejected: No token provided");
				return false;
			}

			// Verify JWT token (basic auth check)
			// In production, you'd verify against your auth system
			const decoded = verify(token, env.AUTH_SECRET || "");

			if (!decoded) {
				console.warn("WebSocket connection rejected: Invalid token");
				return false;
			}

			return true;
		} catch (error) {
			console.warn("WebSocket connection verification failed:", error);
			return false;
		}
	}

	/**
	 * Handle new WebSocket connection
	 */
	private handleConnection(ws: WebSocket, req: IncomingMessage): void {
		const wsId = this.generateId();
		console.log(`🔌 New WebSocket connection: ${wsId}`);

		// Parse connection parameters
		const url = parse(req.url || "", true);
		const discussionId = url.query.discussionId as string;
		const userId = url.query.userId as string;
		const userName = (url.query.userName as string) || "Anonymous";

		if (!discussionId || !userId) {
			ws.close(1008, "Missing required parameters");
			return;
		}

		// Create user connection
		const user: ConnectedUser = {
			userId,
			userName,
			discussionId,
			ws,
			isAlive: true,
			lastActivity: Date.now(),
		};

		this.connectedUsers.set(wsId, user);

		// Add to discussion group
		if (!this.discussionUsers.has(discussionId)) {
			this.discussionUsers.set(discussionId, new Set());
		}
		this.discussionUsers.get(discussionId)?.add(wsId);

		// Set up event handlers
		ws.on("message", (data) => this.handleMessage(wsId, data.toString()));
		ws.on("close", () => this.handleDisconnect(wsId));
		ws.on("error", (error) => this.handleError(wsId, error));
		ws.on("pong", () => this.handlePong(wsId));

		// Send welcome message
		this.sendToClient(ws, {
			type: "message",
			data: { type: "connection_established", discussionId },
			timestamp: Date.now(),
		});

		// Notify other users that someone joined
		this.broadcastToDiscussion(
			discussionId,
			{
				type: "user_joined",
				discussionId,
				userId,
				data: {
					user: { id: userId, name: userName },
				},
				timestamp: Date.now(),
			},
			wsId,
		);
	}

	/**
	 * Handle incoming message from client
	 */
	private handleMessage(wsId: string, data: Buffer | string): void {
		try {
			const user = this.connectedUsers.get(wsId);
			if (!user) return;

			user.lastActivity = Date.now();
			user.isAlive = true;

			const message: WebSocketMessage = JSON.parse(data.toString());

			switch (message.type) {
				case "typing":
					this.handleTyping(wsId, message);
					break;

				case "message":
					this.handleChatMessage(wsId, message);
					break;

				case "join":
					this.handleJoinDiscussion(wsId, message);
					break;

				case "leave":
					this.handleLeaveDiscussion(wsId, message);
					break;

				case "ping":
					this.sendToClient(user.ws, {
						type: "pong",
						timestamp: Date.now(),
					});
					break;

				default:
					console.warn(`Unknown message type: ${message.type}`);
			}
		} catch (error) {
			console.error(`Error handling message from ${wsId}:`, error);
			this.sendError(wsId, "Invalid message format");
		}
	}

	/**
	 * Handle typing indicator
	 */
	private handleTyping(wsId: string, message: WebSocketMessage): void {
		const user = this.connectedUsers.get(wsId);
		if (!user || !message.discussionId) return;

		const { discussionId } = message;
		const isTyping = message.data?.isTyping === true;

		if (!this.typingUsers.has(discussionId)) {
			this.typingUsers.set(discussionId, new Map());
		}

		const discussionTyping = this.typingUsers.get(discussionId);
		if (!discussionTyping) return;

		if (isTyping) {
			discussionTyping.set(user.userId, {
				userId: user.userId,
				userName: user.userName,
				discussionId,
				timestamp: Date.now(),
			});
		} else {
			discussionTyping.delete(user.userId);
		}

		// Broadcast typing status to other users
		const typingUsers = Array.from(discussionTyping.values())
			.filter((t) => t.userId !== user.userId) // Exclude current user
			.map((t) => ({ id: t.userId, name: t.userName }));

		this.broadcastToDiscussion(
			discussionId,
			{
				type: "typing",
				discussionId,
				data: { users: typingUsers },
				timestamp: Date.now(),
			},
			wsId,
		);
	}

	/**
	 * Handle chat message broadcast
	 */
	private handleChatMessage(wsId: string, message: WebSocketMessage): void {
		const user = this.connectedUsers.get(wsId);
		if (!user || !message.discussionId) return;

		// Clear typing status when message is sent
		this.clearUserTyping(user.userId, message.discussionId);

		// The actual message creation should be handled by the tRPC router
		// This just broadcasts that a new message was created
		this.broadcastToDiscussion(message.discussionId, {
			type: "new_message",
			discussionId: message.discussionId,
			userId: user.userId,
			data: message.data || {},
			timestamp: Date.now(),
		});
	}

	/**
	 * Handle user joining a discussion
	 */
	private handleJoinDiscussion(wsId: string, message: WebSocketMessage): void {
		const user = this.connectedUsers.get(wsId);
		if (!user || !message.discussionId) return;

		// Update user's discussion
		user.discussionId = message.discussionId;

		// Add to new discussion group
		if (!this.discussionUsers.has(message.discussionId)) {
			this.discussionUsers.set(message.discussionId, new Set());
		}
		this.discussionUsers.get(message.discussionId)?.add(wsId);

		// Notify others
		this.broadcastToDiscussion(
			message.discussionId,
			{
				type: "user_joined",
				discussionId: message.discussionId,
				userId: user.userId,
				data: {
					user: { id: user.userId, name: user.userName },
				},
				timestamp: Date.now(),
			},
			wsId,
		);
	}

	/**
	 * Handle user leaving a discussion
	 */
	private handleLeaveDiscussion(wsId: string, message: WebSocketMessage): void {
		const user = this.connectedUsers.get(wsId);
		if (!user || !message.discussionId) return;

		// Remove from discussion group
		this.discussionUsers.get(message.discussionId)?.delete(wsId);

		// Clear typing status
		this.clearUserTyping(user.userId, message.discussionId);

		// Notify others
		this.broadcastToDiscussion(
			message.discussionId,
			{
				type: "user_left",
				discussionId: message.discussionId,
				userId: user.userId,
				data: { userId: user.userId },
				timestamp: Date.now(),
			},
			wsId,
		);
	}

	/**
	 * Handle client disconnect
	 */
	private handleDisconnect(wsId: string): void {
		const user = this.connectedUsers.get(wsId);
		if (!user) return;

		console.log(`🔌 WebSocket disconnected: ${wsId} (${user.userName})`);

		// Remove from discussion group
		this.discussionUsers.get(user.discussionId)?.delete(wsId);

		// Clear typing status
		this.clearUserTyping(user.userId, user.discussionId);

		// Remove from connected users
		this.connectedUsers.delete(wsId);

		// Notify others that user left
		this.broadcastToDiscussion(
			user.discussionId,
			{
				type: "user_left",
				discussionId: user.discussionId,
				userId: user.userId,
				data: { userId: user.userId },
				timestamp: Date.now(),
			},
			wsId,
		);
	}

	/**
	 * Handle WebSocket error
	 */
	private handleError(wsId: string, error: Error): void {
		console.error(`WebSocket error for ${wsId}:`, error);
		this.handleDisconnect(wsId);
	}

	/**
	 * Handle pong response (heartbeat)
	 */
	private handlePong(wsId: string): void {
		const user = this.connectedUsers.get(wsId);
		if (user) {
			user.isAlive = true;
			user.lastActivity = Date.now();
		}
	}

	/**
	 * Broadcast message to all users in a discussion
	 */
	public broadcastToDiscussion(
		discussionId: string,
		event: MessageEvent,
		excludeWsId?: string,
	): void {
		const wsIds = this.discussionUsers.get(discussionId);
		if (!wsIds) return;

		const message = {
			type: "message",
			data: event,
			timestamp: event.timestamp,
		};

		for (const wsId of wsIds) {
			if (wsId === excludeWsId) continue;

			const user = this.connectedUsers.get(wsId);
			if (user?.ws.readyState === WebSocket.OPEN) {
				this.sendToClient(user.ws, message);
			}
		}
	}

	/**
	 * Send message to specific user
	 */
	public sendToUser(
		userId: string,
		discussionId: string,
		event: MessageEvent,
	): void {
		for (const [wsId, user] of this.connectedUsers.entries()) {
			if (
				user.userId === userId &&
				user.discussionId === discussionId &&
				user.ws.readyState === WebSocket.OPEN
			) {
				this.sendToClient(user.ws, {
					type: "message",
					data: event,
					timestamp: event.timestamp,
				});
				break;
			}
		}
	}

	/**
	 * Get connected users for a discussion
	 */
	public getDiscussionUsers(
		discussionId: string,
	): Array<{ id: string; name: string }> {
		const wsIds = this.discussionUsers.get(discussionId);
		if (!wsIds) return [];

		const users: Array<{ id: string; name: string }> = [];
		for (const wsId of wsIds) {
			const user = this.connectedUsers.get(wsId);
			if (user) {
				users.push({ id: user.userId, name: user.userName });
			}
		}

		return users;
	}

	/**
	 * Get typing users for a discussion
	 */
	public getTypingUsers(
		discussionId: string,
	): Array<{ id: string; name: string }> {
		const typingMap = this.typingUsers.get(discussionId);
		if (!typingMap) return [];

		return Array.from(typingMap.values()).map((t) => ({
			id: t.userId,
			name: t.userName,
		}));
	}

	/**
	 * Send error message to client
	 */
	private sendError(wsId: string, error: string): void {
		const user = this.connectedUsers.get(wsId);
		if (user?.ws.readyState === WebSocket.OPEN) {
			this.sendToClient(user.ws, {
				type: "error",
				data: { error },
				timestamp: Date.now(),
			});
		}
	}

	/**
	 * Send message to specific WebSocket client
	 */
	private sendToClient(ws: WebSocket, message: Record<string, unknown>): void {
		if (ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(message));
		}
	}

	/**
	 * Clear typing status for a user
	 */
	private clearUserTyping(userId: string, discussionId: string): void {
		const discussionTyping = this.typingUsers.get(discussionId);
		if (discussionTyping?.has(userId)) {
			discussionTyping.delete(userId);

			// Broadcast updated typing status
			const typingUsers = Array.from(discussionTyping.values()).map((t) => ({
				id: t.userId,
				name: t.userName,
			}));

			this.broadcastToDiscussion(discussionId, {
				type: "typing",
				discussionId,
				data: { users: typingUsers },
				timestamp: Date.now(),
			});
		}
	}

	/**
	 * Start heartbeat to check connection health
	 */
	private startHeartbeat(): void {
		this.heartbeatInterval = setInterval(() => {
			for (const [wsId, user] of this.connectedUsers.entries()) {
				if (!user.isAlive) {
					console.log(`💔 Terminating dead connection: ${wsId}`);
					user.ws.terminate();
					this.handleDisconnect(wsId);
					continue;
				}

				user.isAlive = false;
				if (user.ws.readyState === WebSocket.OPEN) {
					user.ws.ping();
				}
			}
		}, 30000); // Check every 30 seconds
	}

	/**
	 * Clean up old typing indicators
	 */
	private startTypingCleanup(): void {
		this.typingCleanupInterval = setInterval(() => {
			const now = Date.now();
			const timeout = 3000; // 3 seconds

			for (const [discussionId, typingMap] of this.typingUsers.entries()) {
				let changed = false;
				for (const [userId, typing] of typingMap.entries()) {
					if (now - typing.timestamp > timeout) {
						typingMap.delete(userId);
						changed = true;
					}
				}

				if (changed) {
					const typingUsers = Array.from(typingMap.values()).map((t) => ({
						id: t.userId,
						name: t.userName,
					}));

					this.broadcastToDiscussion(discussionId, {
						type: "typing",
						discussionId,
						data: { users: typingUsers },
						timestamp: now,
					});
				}
			}
		}, 1000); // Check every second
	}

	/**
	 * Generate unique ID for WebSocket connections
	 */
	private generateId(): string {
		return (
			Math.random().toString(36).substring(2, 15) +
			Math.random().toString(36).substring(2, 15)
		);
	}

	/**
	 * Shutdown WebSocket server gracefully
	 */
	shutdown(): void {
		console.log("🔌 Shutting down WebSocket server...");

		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
		}

		if (this.typingCleanupInterval) {
			clearInterval(this.typingCleanupInterval);
		}

		// Close all connections
		for (const [wsId, user] of this.connectedUsers.entries()) {
			user.ws.close(1001, "Server shutting down");
		}

		if (this.wss) {
			this.wss.close(() => {
				console.log("🔌 WebSocket server closed");
			});
		}

		this.connectedUsers.clear();
		this.discussionUsers.clear();
		this.typingUsers.clear();
	}
}

// Export singleton instance
let wsService: WebSocketService | null = null;

function initializeWebSocketService(server: Server): WebSocketService {
	if (!wsService) {
		wsService = new WebSocketService(server);
		wsService.initialize();
	}
	return wsService;
}

export function getWebSocketService(): WebSocketService | null {
	return wsService;
}
