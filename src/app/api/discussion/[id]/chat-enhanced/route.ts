/**
 * Enhanced Vercel AI SDK Compatible Chat API Endpoint
 *
 * This endpoint provides full AI SDK useChat hook compatibility with:
 * - Proper streaming protocol support
 * - Message metadata
 * - Error handling
 * - Multi-participant WebSocket broadcasting
 */

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { getWebSocketService } from "@/server/services/websocket";
import type { MessageSenderType } from "@prisma/client";
import type { NextRequest } from "next/server";
import { z } from "zod";

// ==================== Types & Schemas ====================

const chatRequestSchema = z.object({
	messages: z.array(
		z.object({
			id: z.string(),
			role: z.enum(["user", "assistant", "system"]),
			parts: z.array(
				z.object({
					type: z.literal("text"),
					text: z.string(),
				}),
			),
			metadata: z.any().optional(),
		}),
	),
	// Direct fields for participant authentication
	participantId: z.string(),
	discussionId: z.string(),
	sessionId: z.string(),
});

// ==================== Helper Functions ====================

async function authenticateParticipant(
	discussionId: string,
	participantId: string,
	sessionId: string,
): Promise<{
	type: "user" | "participant";
	userId?: string;
	participantId?: string;
	displayName: string;
	senderType: MessageSenderType;
}> {
	// Try session authentication first (for logged-in users)
	const session = await auth();
	if (session?.user) {
		const participant = await db.discussionParticipant.findFirst({
			where: {
				discussionId,
				userId: session.user.id,
				status: "ACTIVE",
			},
			include: {
				user: {
					select: { name: true },
				},
			},
		});

		if (participant) {
			return {
				type: "user",
				userId: session.user.id,
				displayName: participant.user.name || "User",
				senderType: "USER",
			};
		}
	}

	// Try anonymous participant lookup
	if (participantId && sessionId) {
		const participant = await db.participant.findUnique({
			where: { id: participantId },
		});

		if (
			participant &&
			participant.discussionId === discussionId &&
			!participant.leftAt
		) {
			// Validate session ID matches
			if (participant.sessionId === sessionId) {
				return {
					type: "participant",
					participantId: participant.id,
					displayName: participant.displayName,
					senderType: "PARTICIPANT",
				};
			}
			throw new Error("Session mismatch");
		}

		// For testing: create anonymous participant if doesn't exist
		if (!participant && participantId.startsWith("part_")) {
			const newParticipant = await db.participant.create({
				data: {
					id: participantId,
					discussionId,
					displayName: "Test Participant",
					sessionId,
					joinedAt: new Date(),
				},
			});

			return {
				type: "participant",
				participantId: newParticipant.id,
				displayName: newParticipant.displayName,
				senderType: "PARTICIPANT",
			};
		}

		if (!participant) {
			throw new Error("Invalid participant ID");
		}
	}

	throw new Error("Authentication required");
}

