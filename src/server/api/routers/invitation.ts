import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import type {
	GroupRole,
	InvitationStatus,
	InvitationType,
	ParticipantRole,
} from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

// Validation schemas
const createInvitationSchema = z.object({
	type: z.enum(["GROUP", "DISCUSSION"]),
	targetId: z.string().cuid(),
	recipientEmail: z.string().email(),
	message: z.string().max(500).optional(),
	expiresIn: z.number().min(1).max(30).default(7), // Days until expiration
});

const createBatchInvitationsSchema = z.object({
	type: z.enum(["GROUP", "DISCUSSION"]),
	targetId: z.string().cuid(),
	recipientEmails: z.array(z.string().email()).min(1).max(50),
	message: z.string().max(500).optional(),
	expiresIn: z.number().min(1).max(30).default(7),
});

const acceptInvitationSchema = z.object({
	token: z.string(),
});

// Helper to check permission to invite
async function checkInvitePermission(
	db: any,
	userId: string,
	type: InvitationType,
	targetId: string,
) {
	if (type === "GROUP") {
		// Check if user is owner or admin of the group
		const membership = await db.groupMember.findFirst({
			where: {
				groupId: targetId,
				userId,
				role: { in: ["OWNER", "ADMIN"] },
				status: "ACTIVE",
			},
		});

		if (!membership) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "You don't have permission to invite to this group",
			});
		}

		// Get group info for validation
		const group = await db.group.findUnique({
			where: { id: targetId },
			select: {
				name: true,
				isActive: true,
				maxMembers: true,
				_count: {
					select: {
						members: {
							where: { status: "ACTIVE" },
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

		if (!group.isActive) {
			throw new TRPCError({
				code: "PRECONDITION_FAILED",
				message: "Group is not active",
			});
		}

		return group;
	} else {
		// Check if user is creator or moderator of the discussion
		const participant = await db.discussionParticipant.findFirst({
			where: {
				discussionId: targetId,
				userId,
				role: { in: ["CREATOR", "MODERATOR"] },
				status: "ACTIVE",
			},
		});

		if (!participant) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "You don't have permission to invite to this discussion",
			});
		}

		// Get discussion info for validation
		const discussion = await db.discussion.findUnique({
			where: { id: targetId },
			select: {
				name: true,
				isActive: true,
				maxParticipants: true,
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

		if (!discussion.isActive) {
			throw new TRPCError({
				code: "PRECONDITION_FAILED",
				message: "Discussion is not active",
			});
		}

		return discussion;
	}
}

export const invitationRouter = createTRPCRouter({
	// Create a single invitation
	create: protectedProcedure
		.input(createInvitationSchema)
		.mutation(async ({ ctx, input }) => {
			// Check permission and get target info
			const target = await checkInvitePermission(
				ctx.db,
				ctx.session.user.id,
				input.type as InvitationType,
				input.targetId,
			);

			// Check for existing user with this email
			const existingUser = await ctx.db.user.findUnique({
				where: { email: input.recipientEmail },
				select: { id: true },
			});

			// Check for existing pending invitation
			const existingInvite = await ctx.db.invitation.findFirst({
				where: {
					type: input.type,
					targetId: input.targetId,
					recipientEmail: input.recipientEmail,
					status: "PENDING",
					expiresAt: { gt: new Date() },
				},
			});

			if (existingInvite) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "An invitation already exists for this email",
				});
			}

			// Check if user is already a member
			if (existingUser) {
				if (input.type === "GROUP") {
					const existingMember = await ctx.db.groupMember.findFirst({
						where: {
							groupId: input.targetId,
							userId: existingUser.id,
							status: "ACTIVE",
						},
					});

					if (existingMember) {
						throw new TRPCError({
							code: "CONFLICT",
							message: "User is already a member of this group",
						});
					}
				} else {
					const existingParticipant =
						await ctx.db.discussionParticipant.findFirst({
							where: {
								discussionId: input.targetId,
								userId: existingUser.id,
								status: "ACTIVE",
							},
						});

					if (existingParticipant) {
						throw new TRPCError({
							code: "CONFLICT",
							message: "User is already a participant in this discussion",
						});
					}
				}
			}

			// Create invitation
			const invitation = await ctx.db.invitation.create({
				data: {
					type: input.type as InvitationType,
					targetId: input.targetId,
					recipientEmail: input.recipientEmail,
					recipientId: existingUser?.id,
					senderId: ctx.session.user.id,
					message: input.message,
					status: "PENDING" as InvitationStatus,
					expiresAt: new Date(
						Date.now() + input.expiresIn * 24 * 60 * 60 * 1000,
					),
				},
				include: {
					sender: {
						select: {
							name: true,
							email: true,
						},
					},
				},
			});

			// TODO: Send email notification
			// await sendInvitationEmail(invitation);

			return invitation;
		}),

	// Create batch invitations
	createBatch: protectedProcedure
		.input(createBatchInvitationsSchema)
		.mutation(async ({ ctx, input }) => {
			// Check permission and get target info
			const target = await checkInvitePermission(
				ctx.db,
				ctx.session.user.id,
				input.type as InvitationType,
				input.targetId,
			);

			// Check capacity
			const maxCapacity =
				input.type === "GROUP"
					? (target as any).maxMembers
					: (target as any).maxParticipants;
			const currentCount =
				(target as any)._count.members || (target as any)._count.participants;
			const availableSlots = maxCapacity - currentCount;

			if (input.recipientEmails.length > availableSlots) {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: `Only ${availableSlots} slots available`,
				});
			}

			// Get existing users
			const existingUsers = await ctx.db.user.findMany({
				where: {
					email: { in: input.recipientEmails },
				},
				select: {
					id: true,
					email: true,
				},
			});

			const userMap = new Map(existingUsers.map((u) => [u.email, u.id]));

			// Check for existing invitations and memberships
			const existingInvites = await ctx.db.invitation.findMany({
				where: {
					type: input.type,
					targetId: input.targetId,
					recipientEmail: { in: input.recipientEmails },
					status: "PENDING",
					expiresAt: { gt: new Date() },
				},
				select: { recipientEmail: true },
			});

			const existingInviteEmails = new Set(
				existingInvites.map((i) => i.recipientEmail),
			);

			// Filter out emails that already have invitations
			const validEmails = input.recipientEmails.filter(
				(email) => !existingInviteEmails.has(email),
			);

			if (validEmails.length === 0) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "All recipients already have pending invitations",
				});
			}

			// Create invitations
			const expiresAt = new Date(
				Date.now() + input.expiresIn * 24 * 60 * 60 * 1000,
			);
			const invitations = await ctx.db.invitation.createMany({
				data: validEmails.map((email) => ({
					type: input.type as InvitationType,
					targetId: input.targetId,
					recipientEmail: email,
					recipientId: userMap.get(email) || null,
					senderId: ctx.session.user.id,
					message: input.message,
					status: "PENDING" as InvitationStatus,
					expiresAt,
				})),
			});

			// TODO: Send batch email notifications
			// await sendBatchInvitationEmails(invitations);

			return {
				sent: invitations.count,
				skipped: input.recipientEmails.length - invitations.count,
			};
		}),

	// Get invitation by token
	getByToken: protectedProcedure
		.input(z.string())
		.query(async ({ ctx, input }) => {
			const invitation = await ctx.db.invitation.findUnique({
				where: { token: input },
				include: {
					sender: {
						select: {
							id: true,
							name: true,
							email: true,
							image: true,
						},
					},
				},
			});

			if (!invitation) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Invitation not found",
				});
			}

			// Check if invitation is for current user
			if (invitation.recipientEmail !== ctx.session.user.email) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "This invitation is not for you",
				});
			}

			// Check if expired
			if (invitation.expiresAt < new Date()) {
				// Update status if not already expired
				if (invitation.status === "PENDING") {
					await ctx.db.invitation.update({
						where: { id: invitation.id },
						data: { status: "EXPIRED" },
					});
				}
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "Invitation has expired",
				});
			}

			// Get target details
			let targetDetails;
			if (invitation.type === "GROUP") {
				targetDetails = await ctx.db.group.findUnique({
					where: { id: invitation.targetId },
					select: {
						id: true,
						name: true,
						description: true,
						_count: {
							select: {
								members: {
									where: { status: "ACTIVE" },
								},
							},
						},
					},
				});
			} else {
				targetDetails = await ctx.db.discussion.findUnique({
					where: { id: invitation.targetId },
					select: {
						id: true,
						name: true,
						description: true,
						lesson: {
							select: {
								title: true,
								objectives: true,
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
			}

			return {
				...invitation,
				targetDetails,
			};
		}),

	// Accept invitation
	accept: protectedProcedure
		.input(acceptInvitationSchema)
		.mutation(async ({ ctx, input }) => {
			const invitation = await ctx.db.invitation.findUnique({
				where: { token: input.token },
			});

			if (!invitation) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Invitation not found",
				});
			}

			// Verify invitation is for current user
			if (invitation.recipientEmail !== ctx.session.user.email) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "This invitation is not for you",
				});
			}

			// Check status
			if (invitation.status !== "PENDING") {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: `Invitation is already ${invitation.status.toLowerCase()}`,
				});
			}

			// Check expiration
			if (invitation.expiresAt < new Date()) {
				await ctx.db.invitation.update({
					where: { id: invitation.id },
					data: { status: "EXPIRED" },
				});
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "Invitation has expired",
				});
			}

			// Add user to group or discussion
			if (invitation.type === "GROUP") {
				// Check if already a member
				const existingMember = await ctx.db.groupMember.findFirst({
					where: {
						groupId: invitation.targetId,
						userId: ctx.session.user.id,
					},
				});

				if (!existingMember) {
					await ctx.db.groupMember.create({
						data: {
							groupId: invitation.targetId,
							userId: ctx.session.user.id,
							role: "MEMBER" as GroupRole,
							status: "ACTIVE",
						},
					});
				} else if (existingMember.status !== "ACTIVE") {
					// Reactivate membership
					await ctx.db.groupMember.update({
						where: { id: existingMember.id },
						data: {
							status: "ACTIVE",
							leftAt: null,
						},
					});
				}
			} else {
				// Check if already a participant
				const existingParticipant =
					await ctx.db.discussionParticipant.findFirst({
						where: {
							discussionId: invitation.targetId,
							userId: ctx.session.user.id,
						},
					});

				if (!existingParticipant) {
					await ctx.db.discussionParticipant.create({
						data: {
							discussionId: invitation.targetId,
							userId: ctx.session.user.id,
							role: "PARTICIPANT" as ParticipantRole,
							status: "ACTIVE",
						},
					});
				} else if (existingParticipant.status !== "ACTIVE") {
					// Reactivate participation
					await ctx.db.discussionParticipant.update({
						where: { id: existingParticipant.id },
						data: {
							status: "ACTIVE",
							leftAt: null,
						},
					});
				}
			}

			// Update invitation status
			const updatedInvitation = await ctx.db.invitation.update({
				where: { id: invitation.id },
				data: {
					status: "ACCEPTED" as InvitationStatus,
					acceptedAt: new Date(),
					recipientId: ctx.session.user.id,
				},
			});

			return {
				accepted: true,
				type: invitation.type,
				targetId: invitation.targetId,
			};
		}),

	// Decline invitation
	decline: protectedProcedure
		.input(z.string())
		.mutation(async ({ ctx, input }) => {
			const invitation = await ctx.db.invitation.findUnique({
				where: { token: input },
			});

			if (!invitation) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Invitation not found",
				});
			}

			// Verify invitation is for current user
			if (invitation.recipientEmail !== ctx.session.user.email) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "This invitation is not for you",
				});
			}

			// Check status
			if (invitation.status !== "PENDING") {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: `Invitation is already ${invitation.status.toLowerCase()}`,
				});
			}

			// Update invitation status
			await ctx.db.invitation.update({
				where: { id: invitation.id },
				data: {
					status: "DECLINED" as InvitationStatus,
					declinedAt: new Date(),
				},
			});

			return { declined: true };
		}),

	// Cancel invitation (for sender)
	cancel: protectedProcedure
		.input(z.string().cuid())
		.mutation(async ({ ctx, input }) => {
			const invitation = await ctx.db.invitation.findUnique({
				where: { id: input },
			});

			if (!invitation) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Invitation not found",
				});
			}

			// Check if user is the sender
			if (invitation.senderId !== ctx.session.user.id) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You can only cancel invitations you sent",
				});
			}

			// Check status
			if (invitation.status !== "PENDING") {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: `Cannot cancel ${invitation.status.toLowerCase()} invitation`,
				});
			}

			// Update invitation status
			await ctx.db.invitation.update({
				where: { id: invitation.id },
				data: {
					status: "CANCELLED" as InvitationStatus,
				},
			});

			return { cancelled: true };
		}),

	// List sent invitations
	listSent: protectedProcedure
		.input(
			z.object({
				type: z.enum(["GROUP", "DISCUSSION"]).optional(),
				status: z
					.enum(["PENDING", "ACCEPTED", "DECLINED", "EXPIRED", "CANCELLED"])
					.optional(),
				limit: z.number().min(1).max(100).default(20),
				offset: z.number().min(0).default(0),
			}),
		)
		.query(async ({ ctx, input }) => {
			const where = {
				senderId: ctx.session.user.id,
				...(input.type && { type: input.type }),
				...(input.status && { status: input.status }),
			};

			const [invitations, total] = await Promise.all([
				ctx.db.invitation.findMany({
					where,
					take: input.limit,
					skip: input.offset,
					orderBy: { createdAt: "desc" },
					include: {
						recipient: {
							select: {
								id: true,
								name: true,
								email: true,
								image: true,
							},
						},
					},
				}),
				ctx.db.invitation.count({ where }),
			]);

			return {
				invitations,
				total,
				hasMore: input.offset + input.limit < total,
			};
		}),

	// List received invitations
	listReceived: protectedProcedure
		.input(
			z.object({
				type: z.enum(["GROUP", "DISCUSSION"]).optional(),
				status: z
					.enum(["PENDING", "ACCEPTED", "DECLINED", "EXPIRED", "CANCELLED"])
					.optional(),
				limit: z.number().min(1).max(100).default(20),
				offset: z.number().min(0).default(0),
			}),
		)
		.query(async ({ ctx, input }) => {
			const where = {
				recipientEmail: ctx.session.user.email!,
				...(input.type && { type: input.type }),
				...(input.status && { status: input.status }),
			};

			const [invitations, total] = await Promise.all([
				ctx.db.invitation.findMany({
					where,
					take: input.limit,
					skip: input.offset,
					orderBy: { createdAt: "desc" },
					include: {
						sender: {
							select: {
								id: true,
								name: true,
								email: true,
								image: true,
							},
						},
					},
				}),
				ctx.db.invitation.count({ where }),
			]);

			// Get target details for each invitation
			const invitationsWithDetails = await Promise.all(
				invitations.map(async (invitation) => {
					let targetDetails;
					if (invitation.type === "GROUP") {
						targetDetails = await ctx.db.group.findUnique({
							where: { id: invitation.targetId },
							select: {
								name: true,
								description: true,
							},
						});
					} else {
						targetDetails = await ctx.db.discussion.findUnique({
							where: { id: invitation.targetId },
							select: {
								name: true,
								description: true,
							},
						});
					}
					return {
						...invitation,
						targetDetails,
					};
				}),
			);

			return {
				invitations: invitationsWithDetails,
				total,
				hasMore: input.offset + input.limit < total,
			};
		}),
});
