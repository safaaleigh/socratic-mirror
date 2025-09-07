import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "@/server/api/trpc";
import { emailService } from "@/server/services/email";
import { getWebSocketService } from "@/server/services/websocket";
import type { InvitationStatus, ParticipantRole } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

// Contract-compliant validation schemas
const sendInvitationsSchema = z.object({
	discussionId: z.string().cuid(),
	invitations: z
		.array(
			z.object({
				email: z.string().email(),
				personalMessage: z.string().max(500).optional(),
			}),
		)
		.min(1)
		.max(50),
	expiresInDays: z.number().int().min(1).max(30).default(7),
});

const createLinkSchema = z.object({
	discussionId: z.string().cuid(),
	expiresInDays: z.number().int().min(1).max(30).default(7),
	maxUses: z.number().int().min(1).max(100).optional(),
});

const acceptInvitationSchema = z.object({
	token: z.string().cuid(),
	createAccount: z
		.object({
			name: z.string().min(1).max(100),
			email: z.string().email(),
		})
		.optional(),
});

const listInvitationsSchema = z.object({
	discussionId: z.string().cuid().optional(),
	status: z
		.enum(["PENDING", "ACCEPTED", "DECLINED", "EXPIRED", "CANCELLED"])
		.optional(),
	limit: z.number().int().min(1).max(100).default(20),
	cursor: z.string().optional(),
});

// Helper functions
function formatInvitationOutput(invitation: any) {
	return {
		id: invitation.id,
		type: invitation.type,
		targetId: invitation.targetId,
		recipientEmail: invitation.recipientEmail,
		recipientId: invitation.recipientId,
		senderId: invitation.senderId,
		sender: invitation.sender,
		message: invitation.message,
		token: invitation.token,
		status: invitation.status,
		expiresAt: invitation.expiresAt,
		acceptedAt: invitation.acceptedAt,
		declinedAt: invitation.declinedAt,
		createdAt: invitation.createdAt,
		discussion: invitation.discussion,
	};
}

