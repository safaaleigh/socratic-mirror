/**
 * Unified Invitation Token Service
 *
 * Provides a unified interface for generating both database-stored and JWT-based
 * invitation tokens. Uses smart selection logic to choose the optimal token type
 * based on the use case.
 */

import { env } from "@/env";
import { generateInvitationToken } from "@/lib/invitation-jwt";
import { db } from "@/server/db";
import type {
	IUnifiedTokenService,
	TokenGenerationOptions,
	TokenGenerationResult,
	TokenSelectionContext,
	TokenType,
	TokenValidationResponse,
} from "@/types/invitation-tokens";
import {
	TokenGenerationError,
	TokenValidationError,
	selectOptimalTokenType,
} from "@/types/invitation-tokens";
import type { InvitationStatus, InvitationType } from "@prisma/client";
import { z } from "zod";

/**
 * Default expiration times for different token types
 */
const DEFAULT_EXPIRATION = {
	database: "7d", // 7 days for persistent invitations
	jwt: "24h", // 24 hours for temporary links
} as const;

/**
 * Validation schema for token generation options
 */
const tokenGenerationSchema = z.object({
	discussionId: z.string().cuid(),
	expiresIn: z.string().optional(),
	senderId: z.string().cuid().optional(),
	recipientEmail: z.string().email().optional(),
	message: z.string().optional(),
	forceType: z.enum(["database", "jwt"]).optional(),
	expectsHighVolume: z.boolean().optional(),
	requiresRevocation: z.boolean().optional(),
	isTemporary: z.boolean().optional(),
});

/**
 * Unified Token Service Implementation
 */
class UnifiedTokenService implements IUnifiedTokenService {
	/**
	 * Generate an invitation token using smart type selection
	 */
	async generateToken(
		options: TokenGenerationOptions,
	): Promise<TokenGenerationResult> {
		try {
			// Validate input options
			const validatedOptions = tokenGenerationSchema.parse(options);

			// Determine token type
			const tokenType = this.selectTokenType(validatedOptions);

			// Generate token based on type
			if (tokenType === "database") {
				return this.generateDatabaseToken(validatedOptions);
			}
			return this.generateJWTToken(validatedOptions);
		} catch (error) {
			if (error instanceof z.ZodError) {
				throw new TokenGenerationError(
					`Invalid token generation options: ${error.errors.map((e) => e.message).join(", ")}`,
					"INVALID_OPTIONS",
					options,
				);
			}
			throw error;
		}
	}

	/**
	 * Validate any type of token and return unified response
	 */
	async validateToken(token: string): Promise<TokenValidationResponse> {
		if (!token || typeof token !== "string") {
			return {
				valid: false,
				error: "Token is required and must be a string",
			};
		}

		// Auto-detect token type and validate accordingly
		if (this.isJWTToken(token)) {
			return this.validateJWTTokenWithDiscussion(token);
		}
		return this.validateDatabaseTokenWithDiscussion(token);
	}

	/**
	 * Revoke a token (only works for database tokens)
	 */
	async revokeToken(token: string): Promise<boolean> {
		if (this.isJWTToken(token)) {
			return false; // JWT tokens cannot be revoked
		}

		try {
			const result = await db.invitation.update({
				where: { token },
				data: { status: "CANCELLED" },
			});
			return !!result;
		} catch {
			return false;
		}
	}

	/**
	 * Check if a token can be revoked
	 */
	isRevocable(token: string): boolean {
		return !this.isJWTToken(token);
	}

	/**
	 * Private Methods
	 */

	/**
	 * Select the optimal token type based on context
	 */
	private selectTokenType(options: TokenGenerationOptions): TokenType {
		// Use forced type if specified
		if (options.forceType) {
			return options.forceType;
		}

		// Build context for smart selection
		const context: TokenSelectionContext = {
			senderId: options.senderId,
			recipientEmail: options.recipientEmail,
			hasMessage: !!options.message,
			requiresRevocation: options.requiresRevocation,
			expectsHighVolume: options.expectsHighVolume,
			isTemporary: options.isTemporary,
		};

		return selectOptimalTokenType(context);
	}

