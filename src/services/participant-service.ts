import { db } from "@/server/db";
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";

// Types for participant service
export interface ParticipantInfo {
	id: string;
	discussionId: string;
	displayName: string;
	sessionId: string;
	joinedAt: Date;
	leftAt: Date | null;
	ipAddress: string | null;
	isActive: boolean;
}

export interface CreateParticipantParams {
	discussionId: string;
	displayName: string;
	sessionId: string;
	ipAddress?: string;
}

export interface ParticipantSessionInfo {
	participant: ParticipantInfo;
	discussion: {
		id: string;
		name: string;
		description: string | null;
		isActive: boolean;
		maxParticipants: number | null;
	};
}

export interface ParticipantStats {
	totalParticipants: number;
	activeParticipants: number;
	leftParticipants: number;
}

// Validation constants
const DISPLAY_NAME_MIN_LENGTH = 1;
const DISPLAY_NAME_MAX_LENGTH = 50;
const SESSION_ID_LENGTH = 255;

// Utility functions
function validateDisplayName(displayName: string): void {
	if (!displayName || displayName.trim().length < DISPLAY_NAME_MIN_LENGTH) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Display name is required",
		});
	}

	if (displayName.trim().length > DISPLAY_NAME_MAX_LENGTH) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or less`,
		});
	}

	// Check for inappropriate content (basic check)
	const sanitized = displayName.trim();
	if (
		sanitized !== displayName ||
		sanitized.includes("<") ||
		sanitized.includes(">")
	) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Display name contains invalid characters",
		});
	}
}

function validateSessionId(sessionId: string): void {
	if (!sessionId || sessionId.length > SESSION_ID_LENGTH) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Invalid session ID",
		});
	}
}

function formatParticipantInfo(participant: {
	id: string;
	discussionId: string;
	displayName: string;
	sessionId: string;
	joinedAt: Date;
	leftAt: Date | null;
	ipAddress: string | null;
}): ParticipantInfo {
	return {
		id: participant.id,
		discussionId: participant.discussionId,
		displayName: participant.displayName,
		sessionId: participant.sessionId,
		joinedAt: participant.joinedAt,
		leftAt: participant.leftAt,
		ipAddress: participant.ipAddress,
		isActive: !participant.leftAt,
	};
}

export class ParticipantService {
	private db: PrismaClient;

	constructor(dbClient?: PrismaClient) {
		this.db = dbClient || db;
	}

	/**
	 * Create a new anonymous participant for a discussion
	 */
	async createParticipant(
		params: CreateParticipantParams,
	): Promise<ParticipantInfo> {
		const { discussionId, displayName, sessionId, ipAddress } = params;

		// Validate inputs
		validateDisplayName(displayName);
		validateSessionId(sessionId);

		// Check if discussion exists and is active
		const discussion = await this.db.discussion.findUnique({
			where: { id: discussionId },
			select: {
				id: true,
				isActive: true,
				maxParticipants: true,
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

		if (!discussion.isActive) {
			throw new TRPCError({
				code: "PRECONDITION_FAILED",
				message: "Discussion is not active",
			});
		}

		// Check participant limits (count both authenticated and anonymous participants)
		const currentActiveParticipants =
			discussion._count.participants + discussion._count.anonymousParticipants;
		if (
			discussion.maxParticipants &&
			currentActiveParticipants >= discussion.maxParticipants
		) {
			throw new TRPCError({
				code: "PRECONDITION_FAILED",
				message: "Discussion has reached maximum participant capacity",
			});
		}

		// Check if participant with same sessionId already exists and is active
		const existingParticipant = await this.db.participant.findUnique({
			where: {
				discussionId_sessionId: {
					discussionId,
					sessionId,
				},
			},
		});

		if (existingParticipant && !existingParticipant.leftAt) {
			throw new TRPCError({
				code: "CONFLICT",
				message: "Participant already exists in this discussion",
			});
		}

		// Check for display name conflicts within the discussion
		const duplicateName = await this.db.participant.findFirst({
			where: {
				discussionId,
				displayName: displayName.trim(),
				leftAt: null,
			},
		});

		if (duplicateName) {
			throw new TRPCError({
				code: "CONFLICT",
				message: "Display name is already taken in this discussion",
			});
		}

		// Create or reactivate participant
		let participant: {
			id: string;
			discussionId: string;
			displayName: string;
			sessionId: string;
			joinedAt: Date;
			leftAt: Date | null;
			ipAddress: string | null;
		};
		if (existingParticipant?.leftAt) {
			// Reactivate existing participant
			participant = await this.db.participant.update({
				where: { id: existingParticipant.id },
				data: {
					displayName: displayName.trim(),
					leftAt: null,
					joinedAt: new Date(),
					ipAddress,
				},
			});
		} else {
			// Create new participant
			participant = await this.db.participant.create({
				data: {
					discussionId,
					displayName: displayName.trim(),
					sessionId,
					ipAddress,
				},
			});
		}

		return formatParticipantInfo(participant);
	}

	/**
	 * Update participant status (mainly for leaving/rejoining)
	 */
	async updateParticipantStatus(
		participantId: string,
		status: "leave" | "rejoin",
		sessionId?: string,
	): Promise<ParticipantInfo> {
		const participant = await this.db.participant.findUnique({
			where: { id: participantId },
		});

		if (!participant) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Participant not found",
			});
		}

		// Validate session if provided
		if (sessionId && participant.sessionId !== sessionId) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "Invalid session",
			});
		}

		let updatedParticipant: {
			id: string;
			discussionId: string;
			displayName: string;
			sessionId: string;
			joinedAt: Date;
			leftAt: Date | null;
			ipAddress: string | null;
		};

		if (status === "leave") {
			if (participant.leftAt) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Participant has already left",
				});
			}

			updatedParticipant = await this.db.participant.update({
				where: { id: participantId },
				data: { leftAt: new Date() },
			});
		} else if (status === "rejoin") {
			if (!participant.leftAt) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Participant is still active",
				});
			}

			// Check if discussion is still active
			const discussion = await this.db.discussion.findUnique({
				where: { id: participant.discussionId },
				select: { isActive: true, maxParticipants: true },
			});

			if (!discussion?.isActive) {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "Discussion is no longer active",
				});
			}

			updatedParticipant = await this.db.participant.update({
				where: { id: participantId },
				data: { leftAt: null, joinedAt: new Date() },
			});
		} else {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Invalid status",
			});
		}

		return formatParticipantInfo(updatedParticipant);
	}

	/**
	 * Get participant by session ID
	 */
	async getParticipantBySession(
		discussionId: string,
		sessionId: string,
	): Promise<ParticipantSessionInfo | null> {
		validateSessionId(sessionId);

		const participant = await this.db.participant.findUnique({
			where: {
				discussionId_sessionId: {
					discussionId,
					sessionId,
				},
			},
			include: {
				discussion: {
					select: {
						id: true,
						name: true,
						description: true,
						isActive: true,
						maxParticipants: true,
					},
				},
			},
		});

		if (!participant) {
			return null;
		}

		return {
			participant: formatParticipantInfo(participant),
			discussion: participant.discussion,
		};
	}

	/**
	 * Get active participants for a discussion
	 */
	async getActiveParticipants(
		discussionId: string,
	): Promise<ParticipantInfo[]> {
		const participants = await this.db.participant.findMany({
			where: {
				discussionId,
				leftAt: null,
			},
			orderBy: { joinedAt: "asc" },
		});

		return participants.map(formatParticipantInfo);
	}

	/**
	 * Get participant statistics for a discussion
	 */
	async getParticipantStats(discussionId: string): Promise<ParticipantStats> {
		const stats = await this.db.participant.aggregate({
			where: { discussionId },
			_count: {
				id: true,
			},
		});

		const activeStats = await this.db.participant.aggregate({
			where: {
				discussionId,
				leftAt: null,
			},
			_count: {
				id: true,
			},
		});

		const leftStats = await this.db.participant.aggregate({
			where: {
				discussionId,
				leftAt: { not: null },
			},
			_count: {
				id: true,
			},
		});

		return {
			totalParticipants: stats._count.id,
			activeParticipants: activeStats._count.id,
			leftParticipants: leftStats._count.id,
		};
	}

	/**
	 * Clean up inactive participants (utility for background cleanup)
	 */
	async cleanupInactiveParticipants(
		maxInactiveHours = 24,
	): Promise<{ cleanedCount: number }> {
		const cutoffDate = new Date();
		cutoffDate.setHours(cutoffDate.getHours() - maxInactiveHours);

		// Find participants who joined but never sent messages and joined a while ago
		const inactiveParticipants = await this.db.participant.findMany({
			where: {
				leftAt: null,
				joinedAt: { lt: cutoffDate },
				messages: { none: {} }, // No messages sent
			},
			select: { id: true },
		});

		if (inactiveParticipants.length === 0) {
			return { cleanedCount: 0 };
		}

		// Mark them as left
		await this.db.participant.updateMany({
			where: {
				id: { in: inactiveParticipants.map((p) => p.id) },
			},
			data: { leftAt: new Date() },
		});

		return { cleanedCount: inactiveParticipants.length };
	}

	/**
	 * Generate unique display name suggestion
	 */
	async suggestDisplayName(
		discussionId: string,
		baseNames: string[] = ["Thinker", "Explorer", "Questioner", "Seeker"],
	): Promise<string> {
		// Get existing display names in the discussion
		const existingNames = await this.db.participant.findMany({
			where: {
				discussionId,
				leftAt: null,
			},
			select: { displayName: true },
		});

		const takenNames = new Set(
			existingNames.map((p) => p.displayName.toLowerCase()),
		);

		// Try base names first
		for (const baseName of baseNames) {
			if (!takenNames.has(baseName.toLowerCase())) {
				return baseName;
			}
		}

		// Try numbered variations
		for (const baseName of baseNames) {
			for (let i = 2; i <= 100; i++) {
				const candidate = `${baseName}${i}`;
				if (!takenNames.has(candidate.toLowerCase())) {
					return candidate;
				}
			}
		}

		// Fallback to random number
		let attempts = 0;
		while (attempts < 50) {
			const randomNum = Math.floor(Math.random() * 9999) + 1;
			const candidate = `Participant${randomNum}`;
			if (!takenNames.has(candidate.toLowerCase())) {
				return candidate;
			}
			attempts++;
		}

		// Final fallback with timestamp
		return `Participant${Date.now().toString().slice(-4)}`;
	}

	/**
	 * Check if a display name is available in a discussion
	 */
	async isDisplayNameAvailable(
		discussionId: string,
		displayName: string,
	): Promise<boolean> {
		const existing = await this.db.participant.findFirst({
			where: {
				discussionId,
				displayName: displayName.trim(),
				leftAt: null,
			},
		});

		return !existing;
	}
}

// Export singleton instance
export const participantService = new ParticipantService();
