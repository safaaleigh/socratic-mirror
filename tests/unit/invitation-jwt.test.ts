/**
 * Unit Tests: JWT Invitation Utilities
 *
 * Tests the core JWT token generation, validation, and parsing functions
 * for discussion invitations. These utilities are used by the participant
 * tRPC router for stateless invitation token handling.
 */

import {
	DEFAULT_EXPIRATION,
	type InvitationTokenClaims,
	durationToExpirationDate,
	generateInvitationToken,
	getDiscussionIdFromToken,
	isTokenExpired,
	parseInvitationToken,
	validateInvitationToken,
} from "@/lib/invitation-jwt";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("JWT Invitation Utilities", () => {
	const TEST_SECRET =
		"test-secret-key-that-is-at-least-32-characters-long-for-security";
	const TEST_DISCUSSION_ID = "clm4x5y6z0001abc123def456";

	beforeEach(() => {
		// Setup for each test
	});

	describe("generateInvitationToken", () => {
		it("should generate a valid JWT token with default expiration", () => {
			const token = generateInvitationToken({
				discussionId: TEST_DISCUSSION_ID,
			});

			expect(token).toBeDefined();
			expect(typeof token).toBe("string");
			expect(token).toMatch(
				/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/,
			);
		});

		it("should generate token with custom expiration", () => {
			const token = generateInvitationToken({
				discussionId: TEST_DISCUSSION_ID,
				expiresIn: "2h",
			});

			// Decode token to check expiration
			const decoded = jwt.decode(token) as any;
			expect(decoded).toBeDefined();
			expect(decoded.exp - decoded.iat).toBeCloseTo(7200, 10); // 2 hours ± 10 seconds
		});

		it("should include correct claims in token", () => {
			const token = generateInvitationToken({
				discussionId: TEST_DISCUSSION_ID,
				expiresIn: "1h",
			});

			const decoded = jwt.decode(token) as any;
			expect(decoded).toMatchObject({
				discussionId: TEST_DISCUSSION_ID,
				type: "participant_invitation",
				iss: "socratic-discussions",
				aud: "participant",
				iat: expect.any(Number),
				exp: expect.any(Number),
			});
		});

		it("should validate input parameters", () => {
			expect(() => {
				generateInvitationToken({
					discussionId: "invalid-id", // Not a CUID
				});
			}).toThrow();

			expect(() => {
				generateInvitationToken({
					discussionId: "", // Empty string
				});
			}).toThrow();
		});

		it("should generate different tokens for different discussions", () => {
			const token1 = generateInvitationToken({
				discussionId: "clm4x5y6z0001abc123def456",
			});
			const token2 = generateInvitationToken({
				discussionId: "clm4x5y6z0002xyz789ghi012",
			});

			expect(token1).not.toBe(token2);
		});
	});

	describe("validateInvitationToken", () => {
		let validToken: string;

		beforeEach(() => {
			validToken = generateInvitationToken({
				discussionId: TEST_DISCUSSION_ID,
				expiresIn: "1h",
			});
		});

		it("should validate a valid token successfully", () => {
			const result = validateInvitationToken(validToken);

			expect(result.valid).toBe(true);
			expect(result.claims).toMatchObject({
				discussionId: TEST_DISCUSSION_ID,
				type: "participant_invitation",
				iat: expect.any(Number),
				exp: expect.any(Number),
			});
			expect(result.error).toBeUndefined();
		});

		it("should reject tokens with invalid signature", () => {
			const tamperedToken = `${validToken.slice(0, -1)}X`; // Modify signature

			const result = validateInvitationToken(tamperedToken);

			expect(result.valid).toBe(false);
			expect(result.error).toMatch(/invalid.*token/i);
			expect(result.claims).toBeUndefined();
		});

		it("should reject expired tokens", () => {
			// Generate token that expires immediately
			const expiredToken = jwt.sign(
				{
					discussionId: TEST_DISCUSSION_ID,
					type: "participant_invitation",
				},
				TEST_SECRET,
				{
					expiresIn: -1, // Already expired
					issuer: "socratic-discussions",
					audience: "participant",
				},
			);

			const result = validateInvitationToken(expiredToken);

			expect(result.valid).toBe(false);
			expect(result.error).toMatch(/expired|invalid.*token/i);
			expect(result.claims).toBeUndefined();
		});

		it("should reject tokens with wrong type claim", () => {
			const wrongTypeToken = jwt.sign(
				{
					discussionId: TEST_DISCUSSION_ID,
					type: "wrong_type", // Invalid type
				},
				TEST_SECRET,
				{
					expiresIn: "1h",
					issuer: "socratic-discussions",
					audience: "participant",
				},
			);

			const result = validateInvitationToken(wrongTypeToken);

			expect(result.valid).toBe(false);
			expect(result.error).toMatch(/claims.*format|invalid.*token/i);
			expect(result.claims).toBeUndefined();
		});

		it("should reject tokens with missing discussionId", () => {
			const missingIdToken = jwt.sign(
				{
					type: "participant_invitation",
					// Missing discussionId
				},
				TEST_SECRET,
				{
					expiresIn: "1h",
					issuer: "socratic-discussions",
					audience: "participant",
				},
			);

			const result = validateInvitationToken(missingIdToken);

			expect(result.valid).toBe(false);
			expect(result.error).toMatch(/claims.*format|invalid.*token/i);
		});

		it("should handle malformed tokens gracefully", () => {
			const malformedTokens = [
				"",
				"not.a.jwt",
				"invalid-token",
				"a.b", // Too few parts
				"a.b.c.d", // Too many parts
			];

			for (const token of malformedTokens) {
				const result = validateInvitationToken(token);
				expect(result.valid).toBe(false);
				expect(result.error).toBeDefined();
			}
		});

		it("should reject null or undefined tokens", () => {
			expect(validateInvitationToken(null as any).valid).toBe(false);
			expect(validateInvitationToken(undefined as any).valid).toBe(false);
		});
	});

	describe("parseInvitationToken", () => {
		let validToken: string;

		beforeEach(() => {
			validToken = generateInvitationToken({
				discussionId: TEST_DISCUSSION_ID,
				expiresIn: "2h",
			});
		});

		it("should parse valid token without verification", () => {
			const result = parseInvitationToken(validToken);

			expect(result.success).toBe(true);
			expect(result.discussionId).toBe(TEST_DISCUSSION_ID);
			expect(result.expiresAt).toBeInstanceOf(Date);
			expect(result.error).toBeUndefined();
		});

		it("should parse even expired tokens (without validation)", () => {
			const expiredToken = jwt.sign(
				{
					discussionId: TEST_DISCUSSION_ID,
					type: "participant_invitation",
				},
				TEST_SECRET,
				{
					expiresIn: -1, // Already expired
				},
			);

			const result = parseInvitationToken(expiredToken);

			expect(result.success).toBe(true);
			expect(result.discussionId).toBe(TEST_DISCUSSION_ID);
			expect(result.expiresAt).toBeInstanceOf(Date);
		});

		it("should handle malformed tokens", () => {
			const result = parseInvitationToken("invalid-token");

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.discussionId).toBeUndefined();
		});

		it("should handle tokens without discussionId", () => {
			const tokenWithoutId = jwt.sign(
				{
					type: "participant_invitation",
					// No discussionId
				},
				TEST_SECRET,
			);

			const result = parseInvitationToken(tokenWithoutId);

			expect(result.success).toBe(false);
			expect(result.error).toMatch(/discussion.*id/i);
		});
	});

	describe("isTokenExpired", () => {
		it("should return false for valid non-expired token", () => {
			const token = generateInvitationToken({
				discussionId: TEST_DISCUSSION_ID,
				expiresIn: "1h",
			});

			expect(isTokenExpired(token)).toBe(false);
		});

		it("should return true for expired token", () => {
			const expiredToken = jwt.sign(
				{
					discussionId: TEST_DISCUSSION_ID,
					type: "participant_invitation",
				},
				TEST_SECRET,
				{
					expiresIn: -1, // Already expired
				},
			);

			expect(isTokenExpired(expiredToken)).toBe(true);
		});

		it("should return true for invalid tokens", () => {
			expect(isTokenExpired("invalid-token")).toBe(true);
			expect(isTokenExpired("")).toBe(true);
			expect(isTokenExpired(null as any)).toBe(true);
		});
	});

	describe("getDiscussionIdFromToken", () => {
		it("should extract discussion ID from valid token", () => {
			const token = generateInvitationToken({
				discussionId: TEST_DISCUSSION_ID,
			});

			const discussionId = getDiscussionIdFromToken(token);

			expect(discussionId).toBe(TEST_DISCUSSION_ID);
		});

		it("should return undefined for invalid token", () => {
			const discussionId = getDiscussionIdFromToken("invalid-token");

			expect(discussionId).toBeUndefined();
		});
	});

	describe("durationToExpirationDate", () => {
		beforeEach(() => {
			// Mock Date.now for consistent testing - skip for now as API may be different
		});

		it("should convert hours to expiration date", () => {
			const now = Date.now();
			const expirationDate = durationToExpirationDate("2h");
			const expectedTime = now + 2 * 60 * 60 * 1000; // 2 hours in ms

			expect(expirationDate.getTime()).toBeCloseTo(expectedTime, -3); // Within ~1 second
		});

		it("should convert days to expiration date", () => {
			const now = Date.now();
			const expirationDate = durationToExpirationDate("7d");
			const expectedTime = now + 7 * 24 * 60 * 60 * 1000; // 7 days in ms

			expect(expirationDate.getTime()).toBeCloseTo(expectedTime, -3);
		});

		it("should convert minutes and seconds", () => {
			const now = Date.now();

			const thirtyMin = durationToExpirationDate("30m");
			expect(thirtyMin.getTime()).toBeCloseTo(now + 30 * 60 * 1000, -3);

			const fortyFiveSec = durationToExpirationDate("45s");
			expect(fortyFiveSec.getTime()).toBeCloseTo(now + 45 * 1000, -3);
		});

		it("should throw error for invalid format", () => {
			expect(() => durationToExpirationDate("invalid")).toThrow(
				/invalid.*format/i,
			);
			expect(() => durationToExpirationDate("2x")).toThrow(
				/invalid.*format|unsupported.*unit/i,
			);
			expect(() => durationToExpirationDate("")).toThrow(/invalid.*format/i);
		});
	});

	describe("Integration tests", () => {
		it("should handle complete token lifecycle", () => {
			// Generate token
			const token = generateInvitationToken({
				discussionId: TEST_DISCUSSION_ID,
				expiresIn: "1h",
			});

			// Parse token
			const parsed = parseInvitationToken(token);
			expect(parsed.success).toBe(true);
			expect(parsed.discussionId).toBe(TEST_DISCUSSION_ID);

			// Validate token
			const validation = validateInvitationToken(token);
			expect(validation.valid).toBe(true);
			expect(validation.claims?.discussionId).toBe(TEST_DISCUSSION_ID);

			// Check expiration
			expect(isTokenExpired(token)).toBe(false);

			// Extract discussion ID
			expect(getDiscussionIdFromToken(token)).toBe(TEST_DISCUSSION_ID);
		});

		it("should generate tokens that can be validated successfully", () => {
			// Generate multiple tokens for different discussions
			const discussions = [
				"clm4x5y6z0001abc123def456",
				"clm4x5y6z0002def456ghi789",
				"clm4x5y6z0003ghi789jkl012",
			];

			const tokens = discussions.map((discussionId) =>
				generateInvitationToken({
					discussionId,
					expiresIn: "1h",
				}),
			);

			// All tokens should be different (different discussion IDs)
			const uniqueTokens = new Set(tokens);
			expect(uniqueTokens.size).toBe(tokens.length);

			// All tokens should be valid
			for (const token of tokens) {
				const validation = validateInvitationToken(token);
				expect(validation.valid).toBe(true);
			}
		});
	});
});
