/**
 * JWT Invitation Utilities
 *
 * Provides type-safe JWT token generation and validation for discussion invitations.
 * Follows security best practices:
 * - Stateless validation (no DB lookup per token verification)
 * - Discussion-scoped tokens with expiration
 * - No sensitive data in JWT claims
 * - Configurable expiration with reasonable defaults
 */

import { env } from "@/env";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { z } from "zod";

// ==================== Types & Schemas ====================

/**
 * JWT Claims for participant invitation tokens
 */
export const InvitationTokenClaims = z.object({
	discussionId: z.string().cuid(),
	type: z.literal("participant_invitation"),
	iat: z.number(),
	exp: z.number(),
});

export type InvitationTokenClaims = z.infer<typeof InvitationTokenClaims>;

/**
 * Token generation options
 */
export const GenerateTokenOptions = z.object({
	discussionId: z.string().cuid(),
	expiresIn: z.string().optional().default("24h"), // JWT-compatible duration string
});

export type GenerateTokenOptions = z.infer<typeof GenerateTokenOptions>;

/**
 * Token validation result
 */
interface TokenValidationResult {
	valid: boolean;
	claims?: InvitationTokenClaims;
	error?: string;
}

/**
 * Safe token parsing result
 */
interface TokenParseResult {
	success: boolean;
	discussionId?: string;
	expiresAt?: Date;
	error?: string;
}

// ==================== Core Functions ====================

/**
 * Generate a JWT invitation token for a discussion
 *
 * Creates a stateless token that can be validated without database lookup.
 * Token includes discussion ID and expiration time in claims.
 *
 * @param options - Token generation options
 * @returns JWT token string
 */
export function generateInvitationToken(options: GenerateTokenOptions): string {
	const validatedOptions = GenerateTokenOptions.parse(options);

	const payload: Omit<InvitationTokenClaims, "iat" | "exp"> = {
		discussionId: validatedOptions.discussionId,
		type: "participant_invitation",
	};

	try {
		const token = jwt.sign(payload, env.JWT_SECRET, {
			expiresIn: validatedOptions.expiresIn,
			issuer: "socratic-discussions",
			audience: "participant",
		} as SignOptions);

		return token;
	} catch (error) {
		throw new Error(
			`Failed to generate invitation token: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

/**
 * Validate and decode a JWT invitation token
 *
 * Performs complete JWT verification including signature, expiration,
 * and claim structure validation.
 *
 * @param token - JWT token string to validate
 * @returns Validation result with claims or error
 */
export function validateInvitationToken(token: string): TokenValidationResult {
	if (!token || typeof token !== "string") {
		return {
			valid: false,
			error: "Token is required and must be a string",
		};
	}

	try {
		// Verify JWT signature and expiration
		const decoded = jwt.verify(token, env.JWT_SECRET, {
			issuer: "socratic-discussions",
			audience: "participant",
		});

		// Ensure decoded is an object (not string for some edge cases)
		if (typeof decoded === "string") {
			return {
				valid: false,
				error: "Invalid token format",
			};
		}

		// Validate claim structure
		const claims = InvitationTokenClaims.parse(decoded);

		return {
			valid: true,
			claims,
		};
	} catch (error) {
		if (error instanceof jwt.TokenExpiredError) {
			return {
				valid: false,
				error: "Invitation token has expired",
			};
		}

		if (error instanceof jwt.JsonWebTokenError) {
			return {
				valid: false,
				error: "Invalid invitation token",
			};
		}

		if (error instanceof z.ZodError) {
			return {
				valid: false,
				error: "Token claims do not match expected format",
			};
		}

		return {
			valid: false,
			error: `Token validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Safely parse invitation token claims without full validation
 *
 * Extracts discussion ID and expiration time without verifying signature.
 * Useful for generating invitation URLs or checking expiration before
 * expensive validation operations.
 *
 * @param token - JWT token string to parse
 * @returns Parse result with discussion ID and expiration or error
 */
export function parseInvitationToken(token: string): TokenParseResult {
	if (!token || typeof token !== "string") {
		return {
			success: false,
			error: "Token is required and must be a string",
		};
	}

	try {
		// Decode without verification (for safe parsing)
		const decoded = jwt.decode(token);

		if (!decoded || typeof decoded === "string") {
			return {
				success: false,
				error: "Invalid token format",
			};
		}

		// Extract claims safely
		const discussionId =
			typeof decoded.discussionId === "string"
				? decoded.discussionId
				: undefined;
		const exp = typeof decoded.exp === "number" ? decoded.exp : undefined;

		if (!discussionId) {
			return {
				success: false,
				error: "Token does not contain discussion ID",
			};
		}

		return {
			success: true,
			discussionId,
			expiresAt: exp ? new Date(exp * 1000) : undefined,
		};
	} catch (error) {
		return {
			success: false,
			error: `Failed to parse token: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

// ==================== Helper Functions ====================

/**
 * Check if a token is expired without full validation
 *
 * @param token - JWT token string to check
 * @returns true if token is expired or invalid, false if still valid
 */
export function isTokenExpired(token: string): boolean {
	const parsed = parseInvitationToken(token);

	if (!parsed.success || !parsed.expiresAt) {
		return true; // Treat invalid tokens as expired
	}

	return parsed.expiresAt < new Date();
}

/**
 * Get discussion ID from token without validation
 *
 * @param token - JWT token string
 * @returns Discussion ID if present, undefined otherwise
 */
export function getDiscussionIdFromToken(token: string): string | undefined {
	const parsed = parseInvitationToken(token);
	return parsed.success ? parsed.discussionId : undefined;
}

/**
 * Convert duration string to expiration date
 *
 * @param expiresIn - JWT-compatible duration string (e.g., '24h', '7d', '2h')
 * @returns Expiration date
 */
export function durationToExpirationDate(expiresIn: string): Date {
	// This is a simple implementation for common durations
	// For production, consider using a more robust duration parsing library
	const now = Date.now();
	const multipliers: Record<string, number> = {
		s: 1000,
		m: 60 * 1000,
		h: 60 * 60 * 1000,
		d: 24 * 60 * 60 * 1000,
	};

	const match = expiresIn.match(/^(\d+)([smhd])$/);
	if (!match) {
		throw new Error(
			`Invalid duration format: ${expiresIn}. Use format like '24h', '7d', '2h'`,
		);
	}

	const [, amount, unit] = match;
	const multiplier = multipliers[unit!];

	if (!multiplier) {
		throw new Error(`Unsupported duration unit: ${unit}. Use s, m, h, or d`);
	}

	return new Date(now + Number.parseInt(amount!, 10) * multiplier);
}

// ==================== Constants ====================

/**
 * Default token expiration duration (24 hours)
 */
export const DEFAULT_EXPIRATION = "24h";

/**
 * Maximum allowed token expiration (30 days)
 */
const MAX_EXPIRATION = "30d";

/**
 * Minimum allowed token expiration (1 minute)
 */
const MIN_EXPIRATION = "1m";