	/**
	 * Generate a database-stored invitation token
	 */
	private async generateDatabaseToken(
		options: TokenGenerationOptions,
	): Promise<TokenGenerationResult> {
		try {
			if (!options.senderId) {
				throw new TokenGenerationError(
					"Sender ID is required for database tokens",
					"INVALID_OPTIONS",
					options,
				);
			}

			// Calculate expiration date
			const expiresIn = options.expiresIn || DEFAULT_EXPIRATION.database;
			const expiresAt = this.parseExpirationTime(expiresIn);

			// Create invitation in database
			const invitation = await db.invitation.create({
				data: {
					type: "DISCUSSION" as InvitationType,
					targetId: options.discussionId,
					senderId: options.senderId,
					recipientEmail: options.recipientEmail || "",
					message: options.message,
					status: "PENDING" as InvitationStatus,
					expiresAt,
				},
			});

			return {
				token: invitation.token,
				type: "database",
				expiresAt: invitation.expiresAt,
				invitationId: invitation.id,
			};
		} catch (error) {
			throw new TokenGenerationError(
				`Failed to generate database token: ${error instanceof Error ? error.message : "Unknown error"}`,
				"DATABASE_ERROR",
				options,
			);
		}
	}

	/**
	 * Generate a JWT invitation token
	 */
	private generateJWTToken(
		options: TokenGenerationOptions,
	): TokenGenerationResult {
		try {
			const expiresIn = options.expiresIn || DEFAULT_EXPIRATION.jwt;
			const token = generateInvitationToken({
				discussionId: options.discussionId,
				expiresIn,
			});

			// Calculate expiration date for consistency
			const expiresAt = this.parseExpirationTime(expiresIn);

			return {
				token,
				type: "jwt",
				expiresAt,
			};
		} catch (error) {
			throw new TokenGenerationError(
				`Failed to generate JWT token: ${error instanceof Error ? error.message : "Unknown error"}`,
				"JWT_ERROR",
				options,
			);
		}
	}

	/**
	 * Validate a JWT token and include discussion information
	 */
	private async validateJWTTokenWithDiscussion(
		token: string,
	): Promise<TokenValidationResponse> {
		// Import the JWT validation function
		const { validateInvitationToken } = await import("@/lib/invitation-jwt");

		const jwtResult = validateInvitationToken(token);

		if (!jwtResult.valid || !jwtResult.claims) {
			return {
				valid: false,
				error: jwtResult.error,
			};
		}

		// Get discussion information
		const discussion = await this.getDiscussionInfo(
			jwtResult.claims.discussionId,
		);

		if (!discussion.valid) {
			return {
				valid: false,
				error: discussion.error,
			};
		}

		return {
			valid: true,
			token: {
				type: "jwt",
				discussionId: jwtResult.claims.discussionId,
				expiresAt: new Date(jwtResult.claims.exp * 1000),
				issuedAt: new Date(jwtResult.claims.iat * 1000),
			},
			discussion: discussion.discussion,
		};
	}

	/**
	 * Validate a database token and include discussion information
	 */
	private async validateDatabaseTokenWithDiscussion(
		token: string,
	): Promise<TokenValidationResponse> {
		try {
			// Validate CUID format
			if (!this.isCUID(token)) {
				return {
					valid: false,
					error: "Invalid token format",
				};
			}

			const invitation = await db.invitation.findUnique({
				where: { token },
				include: {
					sender: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
				},
			});

			if (!invitation) {
				return {
					valid: false,
					error: "Invitation not found",
				};
			}

			// Check if expired
			if (invitation.expiresAt < new Date()) {
				// Update status if not already expired
				if (invitation.status === "PENDING") {
					await db.invitation.update({
						where: { id: invitation.id },
						data: { status: "EXPIRED" },
					});
				}
				return {
					valid: false,
					error: "Invitation has expired",
				};
			}

			// Check if cancelled
			if (invitation.status === "CANCELLED") {
				return {
					valid: false,
					error: "Invitation has been cancelled",
				};
			}

			// Check if already accepted
			if (invitation.status === "ACCEPTED") {
				return {
					valid: false,
					error: "Invitation has already been used",
				};
			}

			// Get discussion information
			const discussion = await this.getDiscussionInfo(invitation.targetId);

			if (!discussion.valid) {
				return {
					valid: false,
					error: discussion.error,
				};
			}

			return {
				valid: true,
				token: {
					type: "database",
					id: invitation.id,
					discussionId: invitation.targetId,
					expiresAt: invitation.expiresAt,
					invitationType: invitation.type,
					targetId: invitation.targetId,
					status: invitation.status,
					sender: invitation.sender,
					recipientEmail: invitation.recipientEmail,
					recipientId: invitation.recipientId,
					message: invitation.message,
					createdAt: invitation.createdAt,
				},
				discussion: discussion.discussion,
			};
		} catch (error) {
			return {
				valid: false,
				error: "Failed to validate token",
			};
		}
	}

