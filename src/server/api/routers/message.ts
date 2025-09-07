import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { aiService } from "@/server/services/ai-facilitator";
import { getWebSocketService } from "@/server/services/websocket";
import type { MessageType } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

// Contract-compliant validation schemas
const sendMessageSchema = z.object({
	discussionId: z.string().cuid(),
	content: z.string().min(1).max(5000),
	parentId: z.string().cuid().optional(),
	type: z.enum(["USER", "MODERATOR"]).default("USER"),
});

const editMessageSchema = z.object({
	messageId: z.string().cuid(),
	content: z.string().min(1).max(5000),
});

const getMessagesSchema = z.object({
	discussionId: z.string().cuid(),
	limit: z.number().int().min(1).max(100).default(50),
	cursor: z.string().optional(),
	parentId: z.string().cuid().optional(),
});

const reactToMessageSchema = z.object({
	messageId: z.string().cuid(),
	reaction: z.enum(["👍", "👎", "❤️", "🤔", "💡", "🎯"]),
});

const typingIndicatorSchema = z.object({
	discussionId: z.string().cuid(),
	isTyping: z.boolean(),
});

const getAIResponseSchema = z.object({
	discussionId: z.string().cuid(),
	context: z.string().optional(),
	replyToId: z.string().cuid().optional(),
});

// Helper functions
function formatMessageOutput(message: any) {
	return {
		id: message.id,
		discussionId: message.discussionId,
		authorId: message.authorId,
		author: message.author,
		content: message.content,
		type: message.type,
		parentId: message.parentId,
		parent: message.parent
			? {
					id: message.parent.id,
					content: message.parent.content,
					authorName: message.parent.author?.name || null,
				}
			: null,
		isEdited: !!message.editedAt,
		editedAt: message.editedAt,
		createdAt: message.createdAt,
		replyCount: message._count?.replies || 0,
		reactions: message.reactions || {},
	};
}

async function checkParticipantPermission(
	db: any,
	userId: string,
	discussionId: string,
) {
	const participant = await db.discussionParticipant.findFirst({
		where: {
			discussionId,
			userId,
			status: "ACTIVE",
		},
	});

	if (!participant) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You must be an active participant to access messages",
		});
	}

	return participant;
}

