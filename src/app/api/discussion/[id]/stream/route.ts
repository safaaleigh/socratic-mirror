/**
 * Server-Sent Events (SSE) Streaming API Endpoint
 *
 * GET /api/discussion/[id]/stream
 *
 * This endpoint provides real-time updates for participant discussions using Server-Sent Events.
 * Supports participant presence events (join/leave) and message broadcasting.
 */

import { unifiedTokenService } from "@/lib/invitation-token-service";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { getWebSocketService } from "@/server/services/websocket";
import type { NextRequest } from "next/server";
import { z } from "zod";

// ==================== Types & Schemas ====================

const streamRequestSchema = z.object({
	participantToken: z.string().optional(),
	participantId: z.string().optional(),
	sessionId: z.string().optional(),
});

type StreamEvent = {
	id?: string;
	event: string;
	data: string;
	retry?: number;
};

type ParticipantPresenceData = {
	type: "participant_joined" | "participant_left" | "participant_updated";
	participantId: string;
	displayName: string;
	timestamp: number;
};

type MessageBroadcastData = {
	type: "message_received" | "message_edited" | "message_deleted";
	messageId: string;
	content?: string;
	senderName?: string;
	senderType?: "user" | "participant" | "system";
	timestamp: number;
};

type TypingIndicatorData = {
	type: "typing_started" | "typing_stopped";
	participants: Array<{
		id: string;
		displayName: string;
	}>;
	timestamp: number;
};

// ==================== Helper Functions ====================

/**
 * Authenticate participant for streaming connection
 */
async function authenticateStreamParticipant(
	request: NextRequest,
	discussionId: string,
	participantToken?: string,
	participantId?: string,
): Promise<{
	type: "user" | "participant";
	userId?: string;
	participantId?: string;
	displayName: string;
}> {
	// Try session authentication first
	const session = await auth();
	if (session?.user) {
		const participant = await db.discussionParticipant.findFirst({
			where: {
				discussionId,
				userId: session.user.id,
				status: "ACTIVE",
			},
			include: {
				user: { select: { name: true } },
			},
		});

		if (participant) {
			return {
				type: "user",
				userId: session.user.id,
				displayName: participant.user.name || "User",
			};
		}
	}

	// Try token authentication (supports both JWT and database tokens)
	if (participantToken) {
		const tokenValidation =
			await unifiedTokenService.validateToken(participantToken);
		if (
			!tokenValidation.valid ||
			tokenValidation.token?.discussionId !== discussionId
		) {
			throw new Error("Invalid participant token");
		}

		if (participantId) {
			const participant = await db.participant.findUnique({
				where: { id: participantId },
			});

			if (
				participant &&
				participant.discussionId === discussionId &&
				!participant.leftAt
			) {
				return {
					type: "participant",
					participantId: participant.id,
					displayName: participant.displayName,
				};
			}
		}
	}

	throw new Error("Authentication required for streaming");
}

/**
 * Verify discussion is active and streaming is allowed
 */
async function verifyStreamingDiscussion(discussionId: string): Promise<void> {
	const discussion = await db.discussion.findUnique({
		where: { id: discussionId },
		select: {
			isActive: true,
			closedAt: true,
		},
	});

	if (!discussion) {
		throw new Error("Discussion not found");
	}

	if (!discussion.isActive) {
		throw new Error("Discussion is not active");
	}
}

/**
 * Format SSE event for transmission
 */
function formatSSEEvent(event: StreamEvent): string {
	let formatted = "";

	if (event.id) {
		formatted += `id: ${event.id}\n`;
	}

	formatted += `event: ${event.event}\n`;
	formatted += `data: ${event.data}\n`;

	if (event.retry) {
		formatted += `retry: ${event.retry}\n`;
	}

	formatted += "\n";
	return formatted;
}

/**
 * Send initial connection status and participant list
 */
