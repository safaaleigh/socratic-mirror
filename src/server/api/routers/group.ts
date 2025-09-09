import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import type { GroupMemberStatus, GroupRole } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

// Validation schemas
const createGroupSchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().optional(),
	maxMembers: z.number().min(2).max(500).default(100),
	autoGroupSize: z.number().min(2).max(10).default(3),
	isActive: z.boolean().default(true),
});

const updateGroupSchema = createGroupSchema.partial().extend({
	id: z.string().cuid(),
});

const addMembersSchema = z.object({
	groupId: z.string().cuid(),
	userIds: z.array(z.string().cuid()).min(1).max(50),
	role: z.enum(["MEMBER", "ADMIN"]).default("MEMBER"),
});

const generateDiscussionsSchema = z.object({
	groupId: z.string().cuid(),
	lessonId: z.string().cuid(),
	discussionNamePrefix: z.string().default("Discussion"),
	shuffleParticipants: z.boolean().default(true),
	scheduledFor: z.date().optional(),
	expiresAt: z.date().optional(),
});

// Helper function to shuffle array
function shuffleArray<T>(array: T[]): T[] {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const temp = shuffled[i];
		if (temp !== undefined && shuffled[j] !== undefined) {
			shuffled[i] = shuffled[j];
			shuffled[j] = temp;
		}
	}
	return shuffled;
}

// Helper function to generate join code
function generateJoinCode(): string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	let code = "";
	for (let i = 0; i < 8; i++) {
		code += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return code;
}

