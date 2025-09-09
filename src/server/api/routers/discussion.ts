import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { aiService } from "@/server/services/ai-facilitator";
import { emailService } from "@/server/services/email";
import { getWebSocketService } from "@/server/services/websocket";
import type {
	Discussion,
	DiscussionParticipant,
	Lesson,
	MessageType,
	ParticipantRole,
	ParticipantStatus,
	User,
} from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

// Contract-compliant validation schemas
const createDiscussionSchema = z.object({
	lessonId: z.string().cuid(),
	name: z.string().min(1).max(100),
	description: z.string().optional(),
	maxParticipants: z.number().int().min(1).max(1000).default(20),
	isPublic: z.boolean().default(false),
	scheduledFor: z.date().optional(),
	expiresAt: z.date().optional(),
	aiConfig: z
		.object({
			model: z.string().default("gpt-4"),
			temperature: z.number().min(0).max(2).default(0.7),
			maxTokens: z.number().int().min(1).max(4000).default(500),
		})
		.optional(),
});

const updateDiscussionSchema = z.object({
	id: z.string().cuid(),
	name: z.string().min(1).max(100).optional(),
	description: z.string().optional(),
	maxParticipants: z.number().int().min(1).max(1000).optional(),
	isPublic: z.boolean().optional(),
	scheduledFor: z.date().optional(),
	expiresAt: z.date().optional(),
});

const listDiscussionsSchema = z.object({
	role: z.enum(["creator", "participant", "all"]).optional(),
	isActive: z.boolean().optional(),
	limit: z.number().int().min(1).max(100).default(20),
	cursor: z.string().optional(),
});

const joinDiscussionSchema = z.object({
	discussionId: z.string().cuid().optional(),
	joinCode: z.string().length(8).optional(),
	password: z.string().optional(),
});

// Helper functions
function generateJoinCode(): string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	let code = "";
	for (let i = 0; i < 8; i++) {
		code += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return code;
}

type DiscussionWithRelations = Discussion & {
	creator?: Pick<User, "id" | "name" | "email" | "image"> | User | null;
	lesson?:
		| Pick<
				Lesson,
				"id" | "title" | "description" | "objectives" | "facilitationStyle"
		  >
		| Lesson
		| null;
	_count?: {
		participants?: number;
	};
};

function formatDiscussionOutput(
	discussion: DiscussionWithRelations,
	userRole?: ParticipantRole,
	currentUserId?: string,
) {
	return {
		id: discussion.id,
		name: discussion.name,
		description: discussion.description,
		creatorId: discussion.creatorId,
		creator: discussion.creator,
		lessonId: discussion.lessonId,
		lesson: discussion.lesson,
		isActive: discussion.isActive,
		isPublic: discussion.isPublic,
		maxParticipants: discussion.maxParticipants,
		participantCount: discussion._count?.participants || 0,
		joinCode: discussion.joinCode,
		hasPassword: !!discussion.password,
		scheduledFor: discussion.scheduledFor,
		expiresAt: discussion.expiresAt,
		createdAt: discussion.createdAt,
		updatedAt: discussion.updatedAt,
		closedAt: discussion.closedAt,
		userRole: userRole || null,
		isCreator: discussion.creatorId === currentUserId,
	};
}

type ParticipantWithUser = DiscussionParticipant & {
	user?: Pick<User, "id" | "name" | "email" | "image"> | User | null;
};

function formatParticipantOutput(participant: ParticipantWithUser) {
	return {
		id: participant.id,
		userId: participant.userId,
		user: participant.user,
		role: participant.role,
		status: participant.status,
		joinedAt: participant.joinedAt,
		leftAt: participant.leftAt,
		lastSeenAt: participant.lastSeenAt,
		messageCount: participant.messageCount,
	};
}

