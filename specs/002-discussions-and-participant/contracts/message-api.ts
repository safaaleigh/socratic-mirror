/**
 * Message API Contract
 * tRPC router procedures for message management and real-time updates
 */

import { z } from "zod";

// ==================== Input Schemas ====================

export const SendMessageInput = z.object({
	discussionId: z.string().cuid(),
	content: z.string().min(1).max(5000),
	parentId: z.string().cuid().optional(),
	type: z.enum(["USER", "MODERATOR"]).default("USER"),
});

export const EditMessageInput = z.object({
	messageId: z.string().cuid(),
	content: z.string().min(1).max(5000),
});

export const DeleteMessageInput = z.object({
	messageId: z.string().cuid(),
});

export const GetMessagesInput = z.object({
	discussionId: z.string().cuid(),
	limit: z.number().int().min(1).max(100).default(50),
	cursor: z.string().optional(),
	parentId: z.string().cuid().optional(),
});

export const MarkAsSeenInput = z.object({
	discussionId: z.string().cuid(),
	messageId: z.string().cuid(),
});

export const ReactToMessageInput = z.object({
	messageId: z.string().cuid(),
	reaction: z.enum(["👍", "👎", "❤️", "🤔", "💡", "🎯"]),
});

export const TypingIndicatorInput = z.object({
	discussionId: z.string().cuid(),
	isTyping: z.boolean(),
});

// ==================== Output Schemas ====================

export const MessageOutput = z.object({
	id: z.string(),
	discussionId: z.string(),
	authorId: z.string().nullable(),
	author: z
		.object({
			id: z.string(),
			name: z.string().nullable(),
			email: z.string(),
			image: z.string().nullable(),
		})
		.nullable(),
	content: z.string(),
	type: z.enum(["USER", "AI_QUESTION", "AI_PROMPT", "SYSTEM", "MODERATOR"]),
	parentId: z.string().nullable(),
	parent: z
		.object({
			id: z.string(),
			content: z.string(),
			authorName: z.string().nullable(),
		})
		.nullable(),
	isEdited: z.boolean(),
	editedAt: z.date().nullable(),
	createdAt: z.date(),
	replyCount: z.number().optional(),
	reactions: z.record(z.string(), z.number()).optional(),
});

export const MessageListOutput = z.object({
	messages: z.array(MessageOutput),
	nextCursor: z.string().optional(),
	hasMore: z.boolean(),
});

export const AIResponseOutput = z.object({
	message: MessageOutput,
	suggestedFollowUps: z.array(z.string()).optional(),
});

export const TypingUsersOutput = z.object({
	users: z.array(
		z.object({
			id: z.string(),
			name: z.string().nullable(),
		}),
	),
});

// ==================== Subscription Events ====================

export const MessageEvent = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("new_message"),
		message: MessageOutput,
	}),
	z.object({
		type: z.literal("message_edited"),
		message: MessageOutput,
	}),
	z.object({
		type: z.literal("message_deleted"),
		messageId: z.string(),
	}),
	z.object({
		type: z.literal("user_joined"),
		user: z.object({
			id: z.string(),
			name: z.string().nullable(),
		}),
	}),
	z.object({
		type: z.literal("user_left"),
		userId: z.string(),
	}),
	z.object({
		type: z.literal("typing"),
		users: z.array(
			z.object({
				id: z.string(),
				name: z.string().nullable(),
			}),
		),
	}),
	z.object({
		type: z.literal("ai_thinking"),
		isThinking: z.boolean(),
	}),
]);

// ==================== Router Definition ====================

export const messageRouter = {
	// Send a new message
	send: {
		input: SendMessageInput,
		output: MessageOutput,
	},

	// Edit an existing message (author only)
	edit: {
		input: EditMessageInput,
		output: MessageOutput,
	},

	// Delete a message (author or moderator)
	delete: {
		input: DeleteMessageInput,
		output: z.object({
			success: z.boolean(),
		}),
	},

	// Get messages for a discussion
	list: {
		input: GetMessagesInput,
		output: MessageListOutput,
	},

	// Mark message as seen
	markAsSeen: {
		input: MarkAsSeenInput,
		output: z.object({
			success: z.boolean(),
		}),
	},

	// React to a message
	react: {
		input: ReactToMessageInput,
		output: z.object({
			reactions: z.record(z.string(), z.number()),
		}),
	},

	// Update typing indicator
	setTyping: {
		input: TypingIndicatorInput,
		output: z.object({
			success: z.boolean(),
		}),
	},

	// Get AI response for discussion context
	getAIResponse: {
		input: z.object({
			discussionId: z.string().cuid(),
			context: z.string().optional(),
			replyToId: z.string().cuid().optional(),
		}),
		output: AIResponseOutput,
	},

	// Subscribe to real-time updates (WebSocket)
	subscribe: {
		input: z.object({
			discussionId: z.string().cuid(),
		}),
		output: MessageEvent,
	},
};