	/**
	 * Get discussion information and validate its state
	 */
	private async getDiscussionInfo(discussionId: string) {
		try {
			const discussion = await db.discussion.findUnique({
				where: { id: discussionId },
				select: {
					id: true,
					name: true,
					isActive: true,
					maxParticipants: true,
					closedAt: true,
					_count: {
						select: {
							participants: {
								where: { leftAt: null },
							},
						},
					},
				},
			});

			if (!discussion) {
				return {
					valid: false,
					error: "Discussion not found",
				};
			}

			// Determine discussion status
			const status = this.computeDiscussionStatus(
				discussion.isActive,
				discussion.closedAt,
			);

			if (status !== "active") {
				return {
					valid: false,
					error: "Discussion is no longer active",
				};
			}

			const participantCount = discussion._count.participants;

			// Check capacity
			if (
				discussion.maxParticipants &&
				participantCount >= discussion.maxParticipants
			) {
				return {
					valid: false,
					error: "Discussion is at capacity",
				};
			}

			return {
				valid: true,
				discussion: {
					id: discussion.id,
					name: discussion.name,
					participantCount,
					maxParticipants: discussion.maxParticipants,
					isActive: discussion.isActive,
					status,
				},
			};
		} catch (error) {
			return {
				valid: false,
				error: "Failed to validate discussion",
			};
		}
	}

	/**
	 * Helper methods
	 */

	private isJWTToken(token: string): boolean {
		return token.includes(".") && token.split(".").length === 3;
	}

	private isCUID(token: string): boolean {
		return /^[a-z0-9]{25}$/.test(token);
	}

	private parseExpirationTime(expiresIn: string): Date {
		const now = new Date();

		// Parse common duration formats
		const match = expiresIn.match(/^(\d+)([smhdw])$/);
		if (!match) {
			throw new Error(`Invalid expiration format: ${expiresIn}`);
		}

		const [, amount, unit] = match;
		const value = Number.parseInt(amount!, 10);

		switch (unit) {
			case "s":
				return new Date(now.getTime() + value * 1000);
			case "m":
				return new Date(now.getTime() + value * 60 * 1000);
			case "h":
				return new Date(now.getTime() + value * 60 * 60 * 1000);
			case "d":
				return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
			case "w":
				return new Date(now.getTime() + value * 7 * 24 * 60 * 60 * 1000);
			default:
				throw new Error(`Unsupported time unit: ${unit}`);
		}
	}

	private computeDiscussionStatus(
		isActive: boolean,
		closedAt: Date | null,
	): "active" | "closed" | "cancelled" {
		if (!isActive) return "cancelled";
		if (closedAt && closedAt <= new Date()) return "closed";
		return "active";
	}
}

/**
 * Default instance of the unified token service
 */
export const unifiedTokenService = new UnifiedTokenService();

/**
 * Convenience functions for common operations
 */
const generateInvitationTokenUnified = (options: TokenGenerationOptions) =>
	unifiedTokenService.generateToken(options);

const validateInvitationTokenUnified = (token: string) =>
	unifiedTokenService.validateToken(token);

const revokeInvitationToken = (token: string) =>
	unifiedTokenService.revokeToken(token);

const isTokenRevocable = (token: string) =>
	unifiedTokenService.isRevocable(token);
