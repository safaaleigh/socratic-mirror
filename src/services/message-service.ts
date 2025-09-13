import { db } from "@/server/db";
import type { MessageSenderType, MessageType } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";

// Types for message service
export interface MessageWithSender {
	id: string;
	discussionId: string;
	authorId: string | null;
	participantId: string | null;
	senderName: string;
	senderType: MessageSenderType;
	content: string;
	type: MessageType;
	parentId: string | null;
	parent?: {
		id: string;
		content: string;
		senderName: string;
		senderType: MessageSenderType;
	} | null;
	isEdited: boolean;
	editedAt: Date | null;
	createdAt: Date;
	replyCount: number;
}

export interface CursorPaginationResult {
	messages: MessageWithSender[];
	nextCursor?: string;
	hasMore: boolean;
}

export interface CreateParticipantMessageParams {
	discussionId: string;
	participantId: string;
	content: string;
	parentId?: string;
	type?: MessageType;
}

export interface GetMessageHistoryParams {
	discussionId: string;
	limit?: number;
	cursor?: string;
	parentId?: string;
}

// Utility functions
function formatMessageWithSender(message: any): MessageWithSender {
	return {
		id: message.id,
		discussionId: message.discussionId,
		authorId: message.authorId,
		participantId: message.participantId,
		senderName: message.senderName,
		senderType: message.senderType,
		content: message.content,
		type: message.type,
		parentId: message.parentId,
		parent: message.parent
			? {
					id: message.parent.id,
					content: message.parent.content,
					senderName: message.parent.senderName,
					senderType: message.parent.senderType,
				}
			: null,
		isEdited: !!message.editedAt,
		editedAt: message.editedAt,
		createdAt: message.createdAt,
		replyCount: message._count?.replies || 0,
	};
}

async function validateDiscussionAccess(
	client: PrismaClient,
	discussionId: string,
): Promise<void> {
	const discussion = await client.discussion.findUnique({
		where: { id: discussionId },
		select: { isActive: true },
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
}

async function validateParticipant(
	client: PrismaClient,
	participantId: string,
	discussionId: string,
): Promise<void> {
	const participant = await client.participant.findUnique({
		where: { id: participantId },
		select: { discussionId: true, leftAt: true },
	});

	if (!participant) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Participant not found",
		});
	}

	if (participant.discussionId !== discussionId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Participant does not belong to this discussion",
		});
	}

	if (participant.leftAt) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Participant has left the discussion",
		});
	}
}

async function validateParentMessage(
	client: PrismaClient,
	parentId: string,
	discussionId: string,
): Promise<void> {
	const parentMessage = await client.message.findUnique({
		where: { id: parentId },
		select: { discussionId: true },
	});

	if (!parentMessage || parentMessage.discussionId !== discussionId) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Invalid parent message",
		});
	}
}

export class MessageService {
	private db: PrismaClient;

	constructor(dbClient?: PrismaClient) {
		this.db = dbClient || db;
	}

