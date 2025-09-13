import { validateInvitationToken } from "@/lib/invitation-jwt";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

// Input validation schemas based on contract specifications
const invitationValidationSchema = z.object({
	discussionId: z.string(),
	token: z.string(),
});

const participantJoinSchema = z.object({
	discussionId: z.string(),
	displayName: z.string().min(1).max(50),
	sessionId: z.string(),
	ipAddress: z.string().optional(),
});

const participantLeaveSchema = z.object({
	participantId: z.string(),
});

const messageHistorySchema = z.object({
	discussionId: z.string(),
	before: z.string().optional(),
	limit: z.number().int().min(1).max(50).default(20),
});

// Helper function to compute discussion status from database fields
function computeDiscussionStatus(
	isActive: boolean,
	closedAt: Date | null,
): "active" | "completed" | "cancelled" {
	if (!isActive) {
		return closedAt ? "completed" : "cancelled";
	}
	return "active";
}

// Helper function to format message for output
function formatMessageSummary(message: {
	id: string;
	content: string;
	senderName: string;
	senderType: string;
	createdAt: Date;
	author?: { name: string | null } | null;
	participant?: { displayName: string } | null;
}) {
	let senderName = "";
	let senderType: "user" | "participant" | "system" = "system";

	if (message.author) {
		senderName = message.author.name || "Unknown User";
		senderType = "user";
	} else if (message.participant) {
		senderName = message.participant.displayName;
		senderType = "participant";
	} else if (message.senderType === "SYSTEM") {
		senderName = "System";
		senderType = "system";
	} else {
		// Fallback to denormalized fields
		senderName = message.senderName || "Unknown";
		senderType =
			(message.senderType?.toLowerCase() as
				| "user"
				| "participant"
				| "system") || "system";
	}

	return {
		id: message.id,
		content: message.content,
		senderName,
		senderType,
		createdAt: message.createdAt.toISOString(),
	};
}