export const groupRouter = createTRPCRouter({
	// Create a new group
	create: protectedProcedure
		.input(createGroupSchema)
		.mutation(async ({ ctx, input }) => {
			const group = await ctx.db.group.create({
				data: {
					...input,
					creatorId: ctx.session.user.id,
					members: {
						create: {
							userId: ctx.session.user.id,
							role: "OWNER" as GroupRole,
							status: "ACTIVE" as GroupMemberStatus,
						},
					},
				},
				include: {
					_count: {
						select: {
							members: true,
						},
					},
				},
			});

			return group;
		}),

	// Update group settings
	update: protectedProcedure
		.input(updateGroupSchema)
		.mutation(async ({ ctx, input }) => {
			const { id, ...data } = input;

			// Check if user is owner or admin
			const membership = await ctx.db.groupMember.findFirst({
				where: {
					groupId: id,
					userId: ctx.session.user.id,
					role: { in: ["OWNER", "ADMIN"] },
					status: "ACTIVE",
				},
			});

			if (!membership) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You don't have permission to update this group",
				});
			}

			const updatedGroup = await ctx.db.group.update({
				where: { id },
				data,
				include: {
					_count: {
						select: {
							members: true,
						},
					},
				},
			});

			return updatedGroup;
		}),

	// Add members to group
	addMembers: protectedProcedure
		.input(addMembersSchema)
		.mutation(async ({ ctx, input }) => {
			// Check if user is owner or admin
			const membership = await ctx.db.groupMember.findFirst({
				where: {
					groupId: input.groupId,
					userId: ctx.session.user.id,
					role: { in: ["OWNER", "ADMIN"] },
					status: "ACTIVE",
				},
			});

			if (!membership) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You don't have permission to add members to this group",
				});
			}

			// Check group capacity
			const group = await ctx.db.group.findUnique({
				where: { id: input.groupId },
				select: {
					maxMembers: true,
					_count: {
						select: {
							members: {
								where: {
									status: "ACTIVE",
								},
							},
						},
					},
				},
			});

			if (!group) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Group not found",
				});
			}

			const availableSlots = group.maxMembers - group._count.members;
			if (input.userIds.length > availableSlots) {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: `Group can only accept ${availableSlots} more members`,
				});
			}

			// Get existing members to avoid duplicates
			const existingMembers = await ctx.db.groupMember.findMany({
				where: {
					groupId: input.groupId,
					userId: { in: input.userIds },
				},
				select: { userId: true },
			});

			const existingUserIds = new Set(existingMembers.map((m) => m.userId));
			const newUserIds = input.userIds.filter((id) => !existingUserIds.has(id));

			// Add new members
			if (newUserIds.length > 0) {
				await ctx.db.groupMember.createMany({
					data: newUserIds.map((userId) => ({
						groupId: input.groupId,
						userId,
						role: input.role as GroupRole,
						status: "ACTIVE" as GroupMemberStatus,
					})),
				});
			}

			return {
				added: newUserIds.length,
				skipped: existingUserIds.size,
			};
		}),

	// Remove members from group
	removeMembers: protectedProcedure
		.input(
			z.object({
				groupId: z.string().cuid(),
				userIds: z.array(z.string().cuid()).min(1),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Check if user is owner or admin
			const membership = await ctx.db.groupMember.findFirst({
				where: {
					groupId: input.groupId,
					userId: ctx.session.user.id,
					role: { in: ["OWNER", "ADMIN"] },
					status: "ACTIVE",
				},
			});

			if (!membership) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message:
						"You don't have permission to remove members from this group",
				});
			}

			// Prevent owner from being removed
			const ownerCheck = await ctx.db.groupMember.findFirst({
				where: {
					groupId: input.groupId,
					userId: { in: input.userIds },
					role: "OWNER",
				},
			});

			if (ownerCheck) {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "Cannot remove the group owner",
				});
			}

			// Update member status to REMOVED
			const result = await ctx.db.groupMember.updateMany({
				where: {
					groupId: input.groupId,
					userId: { in: input.userIds },
					role: { not: "OWNER" },
				},
				data: {
					status: "REMOVED",
					leftAt: new Date(),
				},
			});

			return {
				removed: result.count,
			};
		}),

	// List groups for current user
	list: protectedProcedure
		.input(
			z.object({
				onlyOwned: z.boolean().default(false),
				isActive: z.boolean().optional(),
				limit: z.number().min(1).max(100).default(20),
				offset: z.number().min(0).default(0),
			}),
		)
		.query(async ({ ctx, input }) => {
			const where = {
				...(input.onlyOwned
					? { creatorId: ctx.session.user.id }
					: {
							members: {
								some: {
									userId: ctx.session.user.id,
									status: "ACTIVE" as GroupMemberStatus,
								},
							},
						}),
				...(input.isActive !== undefined && { isActive: input.isActive }),
			};

			const [groups, total] = await Promise.all([
				ctx.db.group.findMany({
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
						_count: {
							select: {
								members: {
									where: {
										status: "ACTIVE",
									},
								},
								generatedDiscussions: true,
							},
						},
					},
				}),
				ctx.db.group.count({ where }),
			]);

			return {
				groups,
				total,
				hasMore: input.offset + input.limit < total,
			};
		}),

	// Get group by ID with members
	getById: protectedProcedure
		.input(z.string().cuid())
		.query(async ({ ctx, input }) => {
			// Check if user is a member
			const membership = await ctx.db.groupMember.findFirst({
				where: {
					groupId: input,
					userId: ctx.session.user.id,
					status: "ACTIVE",
				},
			});

			if (!membership) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You don't have permission to view this group",
				});
			}

			const group = await ctx.db.group.findUnique({
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
					members: {
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
						orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
					},
					generatedDiscussions: {
						take: 5,
						orderBy: { createdAt: "desc" },
						select: {
							id: true,
							name: true,
							isActive: true,
							scheduledFor: true,
							_count: {
								select: {
									participants: true,
									messages: true,
								},
							},
						},
					},
				},
			});

			if (!group) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Group not found",
				});
			}

			return group;
		}),

	// Generate discussions from group
	generateDiscussions: protectedProcedure
		.input(generateDiscussionsSchema)
		.mutation(async ({ ctx, input }) => {
			// Check if user is owner or admin of the group
			const membership = await ctx.db.groupMember.findFirst({
				where: {
					groupId: input.groupId,
					userId: ctx.session.user.id,
					role: { in: ["OWNER", "ADMIN"] },
					status: "ACTIVE",
				},
			});

			if (!membership) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message:
						"You don't have permission to generate discussions for this group",
				});
			}

			// Get group with active members
			const group = await ctx.db.group.findUnique({
				where: { id: input.groupId },
				include: {
					members: {
						where: {
							status: "ACTIVE",
						},
						select: {
							userId: true,
						},
					},
				},
			});

			if (!group) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Group not found",
				});
			}

			// Check if lesson exists and is published
			const lesson = await ctx.db.lesson.findUnique({
				where: { id: input.lessonId },
				select: {
					isPublished: true,
					facilitationStyle: true,
					keyQuestions: true,
				},
			});

			if (!lesson) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Lesson not found",
				});
			}

			if (!lesson.isPublished) {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "Lesson must be published before creating discussions",
				});
			}

			// Get member IDs and shuffle if requested
			let memberIds = group.members.map((m) => m.userId);
			if (input.shuffleParticipants) {
				memberIds = shuffleArray(memberIds);
			}

			// Calculate number of discussions needed
			const groupSize = group.autoGroupSize;
			const numDiscussions = Math.ceil(memberIds.length / groupSize);

			// Create discussions in batches
			const discussions = [];
			for (let i = 0; i < numDiscussions; i++) {
				const startIdx = i * groupSize;
				const endIdx = Math.min(startIdx + groupSize, memberIds.length);
				const participantIds = memberIds.slice(startIdx, endIdx);

				const discussion = await ctx.db.discussion.create({
					data: {
						name: `${input.discussionNamePrefix} ${i + 1}`,
						description: `Auto-generated discussion from group: ${group.name}`,
						creatorId: ctx.session.user.id,
						lessonId: input.lessonId,
						sourceGroupId: input.groupId,
						maxParticipants: groupSize,
						joinCode: generateJoinCode(),
						scheduledFor: input.scheduledFor,
						expiresAt: input.expiresAt,
						aiConfig: {
							facilitationStyle: lesson.facilitationStyle,
							keyQuestions: lesson.keyQuestions,
						},
						systemPrompt: null,
						participants: {
							create: participantIds.map((userId) => ({
								userId,
								role:
									userId === ctx.session.user.id ? "CREATOR" : "PARTICIPANT",
								status: "ACTIVE",
							})),
						},
					},
					include: {
						_count: {
							select: {
								participants: true,
							},
						},
					},
				});

				discussions.push(discussion);
			}

			return {
				created: discussions.length,
				discussions: discussions.map((d) => ({
					id: d.id,
					name: d.name,
					joinCode: d.joinCode,
					participantCount: d._count.participants,
				})),
			};
		}),
});
