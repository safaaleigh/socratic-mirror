/**
 * Discussion API Contract
 * tRPC router procedures for discussion management
 */

import { z } from "zod";

// ==================== Input Schemas ====================

export const CreateDiscussionInput = z.object({
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

export const UpdateDiscussionInput = z.object({
	id: z.string().cuid(),
	name: z.string().min(1).max(100).optional(),
	description: z.string().optional(),
	maxParticipants: z.number().int().min(1).max(1000).optional(),
	isPublic: z.boolean().optional(),
	scheduledFor: z.date().optional(),
	expiresAt: z.date().optional(),
});

export const CloseDiscussionInput = z.object({
	id: z.string().cuid(),
});

export const GetDiscussionInput = z.object({
	id: z.string().cuid(),
});

export const ListDiscussionsInput = z.object({
	role: z.enum(["creator", "participant", "all"]).optional(),
	isActive: z.boolean().optional(),
	limit: z.number().int().min(1).max(100).default(20),
	cursor: z.string().optional(),
});

export const GenerateJoinCodeInput = z.object({
	discussionId: z.string().cuid(),
});

export const JoinDiscussionInput = z.object({
	discussionId: z.string().cuid().optional(),
	joinCode: z.string().length(8).optional(),
	password: z.string().optional(),
});

export const LeaveDiscussionInput = z.object({
	discussionId: z.string().cuid(),
});

export const RemoveParticipantInput = z.object({
	discussionId: z.string().cuid(),
	participantId: z.string().cuid(),
	reason: z.string().optional(),
});

export const UpdateParticipantRoleInput = z.object({
	discussionId: z.string().cuid(),
	participantId: z.string().cuid(),
	role: z.enum(["MODERATOR", "PARTICIPANT"]),
});

// ==================== Output Schemas ====================

export const DiscussionOutput = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	creatorId: z.string(),
	creator: z.object({
		id: z.string(),
		name: z.string().nullable(),
		email: z.string(),
		image: z.string().nullable(),
	}),
	lessonId: z.string().nullable(),
	lesson: z
		.object({
			id: z.string(),
			title: z.string(),
			description: z.string().nullable(),
			objectives: z.array(z.string()),
			facilitationStyle: z.string(),
		})
		.nullable(),
	isActive: z.boolean(),
	isPublic: z.boolean(),
	maxParticipants: z.number(),
	participantCount: z.number(),
	joinCode: z.string().nullable(),
	hasPassword: z.boolean(),
	scheduledFor: z.date().nullable(),
	expiresAt: z.date().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
	closedAt: z.date().nullable(),
	userRole: z.enum(["CREATOR", "MODERATOR", "PARTICIPANT"]).nullable(),
});

export const ParticipantOutput = z.object({
	id: z.string(),
	userId: z.string(),
	user: z.object({
		id: z.string(),
		name: z.string().nullable(),
		email: z.string(),
		image: z.string().nullable(),
	}),
	role: z.enum(["CREATOR", "MODERATOR", "PARTICIPANT"]),
	status: z.enum(["ACTIVE", "INACTIVE", "REMOVED", "LEFT"]),
	joinedAt: z.date(),
	leftAt: z.date().nullable(),
	lastSeenAt: z.date(),
	messageCount: z.number(),
});

export const DiscussionListOutput = z.object({
	discussions: z.array(DiscussionOutput),
	nextCursor: z.string().optional(),
	hasMore: z.boolean(),
});

export const JoinDiscussionOutput = z.object({
	discussion: DiscussionOutput,
	participant: ParticipantOutput,
});

// ==================== Router Definition ====================

export const discussionRouter = {
	// Create a new discussion from a lesson
	create: {
		input: CreateDiscussionInput,
		output: DiscussionOutput,
	},

	// Update discussion details (creator only)
	update: {
		input: UpdateDiscussionInput,
		output: DiscussionOutput,
	},

	// Close a discussion (creator only)
	close: {
		input: CloseDiscussionInput,
		output: DiscussionOutput,
	},

	// Get discussion details
	getById: {
		input: GetDiscussionInput,
		output: DiscussionOutput,
	},

	// List discussions (filtered by role)
	list: {
		input: ListDiscussionsInput,
		output: DiscussionListOutput,
	},

	// Generate a join code for the discussion
	generateJoinCode: {
		input: GenerateJoinCodeInput,
		output: z.object({
			joinCode: z.string(),
			expiresAt: z.date(),
		}),
	},

	// Join a discussion
	join: {
		input: JoinDiscussionInput,
		output: JoinDiscussionOutput,
	},

	// Leave a discussion
	leave: {
		input: LeaveDiscussionInput,
		output: z.object({
			success: z.boolean(),
		}),
	},

	// Get participants in a discussion
	getParticipants: {
		input: GetDiscussionInput,
		output: z.object({
			participants: z.array(ParticipantOutput),
		}),
	},

	// Remove a participant (moderator/creator only)
	removeParticipant: {
		input: RemoveParticipantInput,
		output: z.object({
			success: z.boolean(),
		}),
	},

	// Update participant role (creator only)
	updateParticipantRole: {
		input: UpdateParticipantRoleInput,
		output: ParticipantOutput,
	},
};