export const messageRouter = createTRPCRouter({
	// Send a new message
	send: protectedProcedure
		.input(sendMessageSchema)
		.mutation(async ({ ctx, input }) => {
			// Check if user is an active participant
			const participant = await checkParticipantPermission(
				ctx.db,
				ctx.session.user.id,
				input.discussionId,
			);

			// Check if discussion is active
			const discussion = await ctx.db.discussion.findUnique({
				where: { id: input.discussionId },
				select: { isActive: true },
			});

			if (!discussion?.isActive) {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "Discussion is not active",
				});
			}

			// Validate message type based on user role
			let messageType: MessageType = "USER";
			if (input.type === "MODERATOR") {
				if (!["CREATOR", "MODERATOR"].includes(participant.role)) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "Only creators and moderators can send moderator messages",
					});
				}
				messageType = "MODERATOR";
			}

			// Validate parent message if provided
			if (input.parentId) {
				const parentMessage = await ctx.db.message.findUnique({
					where: { id: input.parentId },
					select: { discussionId: true },
				});

				if (
					!parentMessage ||
					parentMessage.discussionId !== input.discussionId
				) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Invalid parent message",
					});
				}
			}

			// Create the message
			const message = await ctx.db.message.create({
				data: {
					discussionId: input.discussionId,
					authorId: ctx.session.user.id,
					content: input.content,
					parentId: input.parentId,
					type: messageType,
				},
				include: {
					author: {
						select: {
							id: true,
							name: true,
							email: true,
							image: true,
						},
					},
					parent: {
						select: {
							id: true,
							content: true,
							author: {
								select: { name: true },
							},
						},
					},
					_count: {
						select: { replies: true },
					},
				},
			});

			// Update participant's message count and last seen
			await ctx.db.discussionParticipant.update({
				where: { id: participant.id },
				data: {
					messageCount: { increment: 1 },
					lastSeenAt: new Date(),
				},
			});

			// Broadcast to WebSocket if available
			const wsService = getWebSocketService();
			if (wsService) {
				wsService.broadcastToDiscussion(input.discussionId, {
					type: "new_message",
					discussionId: input.discussionId,
					data: formatMessageOutput(message),
					timestamp: Date.now(),
				});
			}

			return formatMessageOutput(message);
		}),

	// Edit an existing message (author only)
	edit: protectedProcedure
		.input(editMessageSchema)
		.mutation(async ({ ctx, input }) => {
			// Get the message
			const message = await ctx.db.message.findUnique({
				where: { id: input.messageId },
				select: {
					id: true,
					authorId: true,
					discussionId: true,
					type: true,
				},
			});

			if (!message) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Message not found",
				});
			}

			// Check if user is the author
			if (message.authorId !== ctx.session.user.id) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You can only edit your own messages",
				});
			}

			// Check if user is still an active participant
			await checkParticipantPermission(
				ctx.db,
				ctx.session.user.id,
				message.discussionId,
			);

			// Can't edit system messages
			if (["SYSTEM", "AI_QUESTION", "AI_PROMPT"].includes(message.type)) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Cannot edit system or AI messages",
				});
			}

			// Update the message
			const updatedMessage = await ctx.db.message.update({
				where: { id: input.messageId },
				data: {
					content: input.content,
					editedAt: new Date(),
				},
				include: {
					author: {
						select: {
							id: true,
							name: true,
							email: true,
							image: true,
						},
					},
					parent: {
						select: {
							id: true,
							content: true,
							author: {
								select: { name: true },
							},
						},
					},
					_count: {
						select: { replies: true },
					},
				},
			});

			// Broadcast to WebSocket if available
			const wsService = getWebSocketService();
			if (wsService) {
				wsService.broadcastToDiscussion(message.discussionId, {
					type: "message_edited",
					discussionId: message.discussionId,
					data: formatMessageOutput(updatedMessage),
					timestamp: Date.now(),
				});
			}

			return formatMessageOutput(updatedMessage);
		}),

	// Delete a message (author or moderator)
	delete: protectedProcedure
		.input(z.object({ messageId: z.string().cuid() }))
		.mutation(async ({ ctx, input }) => {
			// Get the message
			const message = await ctx.db.message.findUnique({
				where: { id: input.messageId },
				select: {
					id: true,
					authorId: true,
					discussionId: true,
					type: true,
				},
			});

			if (!message) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Message not found",
				});
			}

			// Check if user is an active participant
			const participant = await checkParticipantPermission(
				ctx.db,
				ctx.session.user.id,
				message.discussionId,
			);

			// Check permissions - author or moderator/creator can delete
			const isAuthor = message.authorId === ctx.session.user.id;
			const isModerator = ["CREATOR", "MODERATOR"].includes(participant.role);

			if (!isAuthor && !isModerator) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You can only delete your own messages or as a moderator",
				});
			}

			// Can't delete system messages
			if (["SYSTEM"].includes(message.type)) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Cannot delete system messages",
				});
			}

			// Delete the message (this will cascade to replies if needed)
			await ctx.db.message.delete({
				where: { id: input.messageId },
			});

			// Update participant's message count if they're the author
			if (isAuthor) {
				await ctx.db.discussionParticipant.update({
					where: { id: participant.id },
					data: {
						messageCount: { decrement: 1 },
					},
				});
			}

			// Broadcast to WebSocket if available
			const wsService = getWebSocketService();
			if (wsService) {
				wsService.broadcastToDiscussion(message.discussionId, {
					type: "message_deleted",
					discussionId: message.discussionId,
					data: { messageId: input.messageId },
					timestamp: Date.now(),
				});
			}

			return { success: true };
		}),

	// Get messages for a discussion
	list: protectedProcedure
		.input(getMessagesSchema)
		.query(async ({ ctx, input }) => {
			// Check if user is an active participant
			const participant = await checkParticipantPermission(
				ctx.db,
				ctx.session.user.id,
				input.discussionId,
			);

			// Update last seen
			await ctx.db.discussionParticipant.update({
				where: { id: participant.id },
				data: { lastSeenAt: new Date() },
			});

			const where: any = {
				discussionId: input.discussionId,
				...(input.parentId !== undefined && { parentId: input.parentId }),
				...(input.cursor && { id: { lt: input.cursor } }),
			};

			const messages = await ctx.db.message.findMany({
				where,
				take: input.limit + 1, // Take one extra to check if there are more
				orderBy: { createdAt: "desc" },
				include: {
					author: {
						select: {
							id: true,
							name: true,
							email: true,
							image: true,
						},
					},
					parent: {
						select: {
							id: true,
							content: true,
							author: {
								select: { name: true },
							},
						},
					},
					_count: {
						select: { replies: true },
					},
				},
			});

			let hasMore = false;
			if (messages.length > input.limit) {
				messages.pop();
				hasMore = true;
			}

			return {
				messages: messages.map(formatMessageOutput),
				nextCursor: messages[messages.length - 1]?.id,
				hasMore,
			};
		}),

	// Mark message as seen
	markAsSeen: protectedProcedure
		.input(
			z.object({
				discussionId: z.string().cuid(),
				messageId: z.string().cuid(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Check if user is an active participant
			const participant = await checkParticipantPermission(
				ctx.db,
				ctx.session.user.id,
				input.discussionId,
			);

			// Verify message belongs to discussion
			const message = await ctx.db.message.findUnique({
				where: { id: input.messageId },
				select: { discussionId: true },
			});

			if (!message || message.discussionId !== input.discussionId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Message not found in this discussion",
				});
			}

			// Update last seen
			await ctx.db.discussionParticipant.update({
				where: { id: participant.id },
				data: { lastSeenAt: new Date() },
			});

			return { success: true };
		}),

	// React to a message
	react: protectedProcedure
		.input(reactToMessageSchema)
		.mutation(async ({ ctx, input }) => {
			// Get the message
			const message = await ctx.db.message.findUnique({
				where: { id: input.messageId },
				select: { discussionId: true, reactions: true },
			});

			if (!message) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Message not found",
				});
			}

			// Check if user is an active participant
			await checkParticipantPermission(
				ctx.db,
				ctx.session.user.id,
				message.discussionId,
			);

			// Update reactions
			const reactions = (message.reactions as Record<string, number>) || {};
			const currentCount = reactions[input.reaction] || 0;

			// Toggle reaction (add if not present, remove if present)
			if (currentCount > 0) {
				// For simplicity, just decrement (in real app, track individual user reactions)
				reactions[input.reaction] = Math.max(0, currentCount - 1);
			} else {
				reactions[input.reaction] = currentCount + 1;
			}

			// Remove empty reactions
			if (reactions[input.reaction] === 0) {
				delete reactions[input.reaction];
			}

			await ctx.db.message.update({
				where: { id: input.messageId },
				data: { reactions },
			});

			return { reactions };
		}),

	// Update typing indicator
	setTyping: protectedProcedure
		.input(typingIndicatorSchema)
		.mutation(async ({ ctx, input }) => {
			// Check if user is an active participant
			await checkParticipantPermission(
				ctx.db,
				ctx.session.user.id,
				input.discussionId,
			);

			// Send typing indicator via WebSocket if available
			const wsService = getWebSocketService();
			if (wsService) {
				wsService.broadcastToDiscussion(input.discussionId, {
					type: "typing",
					discussionId: input.discussionId,
					data: {
						users: input.isTyping
							? [
									{
										id: ctx.session.user.id,
										name: ctx.session.user.name,
									},
								]
							: [],
					},
					timestamp: Date.now(),
				});
			}

			return { success: true };
		}),

	// Get AI response for discussion context
	getAIResponse: protectedProcedure
		.input(getAIResponseSchema)
		.mutation(async ({ ctx, input }) => {
			// Check if user is an active participant and has moderator privileges
			const participant = await checkParticipantPermission(
				ctx.db,
				ctx.session.user.id,
				input.discussionId,
			);

			if (!["CREATOR", "MODERATOR"].includes(participant.role)) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only creators and moderators can generate AI responses",
				});
			}

			// Get discussion context
			const discussion = await ctx.db.discussion.findUnique({
				where: { id: input.discussionId },
				include: {
					lesson: {
						select: {
							title: true,
							description: true,
							objectives: true,
							keyQuestions: true,
							facilitationStyle: true,
							content: true,
						},
					},
					participants: {
						where: { status: "ACTIVE" },
						include: {
							user: {
								select: {
									id: true,
									name: true,
								},
							},
						},
					},
				},
			});

			if (!discussion?.isActive) {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "Discussion is not active",
				});
			}

			// Get recent messages for context
			const recentMessages = await ctx.db.message.findMany({
				where: {
					discussionId: input.discussionId,
					type: { in: ["USER", "MODERATOR", "AI_QUESTION", "AI_PROMPT"] },
				},
				orderBy: { createdAt: "desc" },
				take: 10,
				include: {
					author: {
						select: { name: true },
					},
				},
			});

			// Build AI facilitation context
			const discussionContext = {
				id: discussion.id,
				name: discussion.name,
				description: discussion.description || undefined,
				lesson: discussion.lesson
					? {
							title: discussion.lesson.title,
							description: discussion.lesson.description || undefined,
							objectives: discussion.lesson.objectives as string[],
							keyQuestions: discussion.lesson.keyQuestions as string[],
							facilitationStyle: discussion.lesson.facilitationStyle,
							content: discussion.lesson.content || undefined,
						}
					: {
							title: "Unknown Lesson",
							objectives: [],
							keyQuestions: [],
							facilitationStyle: "analytical",
						},
				participants: discussion.participants.map((p) => ({
					id: p.user.id,
					name: p.user.name || "Anonymous",
					role: p.role,
				})),
				recentMessages: recentMessages.map((m) => ({
					id: m.id,
					content: m.content,
					authorName: m.author?.name || "Anonymous",
					type: m.type,
					createdAt: m.createdAt,
				})),
				messageCount: recentMessages.length,
				duration: "ongoing", // This could be calculated
			};

			// Broadcast AI thinking indicator
			const wsService = getWebSocketService();
			if (wsService) {
				wsService.broadcastToDiscussion(input.discussionId, {
					type: "ai_thinking",
					discussionId: input.discussionId,
					data: { isThinking: true },
					timestamp: Date.now(),
				});
			}

			try {
				// Generate AI response
				const aiResponse = await aiService.generateResponse({
					discussionContext,
					facilitationGoal: "DEEPEN_ANALYSIS", // Default goal, could be inferred from context
					specificContext: input.context,
					replyToMessageId: input.replyToId,
				});

				// Create AI message in database
				const aiMessage = await ctx.db.message.create({
					data: {
						discussionId: input.discussionId,
						content: aiResponse.content,
						type: aiResponse.type as MessageType,
						parentId: input.replyToId,
					},
					include: {
						author: {
							select: {
								id: true,
								name: true,
								email: true,
								image: true,
							},
						},
						parent: {
							select: {
								id: true,
								content: true,
								author: {
									select: { name: true },
								},
							},
						},
						_count: {
							select: { replies: true },
						},
					},
				});

				// Stop AI thinking indicator and broadcast message
				if (wsService) {
					wsService.broadcastToDiscussion(input.discussionId, {
						type: "ai_thinking",
						discussionId: input.discussionId,
						data: { isThinking: false },
						timestamp: Date.now(),
					});

					wsService.broadcastToDiscussion(input.discussionId, {
						type: "new_message",
						discussionId: input.discussionId,
						data: formatMessageOutput(aiMessage),
						timestamp: Date.now(),
					});
				}

				return {
					message: formatMessageOutput(aiMessage),
					suggestedFollowUps: aiResponse.suggestedFollowUps,
				};
			} catch (error) {
				// Stop AI thinking indicator on error
				if (wsService) {
					wsService.broadcastToDiscussion(input.discussionId, {
						type: "ai_thinking",
						discussionId: input.discussionId,
						data: { isThinking: false },
						timestamp: Date.now(),
					});
				}

				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to generate AI response",
				});
			}
		}),
});