export const discussionRouter = createTRPCRouter({
	// Create a new discussion
	create: protectedProcedure
		.input(createDiscussionSchema)
		.mutation(async ({ ctx, input }) => {
			// Get lesson info (lessonId is required in contract)
			const lesson = await ctx.db.lesson.findUnique({
				where: { id: input.lessonId },
				select: {
					id: true,
					title: true,
					description: true,
					objectives: true,
					facilitationStyle: true,
					keyQuestions: true,
					creatorId: true,
				},
			});

			if (!lesson) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Lesson not found",
				});
			}

			// Check if user owns the lesson
			if (lesson.creatorId !== ctx.session.user.id) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You can only create discussions from your own lessons",
				});
			}

			const lessonConfig = {
				facilitationStyle: lesson.facilitationStyle,
				keyQuestions: lesson.keyQuestions,
				objectives: lesson.objectives,
			};

			const discussion = await ctx.db.discussion.create({
				data: {
					name: input.name,
					description: input.description,
					creatorId: ctx.session.user.id,
					lessonId: input.lessonId,
					maxParticipants: input.maxParticipants,
					isPublic: input.isPublic,
					joinCode: generateJoinCode(),
					scheduledFor: input.scheduledFor,
					expiresAt: input.expiresAt,
					aiConfig: { ...lessonConfig, ...input.aiConfig },
					participants: {
						create: {
							userId: ctx.session.user.id,
							role: "CREATOR" as ParticipantRole,
							status: "ACTIVE" as ParticipantStatus,
						},
					},
				},
				include: {
					creator: {
						select: {
							id: true,
							name: true,
							email: true,
							image: true,
						},
					},
					lesson: {
						select: {
							id: true,
							title: true,
							description: true,
							objectives: true,
							facilitationStyle: true,
						},
					},
					_count: {
						select: {
							participants: {
								where: { status: "ACTIVE" },
							},
						},
					},
				},
			});

			return formatDiscussionOutput(discussion, "CREATOR", ctx.session.user.id);
		}),

	// Update discussion details (creator only)
	update: protectedProcedure
		.input(updateDiscussionSchema)
		.mutation(async ({ ctx, input }) => {
			// Check if user is creator
			const participant = await ctx.db.discussionParticipant.findUnique({
				where: {
					discussionId_userId: {
						discussionId: input.id,
						userId: ctx.session.user.id,
					},
				},
			});

			if (!participant || participant.role !== "CREATOR") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only the creator can update discussion details",
				});
			}

			const discussion = await ctx.db.discussion.update({
				where: { id: input.id },
				data: {
					name: input.name,
					description: input.description,
					maxParticipants: input.maxParticipants,
					isPublic: input.isPublic,
					scheduledFor: input.scheduledFor,
					expiresAt: input.expiresAt,
				},
				include: {
					creator: {
						select: {
							id: true,
							name: true,
							email: true,
							image: true,
						},
					},
					lesson: {
						select: {
							id: true,
							title: true,
							description: true,
							objectives: true,
							facilitationStyle: true,
						},
					},
					_count: {
						select: {
							participants: {
								where: { status: "ACTIVE" },
							},
						},
					},
				},
			});

			return formatDiscussionOutput(discussion, "CREATOR", ctx.session.user.id);
		}),

	// Close a discussion (creator only)
	close: protectedProcedure
		.input(z.object({ id: z.string().cuid() }))
		.mutation(async ({ ctx, input }) => {
			// Check if user is creator
			const participant = await ctx.db.discussionParticipant.findUnique({
				where: {
					discussionId_userId: {
						discussionId: input.id,
						userId: ctx.session.user.id,
					},
				},
			});

			if (!participant || participant.role !== "CREATOR") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only the creator can close the discussion",
				});
			}

			// Close the discussion
			const discussion = await ctx.db.discussion.update({
				where: { id: input.id },
				data: {
					isActive: false,
					closedAt: new Date(),
				},
				include: {
					creator: {
						select: {
							id: true,
							name: true,
							email: true,
							image: true,
						},
					},
					lesson: {
						select: {
							id: true,
							title: true,
							description: true,
							objectives: true,
							facilitationStyle: true,
						},
					},
					_count: {
						select: {
							participants: {
								where: { status: "ACTIVE" },
							},
						},
					},
				},
			});

			// Create closing message
			await ctx.db.message.create({
				data: {
					discussionId: input.id,
					content: "Discussion has been closed by the creator",
					type: "SYSTEM" as MessageType,
				},
			});

			// Broadcast to WebSocket if available
			const wsService = getWebSocketService();
			if (wsService) {
				wsService.broadcastToDiscussion(input.id, {
					type: "user_left",
					discussionId: input.id,
					data: { closed: true },
					timestamp: Date.now(),
				});
			}

			return formatDiscussionOutput(discussion, "CREATOR", ctx.session.user.id);
		}),

	// Get discussion details
	getById: protectedProcedure
		.input(z.object({ id: z.string().cuid() }))
		.query(async ({ ctx, input }) => {
			// Check if user is a participant
			const participant = await ctx.db.discussionParticipant.findUnique({
				where: {
					discussionId_userId: {
						discussionId: input.id,
						userId: ctx.session.user.id,
					},
				},
			});

			if (!participant) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You don't have permission to view this discussion",
				});
			}

			const discussion = await ctx.db.discussion.findUnique({
				where: { id: input.id },
				include: {
					creator: {
						select: {
							id: true,
							name: true,
							email: true,
							image: true,
						},
					},
					lesson: {
						select: {
							id: true,
							title: true,
							description: true,
							objectives: true,
							facilitationStyle: true,
						},
					},
					_count: {
						select: {
							participants: {
								where: { status: "ACTIVE" },
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

			return formatDiscussionOutput(
				discussion,
				participant.role,
				ctx.session.user.id,
			);
		}),

	// List discussions (filtered by role)
	list: protectedProcedure
		.input(listDiscussionsSchema)
		.query(async ({ ctx, input }) => {
			const where: Record<string, unknown> = {};

			if (input.role === "creator") {
				where.creatorId = ctx.session.user.id;
			} else if (input.role === "participant") {
				where.participants = {
					some: {
						userId: ctx.session.user.id,
						status: "ACTIVE",
						role: { not: "CREATOR" },
					},
				};
			} else {
				// "all" or undefined - show discussions user is involved in
				where.participants = {
					some: {
						userId: ctx.session.user.id,
						status: "ACTIVE",
					},
				};
			}

			if (input.isActive !== undefined) {
				where.isActive = input.isActive;
			}

			if (input.cursor) {
				where.id = { lt: input.cursor };
			}

			const discussions = await ctx.db.discussion.findMany({
				where,
				take: input.limit + 1, // Take one extra to check if there are more
				orderBy: { updatedAt: "desc" },
				include: {
					creator: {
						select: {
							id: true,
							name: true,
							email: true,
							image: true,
						},
					},
					lesson: {
						select: {
							id: true,
							title: true,
							description: true,
							objectives: true,
							facilitationStyle: true,
						},
					},
					participants: {
						where: {
							userId: ctx.session.user.id,
						},
						select: {
							role: true,
						},
					},
					_count: {
						select: {
							participants: {
								where: { status: "ACTIVE" },
							},
						},
					},
				},
			});

			let hasMore = false;
			if (discussions.length > input.limit) {
				discussions.pop();
				hasMore = true;
			}

			const formattedDiscussions = discussions.map((d) =>
				formatDiscussionOutput(d, d.participants[0]?.role, ctx.session.user.id),
			);

			return {
				discussions: formattedDiscussions,
				nextCursor: discussions[discussions.length - 1]?.id,
				hasMore,
			};
		}),

	// Generate a join code for the discussion
	generateJoinCode: protectedProcedure
		.input(z.object({ discussionId: z.string().cuid() }))
		.mutation(async ({ ctx, input }) => {
			// Check if user is creator or moderator
			const participant = await ctx.db.discussionParticipant.findUnique({
				where: {
					discussionId_userId: {
						discussionId: input.discussionId,
						userId: ctx.session.user.id,
					},
				},
			});

			if (
				!participant ||
				!["CREATOR", "MODERATOR"].includes(participant.role)
			) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only creators and moderators can generate join codes",
				});
			}

			const newJoinCode = generateJoinCode();
			const expiresAt = new Date();
			expiresAt.setHours(expiresAt.getHours() + 24); // Expires in 24 hours

			await ctx.db.discussion.update({
				where: { id: input.discussionId },
				data: { joinCode: newJoinCode },
			});

			return {
				joinCode: newJoinCode,
				expiresAt,
			};
		}),

	// Join a discussion
	join: protectedProcedure
		.input(joinDiscussionSchema)
		.mutation(async ({ ctx, input }) => {
			if (!input.discussionId && !input.joinCode) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Either discussionId or joinCode is required",
				});
			}

			// Find the discussion
			const discussion = await ctx.db.discussion.findFirst({
				where: {
					OR: [{ id: input.discussionId }, { joinCode: input.joinCode }],
				},
				include: {
					creator: {
						select: {
							id: true,
							name: true,
							email: true,
							image: true,
						},
					},
					lesson: {
						select: {
							id: true,
							title: true,
							description: true,
							objectives: true,
							facilitationStyle: true,
						},
					},
					_count: {
						select: {
							participants: {
								where: { status: "ACTIVE" },
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

			// Check if discussion is active
			if (!discussion.isActive) {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "Discussion is not active",
				});
			}

			// Check if user is already a participant
			const existingParticipant = await ctx.db.discussionParticipant.findUnique(
				{
					where: {
						discussionId_userId: {
							discussionId: discussion.id,
							userId: ctx.session.user.id,
						},
					},
					include: {
						user: {
							select: {
								id: true,
								name: true,
								email: true,
								image: true,
							},
						},
					},
				},
			);

			if (existingParticipant) {
				// Reactivate if needed
				if (existingParticipant.status !== "ACTIVE") {
					const updatedParticipant = await ctx.db.discussionParticipant.update({
						where: { id: existingParticipant.id },
						data: {
							status: "ACTIVE",
							leftAt: null,
						},
						include: {
							user: {
								select: {
									id: true,
									name: true,
									email: true,
									image: true,
								},
							},
						},
					});

					return {
						discussion: formatDiscussionOutput(
							discussion,
							existingParticipant.role,
							ctx.session.user.id,
						),
						participant: formatParticipantOutput(updatedParticipant),
					};
				}

				return {
					discussion: formatDiscussionOutput(
						discussion,
						existingParticipant.role,
						ctx.session.user.id,
					),
					participant: formatParticipantOutput(existingParticipant),
				};
			}

			// Check capacity
			if (discussion._count.participants >= discussion.maxParticipants) {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "Discussion is full",
				});
			}

			// Add user as participant
			const participant = await ctx.db.discussionParticipant.create({
				data: {
					discussionId: discussion.id,
					userId: ctx.session.user.id,
					role: "PARTICIPANT" as ParticipantRole,
					status: "ACTIVE" as ParticipantStatus,
				},
				include: {
					user: {
						select: {
							id: true,
							name: true,
							email: true,
							image: true,
						},
					},
				},
			});

			// Create system message for user joining
			await ctx.db.message.create({
				data: {
					discussionId: discussion.id,
					content: `${ctx.session.user.name || "A participant"} joined the discussion`,
					type: "SYSTEM" as MessageType,
				},
			});

			// Broadcast to WebSocket if available
			const wsService = getWebSocketService();
			if (wsService) {
				wsService.broadcastToDiscussion(discussion.id, {
					type: "user_joined",
					discussionId: discussion.id,
					data: {
						user: { id: ctx.session.user.id, name: ctx.session.user.name },
					},
					timestamp: Date.now(),
				});
			}

			return {
				discussion: formatDiscussionOutput(
					discussion,
					"PARTICIPANT",
					ctx.session.user.id,
				),
				participant: formatParticipantOutput(participant),
			};
		}),

	// Leave a discussion
	leave: protectedProcedure
		.input(z.object({ discussionId: z.string().cuid() }))
		.mutation(async ({ ctx, input }) => {
			const participant = await ctx.db.discussionParticipant.findUnique({
				where: {
					discussionId_userId: {
						discussionId: input.discussionId,
						userId: ctx.session.user.id,
					},
				},
			});

			if (!participant) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "You are not a participant in this discussion",
				});
			}

			if (participant.role === "CREATOR") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Creator cannot leave the discussion. Close it instead.",
				});
			}

			// Update participant status
			await ctx.db.discussionParticipant.update({
				where: { id: participant.id },
				data: {
					status: "LEFT" as ParticipantStatus,
					leftAt: new Date(),
				},
			});

			// Create system message
			await ctx.db.message.create({
				data: {
					discussionId: input.discussionId,
					content: `${ctx.session.user.name || "A participant"} left the discussion`,
					type: "SYSTEM" as MessageType,
				},
			});

			// Broadcast to WebSocket if available
			const wsService = getWebSocketService();
			if (wsService) {
				wsService.broadcastToDiscussion(input.discussionId, {
					type: "user_left",
					discussionId: input.discussionId,
					data: { userId: ctx.session.user.id },
					timestamp: Date.now(),
				});
			}

			return { success: true };
		}),

	// Get participants in a discussion
	getParticipants: protectedProcedure
		.input(z.object({ id: z.string().cuid() }))
		.query(async ({ ctx, input }) => {
			// Check if user is a participant
			const userParticipant = await ctx.db.discussionParticipant.findUnique({
				where: {
					discussionId_userId: {
						discussionId: input.id,
						userId: ctx.session.user.id,
					},
				},
			});

			if (!userParticipant) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You don't have permission to view participants",
				});
			}

			const participants = await ctx.db.discussionParticipant.findMany({
				where: {
					discussionId: input.id,
					status: "ACTIVE",
				},
				include: {
					user: {
						select: {
							id: true,
							name: true,
							email: true,
							image: true,
						},
					},
				},
				orderBy: { joinedAt: "asc" },
			});

			return {
				participants: participants.map(formatParticipantOutput),
			};
		}),

	// Remove a participant (moderator/creator only)
	removeParticipant: protectedProcedure
		.input(
			z.object({
				discussionId: z.string().cuid(),
				participantId: z.string().cuid(),
				reason: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Check if user is creator or moderator
			const userParticipant = await ctx.db.discussionParticipant.findUnique({
				where: {
					discussionId_userId: {
						discussionId: input.discussionId,
						userId: ctx.session.user.id,
					},
				},
			});

			if (
				!userParticipant ||
				!["CREATOR", "MODERATOR"].includes(userParticipant.role)
			) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only creators and moderators can remove participants",
				});
			}

			const participantToRemove = await ctx.db.discussionParticipant.findUnique(
				{
					where: { id: input.participantId },
					include: {
						user: {
							select: { name: true },
						},
					},
				},
			);

			if (
				!participantToRemove ||
				participantToRemove.discussionId !== input.discussionId
			) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Participant not found",
				});
			}

			if (participantToRemove.role === "CREATOR") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Cannot remove the creator",
				});
			}

			// Remove the participant
			await ctx.db.discussionParticipant.update({
				where: { id: input.participantId },
				data: {
					status: "REMOVED" as ParticipantStatus,
					leftAt: new Date(),
				},
			});

			// Create system message
			const reason = input.reason ? ` (${input.reason})` : "";
			await ctx.db.message.create({
				data: {
					discussionId: input.discussionId,
					content: `${participantToRemove.user.name || "A participant"} was removed from the discussion${reason}`,
					type: "SYSTEM" as MessageType,
				},
			});

			// Broadcast to WebSocket if available
			const wsService = getWebSocketService();
			if (wsService) {
				wsService.broadcastToDiscussion(input.discussionId, {
					type: "user_left",
					discussionId: input.discussionId,
					data: { userId: participantToRemove.userId, removed: true },
					timestamp: Date.now(),
				});
			}

			return { success: true };
		}),

	// Update participant role (creator only)
	updateParticipantRole: protectedProcedure
		.input(
			z.object({
				discussionId: z.string().cuid(),
				participantId: z.string().cuid(),
				role: z.enum(["MODERATOR", "PARTICIPANT"]),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Check if user is creator
			const userParticipant = await ctx.db.discussionParticipant.findUnique({
				where: {
					discussionId_userId: {
						discussionId: input.discussionId,
						userId: ctx.session.user.id,
					},
				},
			});

			if (!userParticipant || userParticipant.role !== "CREATOR") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only the creator can update participant roles",
				});
			}

			const participantToUpdate = await ctx.db.discussionParticipant.findUnique(
				{
					where: { id: input.participantId },
				},
			);

			if (
				!participantToUpdate ||
				participantToUpdate.discussionId !== input.discussionId
			) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Participant not found",
				});
			}

			if (participantToUpdate.role === "CREATOR") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Cannot change creator role",
				});
			}

			const updatedParticipant = await ctx.db.discussionParticipant.update({
				where: { id: input.participantId },
				data: { role: input.role },
				include: {
					user: {
						select: {
							id: true,
							name: true,
							email: true,
							image: true,
						},
					},
				},
			});

			return formatParticipantOutput(updatedParticipant);
		}),
});