export const participantRouter = createTRPCRouter({
	// Validate invitation link and get discussion info
	validateInvitation: publicProcedure
		.input(invitationValidationSchema)
		.query(async ({ ctx, input }) => {
			try {
				// Validate the JWT token using the existing service
				const validation = validateInvitationToken(input.token);

				if (!validation.valid) {
					return {
						valid: false,
						error: validation.error || "Invalid invitation link",
						discussion: undefined,
					};
				}

				// Verify the discussion ID matches
				if (validation.claims?.discussionId !== input.discussionId) {
					return {
						valid: false,
						error: "Invalid invitation link",
						discussion: undefined,
					};
				}

				// Fetch discussion details
				const discussion = await ctx.db.discussion.findUnique({
					where: { id: input.discussionId },
					select: {
						id: true,
						name: true,
						isActive: true,
						maxParticipants: true,
						closedAt: true,
						_count: {
							select: {
								participants: {
									where: { status: "ACTIVE" },
								},
								anonymousParticipants: {
									where: { leftAt: null },
								},
							},
						},
					},
				});

				if (!discussion) {
					return {
						valid: false,
						error: "Discussion not found",
						discussion: undefined,
					};
				}

				const status = computeDiscussionStatus(
					discussion.isActive,
					discussion.closedAt,
				);

				if (status !== "active") {
					return {
						valid: false,
						error: "Discussion has ended",
						discussion: undefined,
					};
				}

				const participantCount =
					discussion._count.participants +
					discussion._count.anonymousParticipants;

				// Check if discussion is at capacity
				if (
					discussion.maxParticipants &&
					participantCount >= discussion.maxParticipants
				) {
					return {
						valid: false,
						error: "Discussion is at capacity",
						discussion: undefined,
					};
				}

				return {
					valid: true,
					discussion: {
						id: discussion.id,
						title: discussion.name,
						status,
						participantCount,
						maxParticipants: discussion.maxParticipants,
					},
				};
			} catch (error) {
				return {
					valid: false,
					error: "Invalid invitation link",
					discussion: undefined,
				};
			}
		}),

	// Join a discussion as an anonymous participant
	join: publicProcedure
		.input(participantJoinSchema)
		.mutation(async ({ ctx, input }) => {
			// Check if discussion exists and is active
			const discussion = await ctx.db.discussion.findUnique({
				where: { id: input.discussionId },
				select: {
					id: true,
					name: true,
					isActive: true,
					maxParticipants: true,
					closedAt: true,
					_count: {
						select: {
							participants: {
								where: { status: "ACTIVE" },
							},
							anonymousParticipants: {
								where: { leftAt: null },
							},
						},
					},
				},
			});

			if (!discussion) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Discussion not found",
				});
			}

			const status = computeDiscussionStatus(
				discussion.isActive,
				discussion.closedAt,
			);

			if (status !== "active") {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "Discussion has ended",
				});
			}

			const participantCount =
				discussion._count.participants +
				discussion._count.anonymousParticipants;

			// Check capacity
			if (
				discussion.maxParticipants &&
				participantCount >= discussion.maxParticipants
			) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Discussion is at capacity",
				});
			}

			// Check if participant with same sessionId already exists
			let participant = await ctx.db.participant.findFirst({
				where: {
					discussionId: input.discussionId,
					sessionId: input.sessionId,
				},
			});

			if (participant) {
				// Update existing participant (rejoin or update display name)
				participant = await ctx.db.participant.update({
					where: { id: participant.id },
					data: {
						displayName: input.displayName,
						leftAt: null, // Clear leftAt if rejoining
						ipAddress: input.ipAddress,
					},
				});
			} else {
				// Create new participant
				participant = await ctx.db.participant.create({
					data: {
						discussionId: input.discussionId,
						displayName: input.displayName,
						sessionId: input.sessionId,
						ipAddress: input.ipAddress,
					},
				});
			}

			// Get recent message history (last 20 messages by default)
			const messages = await ctx.db.message.findMany({
				where: { discussionId: input.discussionId },
				orderBy: { createdAt: "desc" },
				take: 20,
				include: {
					author: {
						select: { name: true },
					},
					participant: {
						select: { displayName: true },
					},
				},
			});

			// Reverse to chronological order (oldest first)
			const messageHistory = messages.reverse().map(formatMessageSummary);

			return {
				participant: {
					id: participant.id,
					discussionId: participant.discussionId,
					displayName: participant.displayName,
					joinedAt: participant.joinedAt.toISOString(),
					leftAt: participant.leftAt?.toISOString() || null,
				},
				messageHistory,
			};
		}),

	// Leave a discussion
	leave: publicProcedure
		.input(participantLeaveSchema)
		.mutation(async ({ ctx, input }) => {
			const participant = await ctx.db.participant.findUnique({
				where: { id: input.participantId },
			});

			if (!participant) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Participant not found",
				});
			}

			// Update leftAt timestamp
			await ctx.db.participant.update({
				where: { id: input.participantId },
				data: {
					leftAt: new Date(),
				},
			});

			return { success: true };
		}),

	// Get paginated message history
	getMessageHistory: publicProcedure
		.input(messageHistorySchema)
		.query(async ({ ctx, input }) => {
			// Verify discussion exists
			const discussion = await ctx.db.discussion.findUnique({
				where: { id: input.discussionId },
				select: { id: true },
			});

			if (!discussion) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Discussion not found",
				});
			}

			// Build where clause for pagination
			const whereClause = {
				discussionId: input.discussionId,
				...(input.before && {
					id: {
						lt: input.before,
					},
				}),
			};

			// Get messages with pagination
			const messages = await ctx.db.message.findMany({
				where: whereClause,
				orderBy: { createdAt: "desc" },
				take: input.limit + 1, // Take one extra to check if there are more
				include: {
					author: {
						select: { name: true },
					},
					participant: {
						select: { displayName: true },
					},
				},
			});

			// Check if there are more messages
			let hasMore = false;
			if (messages.length > input.limit) {
				messages.pop(); // Remove the extra message
				hasMore = true;
			}

			// Reverse to chronological order (oldest first) and format
			const formattedMessages = messages.reverse().map(formatMessageSummary);

			return {
				messages: formattedMessages,
				hasMore,
			};
		}),
});