async function verifyDiscussion(discussionId: string): Promise<void> {
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

async function createMessage(
	discussionId: string,
	content: string,
	auth: {
		type: "user" | "participant";
		userId?: string;
		participantId?: string;
		displayName: string;
		senderType: MessageSenderType;
	},
): Promise<{
	id: string;
	content: string;
	senderName: string;
	senderType: string;
	createdAt: string;
}> {
	// Create message in database
	const message = await db.message.create({
		data: {
			discussionId,
			content,
			authorId: auth.userId || null,
			participantId: auth.participantId || null,
			senderName: auth.displayName,
			senderType: auth.senderType,
			type: "USER",
		},
	});

	// Update participant activity tracking
	if (auth.type === "user" && auth.userId) {
		await db.discussionParticipant.updateMany({
			where: {
				discussionId,
				userId: auth.userId,
				status: "ACTIVE",
			},
			data: {
				messageCount: { increment: 1 },
				lastSeenAt: new Date(),
			},
		});
	}

	// Broadcast message to WebSocket clients
	const wsService = getWebSocketService();
	if (wsService) {
		wsService.broadcastToDiscussion(discussionId, {
			type: "new_message",
			discussionId,
			data: {
				id: message.id,
				content: message.content,
				senderName: auth.displayName,
				senderType: auth.senderType.toLowerCase(),
				createdAt: message.createdAt.toISOString(),
				authorId: message.authorId,
				participantId: message.participantId,
				type: message.type,
			},
			timestamp: Date.now(),
		});
	}

	return {
		id: message.id,
		content: message.content,
		senderName: auth.displayName,
		senderType: auth.senderType.toLowerCase(),
		createdAt: message.createdAt.toISOString(),
	};
}

/**
 * Generate streaming response compatible with Vercel AI SDK
 */
function createStreamingResponse(
	message: {
		id: string;
		content: string;
		senderName: string;
		senderType: string;
		createdAt: string;
		originalId?: string;
	},
	discussionId: string,
): Response {
	const encoder = new TextEncoder();

	// Use original message ID from client for AI SDK compatibility
	const responseId = message.originalId || message.id;

	// AI SDK expects this specific format for streaming responses
	const messageData = {
		type: "message",
		id: responseId,
		role: "user",
		parts: [
			{
				type: "text",
				text: message.content,
			},
		],
		metadata: {
			messageId: message.id, // Keep database ID for internal tracking
			senderName: message.senderName,
			senderType: message.senderType,
			createdAt: message.createdAt,
		},
	};

	// Broadcast notification for other participants
	const broadcastData = {
		type: "participant_message_broadcast",
		discussionId,
		data: {
			messageId: message.id,
			content: message.content,
			senderName: message.senderName,
			senderType: message.senderType,
			timestamp: message.createdAt,
		},
	};

	const readable = new ReadableStream({
		start(controller) {
			// Send the message data (AI SDK format)
			controller.enqueue(encoder.encode(`0:${JSON.stringify(messageData)}\n`));
			// Send broadcast notification
			controller.enqueue(
				encoder.encode(`1:${JSON.stringify(broadcastData)}\n`),
			);
			controller.close();
		},
	});

	return new Response(readable, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Transfer-Encoding": "chunked",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		},
	});
}

// ==================== API Handler ====================

export async function POST(
	request: NextRequest,
	context: { params: Promise<{ id: string }> },
) {
	const params = await context.params;
	const discussionId = params.id;

	try {
		// Validate Content-Type
		const contentType = request.headers.get("Content-Type");
		if (!contentType?.includes("application/json")) {
			return new Response(
				JSON.stringify({ error: "Content-Type must be application/json" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Parse request body
		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return new Response(
				JSON.stringify({ error: "Invalid JSON in request body" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		const {
			messages,
			participantId,
			discussionId: requestDiscussionId,
			sessionId,
		} = chatRequestSchema.parse(body);

		// Verify discussion ID matches
		if (requestDiscussionId !== discussionId) {
			return new Response(JSON.stringify({ error: "Discussion ID mismatch" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Verify discussion is active
		await verifyDiscussion(discussionId);

		// Get the last user message
		const lastMessage = messages.filter((m) => m.role === "user").pop();
		if (!lastMessage?.parts?.[0]?.text?.trim()) {
			return new Response(
				JSON.stringify({ error: "Message content is required" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Validate message length
		const messageText = lastMessage.parts[0].text.trim();
		if (messageText.length > 5000) {
			return new Response(
				JSON.stringify({
					error: "Message content exceeds 5000 character limit",
				}),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Authenticate participant
		const auth = await authenticateParticipant(
			discussionId,
			participantId,
			sessionId,
		);

		// Create message and broadcast
		const savedMessage = await createMessage(discussionId, messageText, auth);

		// Return AI SDK compatible streaming response with original message ID
		return createStreamingResponse(
			{
				...savedMessage,
				originalId: lastMessage.id,
			},
			discussionId,
		);
	} catch (error) {
		console.error("Enhanced Chat API error:", error);

		if (error instanceof z.ZodError) {
			return new Response(
				JSON.stringify({
					error: "Invalid request data",
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
					? 403
					: error.message.includes("Session mismatch")
						? 403
						: error.message.includes("Invalid participant")
							? 400
							: error.message.includes("Authentication")
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
			"Access-Control-Allow-Methods": "POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		},
	});
}