async function checkDiscussionPermission(
	db: any,
	userId: string,
	discussionId: string,
) {
	// Check if user is creator or moderator of the discussion
	const participant = await db.discussionParticipant.findFirst({
		where: {
			discussionId,
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
		where: { id: discussionId },
		select: {
			id: true,
			name: true,
			description: true,
			isActive: true,
			maxParticipants: true,
			lesson: {
				select: {
					title: true,
					description: true,
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

	if (!discussion.isActive) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "Discussion is not active",
		});
	}

	return discussion;
}

export const invitationRouter = createTRPCRouter({
	// Send email invitations to multiple recipients
	sendInvitations: protectedProcedure
		.input(sendInvitationsSchema)
		.mutation(async ({ ctx, input }) => {
			// Check permissions and get discussion info
			const discussion = await checkDiscussionPermission(
				ctx.db,
				ctx.session.user.id,
				input.discussionId,
			);

			// Check available slots
			const availableSlots =
				discussion.maxParticipants - discussion._count.participants;
			if (input.invitations.length > availableSlots) {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: `Only ${availableSlots} slots available in this discussion`,
				});
			}

			const expiresAt = new Date();
			expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);

			const results: Array<{
				email: string;
				invitationId: string;
				status: "sent" | "failed";
				error?: string;
			}> = [];

			// Process each invitation
			for (const inviteData of input.invitations) {
				try {
					// Check for existing user
					const existingUser = await ctx.db.user.findUnique({
						where: { email: inviteData.email },
						select: { id: true },
					});

					// Check for existing pending invitation
					const existingInvite = await ctx.db.invitation.findFirst({
						where: {
							type: "DISCUSSION",
							targetId: input.discussionId,
							recipientEmail: inviteData.email,
							status: "PENDING",
							expiresAt: { gt: new Date() },
						},
					});

					if (existingInvite) {
						results.push({
							email: inviteData.email,
							invitationId: existingInvite.id,
							status: "failed",
							error: "Pending invitation already exists",
						});
						continue;
					}

					// Check if user is already a participant
					if (existingUser) {
						const existingParticipant =
							await ctx.db.discussionParticipant.findFirst({
								where: {
									discussionId: input.discussionId,
									userId: existingUser.id,
									status: "ACTIVE",
								},
							});

						if (existingParticipant) {
							results.push({
								email: inviteData.email,
								invitationId: "",
								status: "failed",
								error: "User is already a participant",
							});
							continue;
						}
					}

					// Create invitation
					const invitation = await ctx.db.invitation.create({
						data: {
							type: "DISCUSSION",
							targetId: input.discussionId,
							recipientEmail: inviteData.email,
							recipientId: existingUser?.id,
							senderId: ctx.session.user.id,
							message: inviteData.personalMessage,
							status: "PENDING" as InvitationStatus,
							expiresAt,
						},
					});

					// Send email
					try {
						await emailService.sendSingleInvitation({
							invitationId: invitation.id,
							recipientEmail: inviteData.email,
							senderName: ctx.session.user.name || "A discussion creator",
							discussionName: discussion.name,
							lessonTitle: discussion.lesson?.title,
							message: inviteData.personalMessage,
							joinUrl: `${process.env.NEXTAUTH_URL}/invitations/${invitation.token}`,
							expiresAt,
						});

						results.push({
							email: inviteData.email,
							invitationId: invitation.id,
							status: "sent",
						});
					} catch (emailError) {
						// Mark invitation as failed but keep the record
						await ctx.db.invitation.update({
							where: { id: invitation.id },
							data: { status: "CANCELLED" },
						});

						results.push({
							email: inviteData.email,
							invitationId: invitation.id,
							status: "failed",
							error: "Failed to send email",
						});
					}
				} catch (error) {
					results.push({
						email: inviteData.email,
						invitationId: "",
						status: "failed",
						error: "Database error",
					});
				}
			}

			const totalSent = results.filter((r) => r.status === "sent").length;
			const totalFailed = results.filter((r) => r.status === "failed").length;

			return {
				sent: results,
				totalSent,
				totalFailed,
			};
		}),

	// Create a shareable invitation link
	createLink: protectedProcedure
		.input(createLinkSchema)
		.mutation(async ({ ctx, input }) => {
			// Check permissions and get discussion info
			const discussion = await checkDiscussionPermission(
				ctx.db,
				ctx.session.user.id,
				input.discussionId,
			);

			const expiresAt = new Date();
			expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);

			// Create link invitation
			const invitation = await ctx.db.invitation.create({
				data: {
					type: "DISCUSSION",
					targetId: input.discussionId,
					recipientEmail: "", // Empty for link-based invitations
					senderId: ctx.session.user.id,
					status: "PENDING" as InvitationStatus,
					expiresAt,
					maxUses: input.maxUses,
					isLink: true,
				},
			});

			const url = `${process.env.NEXTAUTH_URL}/invitations/${invitation.token}`;

			return {
				url,
				token: invitation.token,
				expiresAt,
				maxUses: input.maxUses || null,
				currentUses: 0,
			};
		}),

	// Get invitation details by token (public for non-authenticated access)
	getByToken: publicProcedure
		.input(z.object({ token: z.string().cuid() }))
		.query(async ({ ctx, input }) => {
			const invitation = await ctx.db.invitation.findUnique({
				where: { token: input.token },
				include: {
					sender: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
					discussion: {
						select: {
							id: true,
							name: true,
							description: true,
							lesson: {
								select: {
									title: true,
									description: true,
								},
							},
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

			return formatInvitationOutput(invitation);
		}),

	// Accept an invitation
	accept: protectedProcedure
		.input(acceptInvitationSchema)
		.mutation(async ({ ctx, input }) => {
			const invitation = await ctx.db.invitation.findUnique({
				where: { token: input.token },
				include: {
					discussion: {
						select: {
							id: true,
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
					},
				},
			});

			if (!invitation) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Invitation not found",
				});
			}

			// Check if this is an email-based invitation
			if (
				!invitation.isLink &&
				invitation.recipientEmail !== ctx.session.user.email
			) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "This invitation is not for your email address",
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

			// Check discussion capacity
			if (
				invitation.discussion!._count.participants >=
				invitation.discussion!.maxParticipants
			) {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "Discussion is full",
				});
			}

			// Check if user is already a participant
			const existingParticipant = await ctx.db.discussionParticipant.findFirst({
				where: {
					discussionId: invitation.targetId,
					userId: ctx.session.user.id,
				},
			});

			let accountCreated = false;

			// Handle account creation if needed
			if (input.createAccount) {
				// This would be for future use when we support guest accounts
				accountCreated = false; // For now, always false since we use Discord auth
			}

			// Add user as participant or reactivate
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
				await ctx.db.discussionParticipant.update({
					where: { id: existingParticipant.id },
					data: {
						status: "ACTIVE",
						leftAt: null,
					},
				});
			}

			// Update invitation status
			await ctx.db.invitation.update({
				where: { id: invitation.id },
				data: {
					status: "ACCEPTED" as InvitationStatus,
					acceptedAt: new Date(),
					recipientId: ctx.session.user.id,
					...(invitation.isLink && { usageCount: { increment: 1 } }),
				},
			});

			// Create system message
			await ctx.db.message.create({
				data: {
					discussionId: invitation.targetId,
					content: `${ctx.session.user.name || "A participant"} joined the discussion`,
					type: "SYSTEM",
				},
			});

			// Broadcast to WebSocket if available
			const wsService = getWebSocketService();
			if (wsService) {
				wsService.broadcastToDiscussion(invitation.targetId, {
					type: "user_joined",
					discussionId: invitation.targetId,
					data: {
						user: { id: ctx.session.user.id, name: ctx.session.user.name },
					},
					timestamp: Date.now(),
				});
			}

			return {
				discussion: {
					id: invitation.discussion!.id,
					name: invitation.discussion!.name,
				},
				userId: ctx.session.user.id,
				accountCreated,
			};
		}),

	// Decline an invitation
	decline: protectedProcedure
		.input(z.object({ token: z.string().cuid() }))
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

			// Check if this is an email-based invitation
			if (
				!invitation.isLink &&
				invitation.recipientEmail !== ctx.session.user.email
			) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "This invitation is not for your email address",
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

			return { success: true };
		}),

	// Cancel a pending invitation (sender only)
	cancel: protectedProcedure
		.input(z.object({ invitationId: z.string().cuid() }))
		.mutation(async ({ ctx, input }) => {
			const invitation = await ctx.db.invitation.findUnique({
				where: { id: input.invitationId },
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

			return { success: true };
		}),

	// Resend an invitation email
	resend: protectedProcedure
		.input(z.object({ invitationId: z.string().cuid() }))
		.mutation(async ({ ctx, input }) => {
			const invitation = await ctx.db.invitation.findUnique({
				where: { id: input.invitationId },
				include: {
					discussion: {
						select: {
							name: true,
							lesson: {
								select: {
									title: true,
								},
							},
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

			// Check if user is the sender
			if (invitation.senderId !== ctx.session.user.id) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You can only resend invitations you sent",
				});
			}

			// Check status
			if (invitation.status !== "PENDING") {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "Can only resend pending invitations",
				});
			}

			// Check if expired
			if (invitation.expiresAt < new Date()) {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "Cannot resend expired invitation",
				});
			}

			// Resend email
			await emailService.resendInvitation({
				invitationId: invitation.id,
				recipientEmail: invitation.recipientEmail,
				senderName: ctx.session.user.name || "A discussion creator",
				discussionName: invitation.discussion!.name,
				lessonTitle: invitation.discussion!.lesson?.title,
				message: invitation.message,
				joinUrl: `${process.env.NEXTAUTH_URL}/invitations/${invitation.token}`,
				expiresAt: invitation.expiresAt,
			});

			return { success: true };
		}),

	// List invitations for a discussion
	list: protectedProcedure
		.input(listInvitationsSchema)
		.query(async ({ ctx, input }) => {
			const where: any = {};

			if (input.discussionId) {
				// Check if user has permission to view invitations for this discussion
				await checkDiscussionPermission(
					ctx.db,
					ctx.session.user.id,
					input.discussionId,
				);
				where.targetId = input.discussionId;
				where.type = "DISCUSSION";
			} else {
				// Show invitations sent by this user
				where.senderId = ctx.session.user.id;
			}

			if (input.status) {
				where.status = input.status;
			}

			if (input.cursor) {
				where.id = { lt: input.cursor };
			}

			const invitations = await ctx.db.invitation.findMany({
				where,
				take: input.limit + 1, // Take one extra to check if there are more
				orderBy: { createdAt: "desc" },
				include: {
					sender: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
					discussion: {
						select: {
							id: true,
							name: true,
							description: true,
							lesson: {
								select: {
									title: true,
									description: true,
								},
							},
						},
					},
				},
			});

			let hasMore = false;
			if (invitations.length > input.limit) {
				invitations.pop();
				hasMore = true;
			}

			return {
				invitations: invitations.map(formatInvitationOutput),
				nextCursor: invitations[invitations.length - 1]?.id,
				hasMore,
			};
		}),

	// Check if an invitation is valid
	validate: publicProcedure
		.input(z.object({ token: z.string().cuid() }))
		.query(async ({ ctx, input }) => {
			const invitation = await ctx.db.invitation.findUnique({
				where: { token: input.token },
				include: {
					discussion: {
						select: {
							id: true,
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
					},
				},
			});

			if (!invitation) {
				return {
					valid: false,
					reason: "Invitation not found",
				};
			}

			if (invitation.status !== "PENDING") {
				return {
					valid: false,
					reason: `Invitation is ${invitation.status.toLowerCase()}`,
				};
			}

			if (invitation.expiresAt < new Date()) {
				return {
					valid: false,
					reason: "Invitation has expired",
				};
			}

			if (!invitation.discussion?.isActive) {
				return {
					valid: false,
					reason: "Discussion is not active",
				};
			}

			const participantCount = invitation.discussion._count.participants;
			if (participantCount >= invitation.discussion.maxParticipants) {
				return {
					valid: false,
					reason: "Discussion is full",
				};
			}

			return {
				valid: true,
				discussion: {
					id: invitation.discussion.id,
					name: invitation.discussion.name,
					participantCount,
					maxParticipants: invitation.discussion.maxParticipants,
				},
			};
		}),
});
