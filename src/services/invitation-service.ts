import {
	DEFAULT_EXPIRATION,
	generateInvitationToken as generateJWTToken,
	isTokenExpired,
	parseInvitationToken,
	validateInvitationToken as validateJWTToken,
} from "@/lib/invitation-jwt";
import { db } from "@/server/db";
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";

// Types for invitation service
export interface InvitationValidationResult {
	isValid: boolean;
	discussionInfo?: {
		discussionId: string;
		name: string;
		description: string | null;
		isActive: boolean;
		maxParticipants: number | null;
		currentParticipantCount: number;
		lesson?: {
			title: string;
			description?: string;
		} | null;
	};
	error?: string;
}

export interface ParticipantLimitCheck {
	hasCapacity: boolean;
	currentCount: number;
	maxParticipants: number | null;
	availableSlots: number | null;
}

export interface DiscussionContext {
	id: string;
	name: string;
	description: string | null;
	isActive: boolean;
	maxParticipants: number | null;
	currentParticipantCount: number;
	lesson?: {
		title: string;
		description?: string;
	} | null;
	creator?: {
		id: string;
		name: string | null;
		email: string;
	};
}

export interface GenerateInvitationParams {
	discussionId: string;
	expirationHours?: number;
}

export interface InvitationTokenInfo {
	token: string;
	url: string;
	expiresAt: Date;
	discussionId: string;
}

// Constants
const DEFAULT_EXPIRATION_HOURS = 24;
const MAX_EXPIRATION_HOURS = 168; // 7 days
const MIN_EXPIRATION_HOURS = 1;

// Utility functions
function validateExpirationHours(hours: number): void {
	if (hours < MIN_EXPIRATION_HOURS || hours > MAX_EXPIRATION_HOURS) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `Expiration must be between ${MIN_EXPIRATION_HOURS} and ${MAX_EXPIRATION_HOURS} hours`,
		});
	}
}

function generateInvitationUrl(token: string): string {
	const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
	return `${baseUrl}/invite/${token}`;
}

export class InvitationService {
	private db: PrismaClient;

	constructor(dbClient?: PrismaClient) {
		this.db = dbClient || db;
	}

	/**
	 * Validate invitation access - Check if invitation is valid and discussion is accessible
	 */
	async validateInvitationAccess(
		token: string,
	): Promise<InvitationValidationResult> {
		try {
			// First validate the JWT token structure and signature
			const jwtValidation = validateJWTToken(token);

			if (!jwtValidation.valid || !jwtValidation.claims) {
				return {
					isValid: false,
					error: jwtValidation.error || "Invalid invitation token",
				};
			}

			const { discussionId } = jwtValidation.claims;

			// Get discussion info with participant counts
			const discussion = await this.db.discussion.findUnique({
				where: { id: discussionId },
				select: {
					id: true,
					name: true,
					description: true,
					isActive: true,
					maxParticipants: true,
					invitationToken: true,
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
							anonymousParticipants: {
								where: { leftAt: null },
							},
						},
					},
				},
			});

			if (!discussion) {
				return {
					isValid: false,
					error: "Discussion not found",
				};
			}

			if (!discussion.isActive) {
				return {
					isValid: false,
					error: "Discussion is no longer active",
				};
			}

			// Check if this token matches the current invitation token stored in the discussion
			if (discussion.invitationToken !== token) {
				return {
					isValid: false,
					error: "Invitation token has been revoked or is outdated",
				};
			}

			const currentParticipantCount =
				discussion._count.participants +
				discussion._count.anonymousParticipants;