	/**
	 * Create a message from an anonymous participant
	 */
	async createParticipantMessage(
		params: CreateParticipantMessageParams,
	): Promise<MessageWithSender> {
		const {
			discussionId,
			participantId,
			content,
			parentId,
			type = "USER",
		} = params;

		// Validate inputs
		if (!content.trim() || content.length > 5000) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Content must be between 1 and 5000 characters",
			});
		}

		// Validate discussion is active
		await validateDiscussionAccess(this.db, discussionId);

		// Validate participant exists and belongs to discussion
		await validateParticipant(this.db, participantId, discussionId);

		// Validate parent message if provided
		if (parentId) {
			await validateParentMessage(this.db, parentId, discussionId);
		}

		// Get participant info for sender details
		const participant = await this.db.participant.findUnique({
			where: { id: participantId },
			select: { displayName: true },
		});

		if (!participant) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Participant not found",
			});
		}

		// Create the message
		const message = await this.db.message.create({
			data: {
				discussionId,
				participantId,
				content: content.trim(),
				parentId,
				type,
				senderName: participant.displayName,
				senderType: "PARTICIPANT",
			},
			include: {
				parent: {
					select: {
						id: true,
						content: true,
						senderName: true,
						senderType: true,
					},
				},
				_count: {
					select: { replies: true },
				},
			},
		});

		return formatMessageWithSender(message);
	}

	/**
	 * Get message history with cursor-based pagination
	 * Supports both authenticated users and anonymous participants
	 */
	async getMessageHistory(
		params: GetMessageHistoryParams,
	): Promise<CursorPaginationResult> {
		const { discussionId, limit = 50, cursor, parentId } = params;

		// Validate inputs
		if (limit < 1 || limit > 100) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Limit must be between 1 and 100",
			});
		}

		// Validate discussion exists (don't need to check active status for reading)
		const discussion = await this.db.discussion.findUnique({
			where: { id: discussionId },
			select: { id: true },
		});

		if (!discussion) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Discussion not found",
			});
		}

		const where = {
			discussionId,
			...(parentId !== undefined && { parentId }),
			...(cursor && { id: { lt: cursor } }),
		} as const;

		const messages = await this.db.message.findMany({
			where,
			take: limit + 1, // Take one extra to check if there are more
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
				participant: {
					select: {
						id: true,
						displayName: true,
					},
				},
				parent: {
					select: {
						id: true,
						content: true,
						senderName: true,
						senderType: true,
					},
				},
				_count: {
					select: { replies: true },
				},
			},
		});

		let hasMore = false;
		if (messages.length > limit) {
			messages.pop();
			hasMore = true;
		}

		// Format messages with proper sender information
		const formattedMessages = messages.map((message) => {
			// Ensure senderName and senderType are properly set
			let senderName = message.senderName;
			let senderType = message.senderType;

			// Fallback logic for backwards compatibility
			if (!senderName) {
				if (message.author) {
					senderName = message.author.name || "Unknown User";
					senderType = "USER";
				} else if (message.participant) {
					senderName = message.participant.displayName;
					senderType = "PARTICIPANT";
				} else {
					senderName = "System";
					senderType = "SYSTEM";
				}
			}

			return formatMessageWithSender({
				...message,
				senderName,
				senderType,
			});
		});

		return {
			messages: formattedMessages,
			nextCursor: messages[messages.length - 1]?.id,
			hasMore,
		};
	}

	/**
	 * Get message count for a discussion
	 */
	async getMessageCount(discussionId: string): Promise<number> {
		return this.db.message.count({
			where: { discussionId },
		});
	}

	/**
	 * Get recent messages for AI context
	 */
	async getRecentMessagesForAI(
		discussionId: string,
		limit = 10,
	): Promise<
		Array<{
			id: string;
			content: string;
			senderName: string;
			senderType: MessageSenderType;
			type: MessageType;
			createdAt: Date;
		}>
	> {
		const messages = await this.db.message.findMany({
			where: {
				discussionId,
				type: { in: ["USER", "MODERATOR", "AI_QUESTION", "AI_PROMPT"] },
			},
			orderBy: { createdAt: "desc" },
			take: limit,
			include: {
				author: {
					select: { name: true },
				},
				participant: {
					select: { displayName: true },
				},
			},
		});

		return messages.map((message) => {
			// Determine sender name with fallback
			let senderName = message.senderName;
			if (!senderName) {
				if (message.author) {
					senderName = message.author.name || "Unknown User";
				} else if (message.participant) {
					senderName = message.participant.displayName;
				} else {
					senderName = "System";
				}
			}

			return {
				id: message.id,
				content: message.content,
				senderName,
				senderType: message.senderType,
				type: message.type,
				createdAt: message.createdAt,
			};
		});
	}

	/**
	 * Create system message (for notifications, etc.)
	 */
	async createSystemMessage(
		discussionId: string,
		content: string,
		type: MessageType = "SYSTEM",
	): Promise<MessageWithSender> {
		await validateDiscussionAccess(this.db, discussionId);

		const message = await this.db.message.create({
			data: {
				discussionId,
				content: content.trim(),
				type,
				senderName: "System",
				senderType: "SYSTEM",
			},
			include: {
				parent: {
					select: {
						id: true,
						content: true,
						senderName: true,
						senderType: true,
					},
				},
				_count: {
					select: { replies: true },
				},
			},
		});

		return formatMessageWithSender(message);
	}
}

// Export singleton instance
export const messageService = new MessageService();