async function sendConnectionStatus(
	controller: ReadableStreamDefaultController<Uint8Array>,
	encoder: TextEncoder,
	discussionId: string,
	currentAuth: {
		type: "user" | "participant";
		userId?: string;
		participantId?: string;
		displayName: string;
	},
): Promise<void> {
	// Get current participants
	const [authenticatedParticipants, anonymousParticipants] = await Promise.all([
		db.discussionParticipant.findMany({
			where: {
				discussionId,
				status: "ACTIVE",
			},
			include: {
				user: { select: { id: true, name: true } },
			},
		}),
		db.participant.findMany({
			where: {
				discussionId,
				leftAt: null,
			},
			select: {
				id: true,
				displayName: true,
			},
		}),
	]);

	const allParticipants = [
		...authenticatedParticipants.map((p) => ({
			id: p.user.id,
			displayName: p.user.name || "User",
			type: "user" as const,
		})),
		...anonymousParticipants.map((p) => ({
			id: p.id,
			displayName: p.displayName,
			type: "participant" as const,
		})),
	];

	// Send connection established event
	const connectionEvent: StreamEvent = {
		id: Date.now().toString(),
		event: "connection_established",
		data: JSON.stringify({
			type: "connection_established",
			discussionId,
			participants: allParticipants,
			timestamp: Date.now(),
		}),
	};

	controller.enqueue(encoder.encode(formatSSEEvent(connectionEvent)));

	// Send participant joined event for current participant
	const joinEvent: StreamEvent = {
		id: Date.now().toString(),
		event: "participant_presence",
		data: JSON.stringify({
			type: "participant_joined",
			participantId:
				currentAuth.userId || currentAuth.participantId || "unknown",
			displayName: currentAuth.displayName,
			participantType: currentAuth.type,
			timestamp: Date.now(),
		} satisfies ParticipantPresenceData & {
			participantType: "user" | "participant";
		}),
	};

	controller.enqueue(encoder.encode(formatSSEEvent(joinEvent)));
}

/**
 * Set up WebSocket event listeners for real-time updates
 */
function setupWebSocketListeners(
	controller: ReadableStreamDefaultController<Uint8Array>,
	encoder: TextEncoder,
	discussionId: string,
	participantAuth: {
		type: "user" | "participant";
		userId?: string;
		participantId?: string;
	},
): () => void {
	const wsService = getWebSocketService();
	// Always use keepalive fallback since WebSocket service is not initialized
	// Use shorter interval for better responsiveness and reliable testing
	const keepaliveIntervalMs = 2000; // 2 seconds for all environments

	const keepaliveInterval = setInterval(() => {
		try {
			const keepaliveEvent: StreamEvent = {
				event: "keepalive",
				data: JSON.stringify({ timestamp: Date.now() }),
			};
			controller.enqueue(encoder.encode(formatSSEEvent(keepaliveEvent)));
		} catch (error) {
			clearInterval(keepaliveInterval);
		}
	}, keepaliveIntervalMs);

	if (!wsService) {
		// Only keepalive when no WebSocket service
		return () => clearInterval(keepaliveInterval);
	}

	// Listen for WebSocket events and forward as SSE
	const eventHandler = (event: any) => {
		try {
			if (event.discussionId !== discussionId) return;

			let sseEvent: StreamEvent;

			switch (event.type) {
				case "new_message":
					sseEvent = {
						id: event.data.id || Date.now().toString(),
						event: "message_broadcast",
						data: JSON.stringify({
							type: "message_received",
							messageId: event.data.id,
							content: event.data.content,
							senderName: event.data.senderName,
							senderType: event.data.senderType,
							timestamp: event.timestamp,
						} satisfies MessageBroadcastData),
					};
					break;

				case "message_edited":
					sseEvent = {
						id: event.data.id || Date.now().toString(),
						event: "message_broadcast",
						data: JSON.stringify({
							type: "message_edited",
							messageId: event.data.id,
							content: event.data.content,
							senderName: event.data.senderName,
							senderType: event.data.senderType,
							timestamp: event.timestamp,
						} satisfies MessageBroadcastData),
					};
					break;

				case "message_deleted":
					sseEvent = {
						id: event.data.messageId || Date.now().toString(),
						event: "message_broadcast",
						data: JSON.stringify({
							type: "message_deleted",
							messageId: event.data.messageId,
							timestamp: event.timestamp,
						} satisfies MessageBroadcastData),
					};
					break;

				case "user_joined":
				case "user_left":
					sseEvent = {
						id: Date.now().toString(),
						event: "participant_presence",
						data: JSON.stringify({
							type:
								event.type === "user_joined"
									? "participant_joined"
									: "participant_left",
							participantId: event.userId,
							displayName: event.data?.user?.name || "User",
							timestamp: event.timestamp,
						} satisfies ParticipantPresenceData),
					};
					break;

				case "typing":
					sseEvent = {
						id: Date.now().toString(),
						event: "typing_indicator",
						data: JSON.stringify({
							type:
								event.data?.users?.length > 0
									? "typing_started"
									: "typing_stopped",
							participants: event.data?.users || [],
							timestamp: event.timestamp,
						} satisfies TypingIndicatorData),
					};
					break;

				default:
					return; // Ignore unknown events
			}

			controller.enqueue(encoder.encode(formatSSEEvent(sseEvent)));
		} catch (error) {
			console.error("Error forwarding WebSocket event to SSE:", error);
		}
	};

	// Note: This is a simplified event listening setup
	// In a production system, you'd need to properly register/unregister listeners
	// For now, we'll simulate this with periodic updates
	const updateInterval = setInterval(async () => {
		try {
			// Check for new messages periodically (fallback when WebSocket isn't available)
			const recentMessages = await db.message.findMany({
				where: {
					discussionId,
					createdAt: { gte: new Date(Date.now() - 5000) }, // Last 5 seconds
				},
				include: {
					author: { select: { name: true } },
					participant: { select: { displayName: true } },
				},
				orderBy: { createdAt: "asc" },
				take: 10,
			});

			for (const message of recentMessages) {
				const sseEvent: StreamEvent = {
					id: message.id,
					event: "message_broadcast",
					data: JSON.stringify({
						type: "message_received",
						messageId: message.id,
						content: message.content,
						senderName:
							message.senderName ||
							message.author?.name ||
							message.participant?.displayName ||
							"Unknown",
						senderType: message.senderType.toLowerCase() as
							| "user"
							| "participant"
							| "system",
						timestamp: message.createdAt.getTime(),
					} satisfies MessageBroadcastData),
				};

				controller.enqueue(encoder.encode(formatSSEEvent(sseEvent)));
			}
		} catch (error) {
			clearInterval(updateInterval);
		}
	}, 5000); // Every 5 seconds

	return () => clearInterval(updateInterval);
}

