import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import type {
	MessageType,
	ParticipantRole,
	ParticipantStatus,
} from "@prisma/client";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

// Validation schemas
const createDiscussionSchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().optional(),
	lessonId: z.string().cuid().optional(),
	maxParticipants: z.number().min(2).max(50).default(20),
	isPublic: z.boolean().default(false),
	password: z.string().min(6).optional(),
	scheduledFor: z.date().optional(),
	expiresAt: z.date().optional(),
	aiConfig: z.record(z.any()).default({}),
	systemPrompt: z.string().optional(),
});

const joinDiscussionSchema = z.object({
	discussionId: z.string().cuid().optional(),
	joinCode: z.string().optional(),
	password: z.string().optional(),
});

const sendMessageSchema = z.object({
	discussionId: z.string().cuid(),
	content: z.string().min(1).max(5000),
	parentId: z.string().cuid().optional(),
});

const getMessagesSchema = z.object({
	discussionId: z.string().cuid(),
	limit: z.number().min(1).max(100).default(50),
	cursor: z.string().optional(), // For pagination
	parentId: z.string().optional(), // For threaded messages
});

// Helper function to generate join code
function generateJoinCode(): string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	let code = "";
	for (let i = 0; i < 8; i++) {
		code += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return code;
}

export const discussionRouter = createTRPCRouter({
	// Create a new discussion
	create: protectedProcedure
		.input(createDiscussionSchema)
		.mutation(async ({ ctx, input }) => {
			let hashedPassword: string | null = null;
			if (input.password) {
				hashedPassword = await bcrypt.hash(input.password, 10);
			}

			// If a lesson is specified, get its AI config
			let lessonConfig = {};
			if (input.lessonId) {
				const lesson = await ctx.db.lesson.findUnique({
					where: { id: input.lessonId },
					select: {
						facilitationStyle: true,
						keyQuestions: true,
					},
				});

				if (lesson) {
					lessonConfig = {
						facilitationStyle: lesson.facilitationStyle,
						keyQuestions: lesson.keyQuestions,
					};
				}
			}

			const discussion = await ctx.db.discussion.create({
				data: {
					name: input.name,
					description: input.description,
					creatorId: ctx.session.user.id,
					lessonId: input.lessonId,
					maxParticipants: input.maxParticipants,
					isPublic: input.isPublic,
					password: hashedPassword,
					joinCode: generateJoinCode(),
					scheduledFor: input.scheduledFor,
					expiresAt: input.expiresAt,
					aiConfig: { ...lessonConfig, ...input.aiConfig },
					systemPrompt: input.systemPrompt,
					participants: {
						create: {
							userId: ctx.session.user.id,
							role: "CREATOR" as ParticipantRole,
							status: "ACTIVE" as ParticipantStatus,
						},
					},
				},
				include: {
					lesson: {
						select: {
							id: true,
							title: true,
						},
					},
					_count: {
						select: {
							participants: true,
						},
					},
				},
			});

			return discussion;
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
					_count: {
						select: {
							participants: {
								where: {
									status: "ACTIVE",
								},
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

			// Check if discussion has expired
			if (discussion.expiresAt && discussion.expiresAt < new Date()) {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "Discussion has expired",
				});
			}

			// Check password if required
			if (discussion.password && !input.password) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "Password required",
				});
			}

			if (discussion.password && input.password) {
				const isValidPassword = await bcrypt.compare(
					input.password,
					discussion.password,
				);

				if (!isValidPassword) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "Invalid password",
					});
				}
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
				},
			);

			if (existingParticipant) {
				// Update status if rejoining
				if (existingParticipant.status !== "ACTIVE") {
					await ctx.db.discussionParticipant.update({
						where: { id: existingParticipant.id },
						data: {
							status: "ACTIVE",
							leftAt: null,
						},
					});
				}
				return { discussionId: discussion.id, rejoined: true };
			}

			// Check capacity
			if (discussion._count.participants >= discussion.maxParticipants) {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "Discussion is full",
				});
			}

			// Add user as participant
			await ctx.db.discussionParticipant.create({
				data: {
					discussionId: discussion.id,
					userId: ctx.session.user.id,
					role: "PARTICIPANT" as ParticipantRole,
					status: "ACTIVE" as ParticipantStatus,
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

			return { discussionId: discussion.id, joined: true };
		}),

	// Leave a discussion
	leave: protectedProcedure
		.input(z.string().cuid())
		.mutation(async ({ ctx, input }) => {
			const participant = await ctx.db.discussionParticipant.findUnique({
				where: {
					discussionId_userId: {
						discussionId: input,
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

			// Update participant status
			await ctx.db.discussionParticipant.update({
				where: { id: participant.id },
				data: {
					status: "LEFT" as ParticipantStatus,
					leftAt: new Date(),
				},
			});

			// Create system message for user leaving
			await ctx.db.message.create({
				data: {
					discussionId: input,
					content: `${ctx.session.user.name || "A participant"} left the discussion`,
					type: "SYSTEM" as MessageType,
				},
			});

			return { left: true };
		}),

	// Close a discussion
	close: protectedProcedure
		.input(z.string().cuid())
		.mutation(async ({ ctx, input }) => {
			// Check if user is creator or moderator
			const participant = await ctx.db.discussionParticipant.findUnique({
				where: {
					discussionId_userId: {
						discussionId: input,
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
					message: "You don't have permission to close this discussion",
				});
			}

			// Close the discussion
			const discussion = await ctx.db.discussion.update({
				where: { id: input },
				data: {
					isActive: false,
					closedAt: new Date(),
				},
			});

			// Update all active participants
			await ctx.db.discussionParticipant.updateMany({
				where: {
					discussionId: input,
					status: "ACTIVE",
				},
				data: {
					leftAt: new Date(),
				},
			});

			// Create closing message
			await ctx.db.message.create({
				data: {
					discussionId: input,
					content: "Discussion has been closed",
					type: "SYSTEM" as MessageType,
				},
			});

			return discussion;
		}),

	// List discussions
	list: protectedProcedure
		.input(
			z.object({
				onlyActive: z.boolean().default(true),
				onlyMine: z.boolean().default(false),
				isPublic: z.boolean().optional(),
				lessonId: z.string().cuid().optional(),
				limit: z.number().min(1).max(100).default(20),
				offset: z.number().min(0).default(0),
			}),
		)
		.query(async ({ ctx, input }) => {
			const where = {
				...(input.onlyActive && { isActive: true }),
				...(input.onlyMine
					? { creatorId: ctx.session.user.id }
					: {
							participants: {
								some: {
									userId: ctx.session.user.id,
									status: "ACTIVE" as ParticipantStatus,
								},
							},
						}),
				...(input.isPublic !== undefined && { isPublic: input.isPublic }),
				...(input.lessonId && { lessonId: input.lessonId }),
			};

			const [discussions, total] = await Promise.all([
				ctx.db.discussion.findMany({
					where,
					take: input.limit,
					skip: input.offset,
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
							},
						},
						_count: {
							select: {
								participants: {
									where: {
										status: "ACTIVE",
									},
								},
								messages: true,
							},
						},
					},
				}),
				ctx.db.discussion.count({ where }),
			]);

			return {
				discussions,
				total,
				hasMore: input.offset + input.limit < total,
			};
		}),

	// Get discussion by ID
	getById: protectedProcedure
		.input(z.string().cuid())
		.query(async ({ ctx, input }) => {
			// Check if user is a participant
			const participant = await ctx.db.discussionParticipant.findUnique({
				where: {
					discussionId_userId: {
						discussionId: input,
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
				where: { id: input },
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
						},
					},
					participants: {
						where: {
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
					},
					_count: {
						select: {
							messages: true,
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

			return discussion;
		}),

	// Send a message
	sendMessage: protectedProcedure
		.input(sendMessageSchema)
		.mutation(async ({ ctx, input }) => {
			// Verify user is an active participant
			const participant = await ctx.db.discussionParticipant.findUnique({
				where: {
					discussionId_userId: {
						discussionId: input.discussionId,
						userId: ctx.session.user.id,
					},
				},
			});

			if (!participant || participant.status !== "ACTIVE") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You must be an active participant to send messages",
				});
			}

			// Verify discussion is active
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

			// Create the message
			const message = await ctx.db.message.create({
				data: {
					discussionId: input.discussionId,
					authorId: ctx.session.user.id,
					content: input.content,
					parentId: input.parentId,
					type: "USER" as MessageType,
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
								select: {
									name: true,
								},
							},
						},
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

			return message;
		}),

	// Get messages
	getMessages: protectedProcedure
		.input(getMessagesSchema)
		.query(async ({ ctx, input }) => {
			// Verify user is a participant
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
					code: "FORBIDDEN",
					message: "You don't have permission to view messages",
				});
			}

			// Update last seen
			await ctx.db.discussionParticipant.update({
				where: { id: participant.id },
				data: {
					lastSeenAt: new Date(),
				},
			});

			const where = {
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
								select: {
									name: true,
								},
							},
						},
					},
					_count: {
						select: {
							replies: true,
						},
					},
				},
			});

			let hasMore = false;
			if (messages.length > input.limit) {
				messages.pop();
				hasMore = true;
			}

			return {
				messages,
				hasMore,
				nextCursor: messages[messages.length - 1]?.id,
			};
		}),

	// Generate AI question (placeholder - would connect to AI service)
	generateAIQuestion: protectedProcedure
		.input(
			z.object({
				discussionId: z.string().cuid(),
				context: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify user is a participant
			const participant = await ctx.db.discussionParticipant.findUnique({
				where: {
					discussionId_userId: {
						discussionId: input.discussionId,
						userId: ctx.session.user.id,
					},
				},
			});

			if (!participant || participant.status !== "ACTIVE") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You must be an active participant",
				});
			}

			// Get discussion with lesson info
			const discussion = await ctx.db.discussion.findUnique({
				where: { id: input.discussionId },
				include: {
					lesson: {
						select: {
							content: true,
							objectives: true,
							keyQuestions: true,
							facilitationStyle: true,
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
					type: { in: ["USER", "AI_QUESTION"] },
				},
				orderBy: { createdAt: "desc" },
				take: 10,
				include: {
					author: {
						select: { name: true },
					},
				},
			});

			// TODO: Integrate with AI service to generate Socratic question
			// For now, return a placeholder question
			const aiQuestion = await ctx.db.message.create({
				data: {
					discussionId: input.discussionId,
					content:
						"What assumptions are you making in your statement? Can you identify them?",
					type: "AI_QUESTION" as MessageType,
				},
			});

			return aiQuestion;
		}),
});
