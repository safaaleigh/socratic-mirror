/**
 * Invitation API Contract
 * tRPC router procedures for invitation management
 */

import { z } from "zod";

// ==================== Input Schemas ====================

export const SendInvitationsInput = z.object({
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

export const CreateInvitationLinkInput = z.object({
	discussionId: z.string().cuid(),
	expiresInDays: z.number().int().min(1).max(30).default(7),
	maxUses: z.number().int().min(1).max(100).optional(),
});

export const AcceptInvitationInput = z.object({
	token: z.string().cuid(),
	createAccount: z
		.object({
			name: z.string().min(1).max(100),
			email: z.string().email(),
		})
		.optional(),
});

export const DeclineInvitationInput = z.object({
	token: z.string().cuid(),
});

export const CancelInvitationInput = z.object({
	invitationId: z.string().cuid(),
});

export const ResendInvitationInput = z.object({
	invitationId: z.string().cuid(),
});

export const GetInvitationInput = z.object({
	token: z.string().cuid(),
});

export const ListInvitationsInput = z.object({
	discussionId: z.string().cuid().optional(),
	status: z
		.enum(["PENDING", "ACCEPTED", "DECLINED", "EXPIRED", "CANCELLED"])
		.optional(),
	limit: z.number().int().min(1).max(100).default(20),
	cursor: z.string().optional(),
});

// ==================== Output Schemas ====================

export const InvitationOutput = z.object({
	id: z.string(),
	type: z.enum(["DISCUSSION", "GROUP"]),
	targetId: z.string(),
	recipientEmail: z.string(),
	recipientId: z.string().nullable(),
	senderId: z.string(),
	sender: z.object({
		id: z.string(),
		name: z.string().nullable(),
		email: z.string(),
	}),
	message: z.string().nullable(),
	token: z.string(),
	status: z.enum(["PENDING", "ACCEPTED", "DECLINED", "EXPIRED", "CANCELLED"]),
	expiresAt: z.date(),
	acceptedAt: z.date().nullable(),
	declinedAt: z.date().nullable(),
	createdAt: z.date(),
	discussion: z
		.object({
			id: z.string(),
			name: z.string(),
			description: z.string().nullable(),
			lesson: z
				.object({
					title: z.string(),
					description: z.string().nullable(),
				})
				.nullable(),
		})
		.optional(),
});

export const InvitationLinkOutput = z.object({
	url: z.string().url(),
	token: z.string(),
	expiresAt: z.date(),
	maxUses: z.number().nullable(),
	currentUses: z.number(),
});

export const SendInvitationsOutput = z.object({
	sent: z.array(
		z.object({
			email: z.string(),
			invitationId: z.string(),
			status: z.enum(["sent", "failed"]),
			error: z.string().optional(),
		}),
	),
	totalSent: z.number(),
	totalFailed: z.number(),
});

export const InvitationListOutput = z.object({
	invitations: z.array(InvitationOutput),
	nextCursor: z.string().optional(),
	hasMore: z.boolean(),
});

export const AcceptInvitationOutput = z.object({
	discussion: z.object({
		id: z.string(),
		name: z.string(),
	}),
	userId: z.string(),
	accountCreated: z.boolean(),
});

// ==================== Router Definition ====================

export const invitationRouter = {
	// Send email invitations to multiple recipients
	sendInvitations: {
		input: SendInvitationsInput,
		output: SendInvitationsOutput,
	},

	// Create a shareable invitation link
	createLink: {
		input: CreateInvitationLinkInput,
		output: InvitationLinkOutput,
	},

	// Get invitation details by token
	getByToken: {
		input: GetInvitationInput,
		output: InvitationOutput,
	},

	// Accept an invitation
	accept: {
		input: AcceptInvitationInput,
		output: AcceptInvitationOutput,
	},

	// Decline an invitation
	decline: {
		input: DeclineInvitationInput,
		output: z.object({
			success: z.boolean(),
		}),
	},

	// Cancel a pending invitation (sender only)
	cancel: {
		input: CancelInvitationInput,
		output: z.object({
			success: z.boolean(),
		}),
	},

	// Resend an invitation email
	resend: {
		input: ResendInvitationInput,
		output: z.object({
			success: z.boolean(),
		}),
	},

	// List invitations for a discussion
	list: {
		input: ListInvitationsInput,
		output: InvitationListOutput,
	},

	// Check if an invitation is valid
	validate: {
		input: GetInvitationInput,
		output: z.object({
			valid: z.boolean(),
			reason: z.string().optional(),
			discussion: z
				.object({
					id: z.string(),
					name: z.string(),
					participantCount: z.number(),
					maxParticipants: z.number(),
				})
				.optional(),
		}),
	},
};