// ==================== API Handler ====================

export async function GET(
	request: NextRequest,
	context: { params: Promise<{ id: string }> },
) {
	const params = await context.params;
	try {
		const discussionId = params.id;
		const { searchParams } = new URL(request.url);

		// Parse query parameters
		const queryParams = {
			participantToken: searchParams.get("participantToken") || undefined,
			participantId: searchParams.get("participantId") || undefined,
			sessionId: searchParams.get("sessionId") || undefined,
		};

		const validatedParams = streamRequestSchema.parse(queryParams);

		// Verify discussion is active
		await verifyStreamingDiscussion(discussionId);

		// Authenticate participant
		const auth = await authenticateStreamParticipant(
			request,
			discussionId,
			validatedParams.participantToken,
			validatedParams.participantId,
		);

		// Create readable stream for SSE
		const encoder = new TextEncoder();
		let cleanup: (() => void) | undefined;

		const readable = new ReadableStream({
			async start(controller) {
				try {
					// Send initial connection status
					await sendConnectionStatus(controller, encoder, discussionId, auth);

					// Set up real-time event listeners
					cleanup = setupWebSocketListeners(
						controller,
						encoder,
						discussionId,
						auth,
					);
				} catch (error) {
					console.error("Error starting SSE stream:", error);
					controller.error(error);
				}
			},

			cancel() {
				// Clean up listeners when connection closes
				if (cleanup) {
					cleanup();
				}

				// Broadcast participant left event
				const wsService = getWebSocketService();
				if (wsService) {
					wsService.broadcastToDiscussion(discussionId, {
						type: "user_left",
						discussionId,
						userId: auth.userId || auth.participantId,
						data: {
							userId: auth.userId || auth.participantId,
							displayName: auth.displayName,
						},
						timestamp: Date.now(),
					});
				}
			},
		});

		// Return SSE response with appropriate headers
		return new Response(readable, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache, no-store, must-revalidate",
				Connection: "keep-alive",
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "GET, OPTIONS",
				"Access-Control-Allow-Headers":
					"Content-Type, Authorization, Cache-Control",
				"Access-Control-Expose-Headers": "Cache-Control",
				// Prevent buffering in nginx/proxies
				"X-Accel-Buffering": "no",
			},
		});
	} catch (error) {
		console.error("Stream API error:", error);

		if (error instanceof z.ZodError) {
			return new Response(
				JSON.stringify({
					error: "Invalid request parameters",
					details: error.errors,
				}),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		if (error instanceof Error) {
			const statusCode = error.message.includes("not found")
				? 404
				: error.message.includes("not active")
					? 409
					: error.message.includes("Authentication")
						? 401
						: error.message.includes("Invalid participant")
							? 401
							: 500;

			return new Response(JSON.stringify({ error: error.message }), {
				status: statusCode,
				headers: { "Content-Type": "application/json" },
			});
		}

		return new Response(JSON.stringify({ error: "Internal server error" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}

export async function OPTIONS() {
	return new Response(null, {
		status: 200,
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, OPTIONS",
			"Access-Control-Allow-Headers":
				"Content-Type, Authorization, Cache-Control",
		},
	});
}