			return {
				isValid: true,
				discussionInfo: {
					discussionId: discussion.id,
					name: discussion.name,
					description: discussion.description,
					isActive: discussion.isActive,
					maxParticipants: discussion.maxParticipants,
					currentParticipantCount,
					lesson: discussion.lesson
						? {
								title: discussion.lesson.title,
								description: discussion.lesson.description || undefined,
							}
						: null,
				},
			};
		} catch (error) {
			return {
				isValid: false,
				error: `Failed to validate invitation: ${error instanceof Error ? error.message : "Unknown error"}`,
			};
		}
	}

	/**
	 * Check participant limit - Verify discussion hasn't reached max participants
	 */
	async checkParticipantLimit(
		discussionId: string,
	): Promise<ParticipantLimitCheck> {
		const discussion = await this.db.discussion.findUnique({
			where: { id: discussionId },
			select: {
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

		const currentCount =
			discussion._count.participants + discussion._count.anonymousParticipants;

		const hasCapacity =
			!discussion.maxParticipants || currentCount < discussion.maxParticipants;

		const availableSlots = discussion.maxParticipants
			? discussion.maxParticipants - currentCount
			: null;

		return {
			hasCapacity,
			currentCount,
			maxParticipants: discussion.maxParticipants,
			availableSlots,
		};
	}

	/**
	 * Get discussion context - Retrieve discussion info for invitation UI
	 */
	async getDiscussionContext(
		discussionId: string,
	): Promise<DiscussionContext | null> {
		const discussion = await this.db.discussion.findUnique({
			where: { id: discussionId },
			select: {
				id: true,
				name: true,
				description: true,
				isActive: true,
				maxParticipants: true,
				creator: {
					select: {
						id: true,
						name: true,
						email: true,
					},
				},
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
						anonymousParticipants: {
							where: { leftAt: null },
						},
					},
				},
			},
		});

		if (!discussion) {
			return null;
		}

		const currentParticipantCount =
			discussion._count.participants + discussion._count.anonymousParticipants;

		return {
			id: discussion.id,
			name: discussion.name,
			description: discussion.description,
			isActive: discussion.isActive,
			maxParticipants: discussion.maxParticipants,
			currentParticipantCount,
			lesson: discussion.lesson
				? {
						title: discussion.lesson.title,
						description: discussion.lesson.description || undefined,
					}
				: null,
			creator: discussion.creator
				? {
						id: discussion.creator.id,
						name: discussion.creator.name,
						email: discussion.creator.email,
					}
				: undefined,
		};
	}

	/**
	 * Generate invitation token - Create JWT tokens for discussions
	 */
	async generateInvitationToken(
		params: GenerateInvitationParams,
	): Promise<InvitationTokenInfo> {
		const { discussionId, expirationHours = DEFAULT_EXPIRATION_HOURS } = params;

		// Validate expiration hours
		validateExpirationHours(expirationHours);

		// Validate discussion exists and is active
		const discussion = await this.db.discussion.findUnique({
			where: { id: discussionId },
			select: {
				id: true,
				isActive: true,
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
				message: "Cannot generate invitation for inactive discussion",
			});
		}

		// Generate JWT token with appropriate expiration
		const expiresIn = `${expirationHours}h`;
		const token = generateJWTToken({
			discussionId,
			expiresIn,
		});

		// Store token in discussion record for tracking/revocation
		await this.db.discussion.update({
			where: { id: discussionId },
			data: { invitationToken: token },
		});

		// Calculate expiration date
		const expiresAt = new Date(Date.now() + expirationHours * 3600 * 1000);
		const url = generateInvitationUrl(token);

		return {
			token,
			url,
			expiresAt,
			discussionId,
		};
	}

	/**
	 * Revoke invitation token - Invalidate tokens
	 */
	async revokeInvitationToken(discussionId: string): Promise<void> {
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

		// Clear the invitation token
		await this.db.discussion.update({
			where: { id: discussionId },
			data: { invitationToken: null },
		});
	}

	/**
	 * Refresh invitation token - Generate new token and revoke old one
	 */
	async refreshInvitationToken(
		params: GenerateInvitationParams,
	): Promise<InvitationTokenInfo> {
		// Simply generate a new token, which will overwrite the old one
		return this.generateInvitationToken(params);
	}

	/**
	 * Check if invitation token exists and is valid for a discussion
	 */
	async hasValidInvitationToken(discussionId: string): Promise<{
		hasToken: boolean;
		isValid: boolean;
		expiresAt?: Date;
		token?: string;
	}> {
		const discussion = await this.db.discussion.findUnique({
			where: { id: discussionId },
			select: { invitationToken: true },
		});

		if (!discussion?.invitationToken) {
			return { hasToken: false, isValid: false };
		}

		const token = discussion.invitationToken;

		// Check if token is expired
		if (isTokenExpired(token)) {
			return { hasToken: true, isValid: false, token };
		}

		// Parse token to get expiration date
		const parsed = parseInvitationToken(token);

		return {
			hasToken: true,
			isValid: true,
			expiresAt: parsed.expiresAt,
			token,
		};
	}

	/**
	 * Get invitation URL for existing token
	 */
	async getInvitationUrl(discussionId: string): Promise<string | null> {
		const tokenInfo = await this.hasValidInvitationToken(discussionId);

		if (!tokenInfo.isValid || !tokenInfo.token) {
			return null;
		}

		return generateInvitationUrl(tokenInfo.token);
	}

	/**
	 * Clean up expired invitation tokens
	 */
	async cleanupExpiredTokens(): Promise<{ cleanedCount: number }> {
		// Find discussions with invitation tokens
		const discussions = await this.db.discussion.findMany({
			where: {
				invitationToken: { not: null },
			},
			select: {
				id: true,
				invitationToken: true,
			},
		});

		let cleanedCount = 0;

		for (const discussion of discussions) {
			if (!discussion.invitationToken) continue;

			// Check if token is expired
			if (isTokenExpired(discussion.invitationToken)) {
				await this.db.discussion.update({
					where: { id: discussion.id },
					data: { invitationToken: null },
				});
				cleanedCount++;
			}
		}

		return { cleanedCount };
	}

	/**
	 * Validate discussion access for participants (without full invitation flow)
	 */
	async validateDiscussionAccess(discussionId: string): Promise<{
		canAccess: boolean;
		discussion?: DiscussionContext;
		reason?: string;
	}> {
		try {
			const discussion = await this.getDiscussionContext(discussionId);

			if (!discussion) {
				return {
					canAccess: false,
					reason: "Discussion not found",
				};
			}

			if (!discussion.isActive) {
				return {
					canAccess: false,
					discussion,
					reason: "Discussion is not active",
				};
			}

			// Check participant limits
			const limitCheck = await this.checkParticipantLimit(discussionId);
			if (!limitCheck.hasCapacity) {
				return {
					canAccess: false,
					discussion,
					reason: "Discussion has reached maximum participant capacity",
				};
			}

			return {
				canAccess: true,
				discussion,
			};
		} catch (error) {
			return {
				canAccess: false,
				reason: `Failed to validate discussion access: ${error instanceof Error ? error.message : "Unknown error"}`,
			};
		}
	}
}

// Export singleton instance
export const invitationService = new InvitationService();
