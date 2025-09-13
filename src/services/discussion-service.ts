import { env } from "@/env";
import { db } from "@/server/db";
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import * as jwt from "jsonwebtoken";

// Types for discussion service
export interface InvitationTokenPayload {
	discussionId: string;
	iat: number;
	exp: number;
}

export interface DiscussionInviteInfo {
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
}

export interface GenerateTokenParams {
	discussionId: string;
	expirationHours?: number;
}

export interface TokenValidationResult {
	isValid: boolean;
	discussionInfo?: DiscussionInviteInfo;
	error?: string;
}

// Constants
const DEFAULT_EXPIRATION_HOURS = 24;
const JWT_SECRET = env.AUTH_SECRET || "fallback-secret-for-development";

// Utility functions
function generateSecureToken(): string {
	const chars =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let token = "";
	for (let i = 0; i < 32; i++) {
		token += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return token;
}

export class DiscussionService {
	private db: PrismaClient;

	constructor(dbClient?: PrismaClient) {
		this.db = dbClient || db;
	}

	/**
	 * Generate a JWT invitation token for a discussion
	 */
	async generateInvitationToken(params: GenerateTokenParams): Promise<string> {
		const { discussionId, expirationHours = DEFAULT_EXPIRATION_HOURS } = params;

		// Validate discussion exists
		const discussion = await this.db.discussion.findUnique({
			where: { id: discussionId },
			select: {
				id: true,
				isActive: true,
				invitationToken: true,
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

		// Create JWT payload
		const expirationTime =
			Math.floor(Date.now() / 1000) + expirationHours * 3600;
		const payload: InvitationTokenPayload = {
			discussionId,
			iat: Math.floor(Date.now() / 1000),
			exp: expirationTime,
		};

		// Generate JWT token
		const token = jwt.sign(payload, JWT_SECRET, {
			algorithm: "HS256",
		});

		// Store token in discussion record for tracking
		await this.db.discussion.update({
			where: { id: discussionId },
			data: { invitationToken: token },
		});

		return token;
	}

	/**
	 * Validate an invitation token and return discussion info
	 */
	async validateInvitationToken(token: string): Promise<TokenValidationResult> {
		try {
			// Verify and decode JWT
			const decoded = jwt.verify(token, JWT_SECRET) as InvitationTokenPayload;
			const { discussionId } = decoded;

			// Get discussion info
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

			// Check if this is the current token for the discussion
			if (discussion.invitationToken !== token) {
				return {
					isValid: false,
					error: "Token has been revoked",
				};
			}

			return {
				isValid: true,
				discussionInfo: {
					discussionId: discussion.id,
					name: discussion.name,
					description: discussion.description,
					isActive: discussion.isActive,
					maxParticipants: discussion.maxParticipants,
					currentParticipantCount: discussion._count.anonymousParticipants,
					lesson: discussion.lesson
						? {
								title: discussion.lesson.title,
								description: discussion.lesson.description || undefined,
							}
						: null,
				},
			};
		} catch (error) {
			if (error instanceof jwt.TokenExpiredError) {
				return {
					isValid: false,
					error: "Invitation has expired",
				};
			}

			if (error instanceof jwt.JsonWebTokenError) {
				return {
					isValid: false,
					error: "Invalid invitation token",
				};
			}

			return {
				isValid: false,
				error: "Failed to validate invitation",
			};
		}
	}

	/**
	 * Revoke an invitation token
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
	 * Update participant counts and statistics
	 */
	async updateParticipantCounts(discussionId: string): Promise<{
		totalParticipants: number;
		activeParticipants: number;
		authenticatedParticipants: number;
		anonymousParticipants: number;
	}> {
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

		// Count authenticated participants
		const authenticatedCount = await this.db.discussionParticipant.count({
			where: {
				discussionId,
				status: "ACTIVE",
			},
		});

		// Count anonymous participants
		const anonymousCount = await this.db.participant.count({
			where: {
				discussionId,
				leftAt: null,
			},
		});

		const totalActive = authenticatedCount + anonymousCount;

		// Get total participants (including those who left)
		const totalAuthenticated = await this.db.discussionParticipant.count({
			where: { discussionId },
		});

		const totalAnonymous = await this.db.participant.count({
			where: { discussionId },
		});

		const totalParticipants = totalAuthenticated + totalAnonymous;

		return {
			totalParticipants,
			activeParticipants: totalActive,
			authenticatedParticipants: authenticatedCount,
			anonymousParticipants: anonymousCount,
		};
	}

	/**
	 * Check if discussion has capacity for new participants
	 */
	async hasCapacityForNewParticipant(discussionId: string): Promise<boolean> {
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
			return false;
		}

		if (!discussion.maxParticipants) {
			return true; // No limit set
		}

		const currentActive =
			discussion._count.participants + discussion._count.anonymousParticipants;

		return currentActive < discussion.maxParticipants;
	}

	/**
	 * Get discussion invitation URL
	 */
	generateInvitationUrl(token: string): string {
		const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
		return `${baseUrl}/invite/${token}`;
	}

	/**
	 * Create a shareable join link for a discussion
	 */
	async createShareableLink(
		discussionId: string,
		expirationHours: number = DEFAULT_EXPIRATION_HOURS,
	): Promise<{
		token: string;
		url: string;
		expiresAt: Date;
	}> {
		const token = await this.generateInvitationToken({
			discussionId,
			expirationHours,
		});

		const url = this.generateInvitationUrl(token);
		const expiresAt = new Date(Date.now() + expirationHours * 3600 * 1000);

		return {
			token,
			url,
			expiresAt,
		};
	}

	/**
	 * Get discussion by invitation token (for public access)
	 */
	async getDiscussionByInvitationToken(
		token: string,
	): Promise<DiscussionInviteInfo | null> {
		const validation = await this.validateInvitationToken(token);

		if (!validation.isValid || !validation.discussionInfo) {
			return null;
		}

		return validation.discussionInfo;
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

			try {
				// Try to decode the token to check expiration
				jwt.verify(discussion.invitationToken, JWT_SECRET);
			} catch (error) {
				if (error instanceof jwt.TokenExpiredError) {
					// Token is expired, remove it
					await this.db.discussion.update({
						where: { id: discussion.id },
						data: { invitationToken: null },
					});
					cleanedCount++;
				}
				// Ignore other JWT errors as they might be valid tokens with different issues
			}
		}

		return { cleanedCount };
	}
}

// Export singleton instance
export const discussionService = new DiscussionService();
