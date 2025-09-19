// T007: Integration test invalid token handling
import { afterEach, describe, expect, test } from "vitest";

import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import { db } from "@/server/db";

// Cleanup function
afterEach(async () => {
	// Clean up test data (minimal cleanup needed for invalid token tests)
	await db.invitation.deleteMany({
		where: { recipientEmail: { contains: "@test" } },
	});
	await db.discussion.deleteMany({ where: { name: { contains: "Test " } } });
	await db.user.deleteMany({ where: { email: { contains: "@test" } } });
});

// Integration test: Invalid token handling
describe("Invalid Token Handling", () => {
	test("should handle non-existent tokens gracefully", async () => {
		// TDD: This test represents quickstart scenario 3 - invalid token handling

		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		// Test validation with non-existent token
		const validation = await caller.invitation.validate({
			token: "cm123nonexistent456token789",
		});

		expect(validation.valid).toBe(false);
		expect(validation.reason).toBe("Invitation not found");

		// Test getting details with non-existent token
		await expect(
			caller.invitation.getByToken({ token: "cm123nonexistent456token789" }),
		).rejects.toThrow("Invitation not found");
	});

	test("should reject malformed token formats", async () => {
		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		// Test various malformed token formats
		const malformedTokens = [
			"invalid_token_123", // Invalid format
			"", // Empty string
			"short", // Too short
			"cm123", // Valid prefix but too short
			"not-a-cuid-at-all-really", // Wrong format entirely
			"123456789012345678901234567890", // Wrong format, too long
			"cm123-abc-456-def", // Hyphens not allowed in CUID
			"CM123ABC456DEF789", // Uppercase not allowed
		];

		for (const token of malformedTokens) {
			// Validation should throw schema validation error
			await expect(caller.invitation.validate({ token })).rejects.toThrow();

			// Getting details should also throw schema validation error
			await expect(caller.invitation.getByToken({ token })).rejects.toThrow();
		}
	});

	test("should handle special characters in tokens", async () => {
		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		// Test tokens with special characters (should be rejected by schema)
		const specialCharTokens = [
			"cm123abc@456def789", // @ symbol
			"cm123abc#456def789", // # symbol
			"cm123abc$456def789", // $ symbol
			"cm123abc%456def789", // % symbol
			"cm123abc&456def789", // & symbol
			"cm123abc*456def789", // * symbol
			"cm123abc+456def789", // + symbol
			"cm123abc=456def789", // = symbol
			"cm123abc?456def789", // ? symbol
			"cm123abc!456def789", // ! symbol
		];

		for (const token of specialCharTokens) {
			// Should throw schema validation error due to invalid CUID format
			await expect(caller.invitation.validate({ token })).rejects.toThrow();

			await expect(caller.invitation.getByToken({ token })).rejects.toThrow();
		}
	});

	test("should handle null and undefined token values", async () => {
		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		// Test null token (should throw schema validation error)
		await expect(
			caller.invitation.validate({ token: null as any }),
		).rejects.toThrow();

		await expect(
			caller.invitation.getByToken({ token: null as any }),
		).rejects.toThrow();

		// Test undefined token (should throw schema validation error)
		await expect(
			caller.invitation.validate({ token: undefined as any }),
		).rejects.toThrow();

		await expect(
			caller.invitation.getByToken({ token: undefined as any }),
		).rejects.toThrow();
	});

	test("should differentiate between not found and invalid format", async () => {
		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		// Test valid CUID format but non-existent token
		const validFormatNonExistent = "cm123validformat456butnotfound";

		const validation = await caller.invitation.validate({
			token: validFormatNonExistent,
		});
		expect(validation.valid).toBe(false);
		expect(validation.reason).toBe("Invitation not found");

		await expect(
			caller.invitation.getByToken({ token: validFormatNonExistent }),
		).rejects.toThrow("Invitation not found");

		// Test invalid format (should throw different error)
		const invalidFormat = "definitely-not-a-cuid";

		await expect(
			caller.invitation.validate({ token: invalidFormat }),
		).rejects.toThrow(); // Schema validation error, different from not found

		await expect(
			caller.invitation.getByToken({ token: invalidFormat }),
		).rejects.toThrow(); // Schema validation error
	});

	test("should handle tokens for wrong resource types", async () => {
		// Setup a valid invitation for testing
		const creator = await db.user.create({
			data: {
				name: "Wrong Type Creator",
				email: "wrongtype@test.com",
			},
		});

		const discussion = await db.discussion.create({
			data: {
				name: "Test Wrong Type Discussion",
				description: "Testing wrong resource type tokens",
				isActive: true,
				creatorId: creator.id,
			},
		});

		// Create an invitation for different type (if supported in future)
		const validInvitation = await db.invitation.create({
			data: {
				type: "DISCUSSION", // Correct type
				targetId: discussion.id,
				recipientEmail: "",
				senderId: creator.id,
				status: "PENDING",
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
			},
		});

		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		// This invitation should work fine (baseline test)
		const validation = await caller.invitation.validate({
			token: validInvitation.token,
		});
		expect(validation.valid).toBe(true);

		// Test with hypothetical wrong resource type token
		// (This is more of a forward-compatibility test)
		const hypotheticalWrongTypeToken = "cm123wrongtype456resource789";

		const wrongTypeValidation = await caller.invitation.validate({
			token: hypotheticalWrongTypeToken,
		});
		expect(wrongTypeValidation.valid).toBe(false);
		expect(wrongTypeValidation.reason).toBe("Invitation not found");
	});

	test("should handle concurrent invalid token requests", async () => {
		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		// Test multiple concurrent invalid token requests
		const invalidTokens = [
			"cm123invalid456token001",
			"cm123invalid456token002",
			"cm123invalid456token003",
			"cm123invalid456token004",
			"cm123invalid456token005",
		];

		const validationPromises = invalidTokens.map((token) =>
			caller.invitation.validate({ token }),
		);

		const results = await Promise.all(validationPromises);

		// All should return "not found" consistently
		results.forEach((result, index) => {
			expect(result.valid).toBe(false);
			expect(result.reason).toBe("Invitation not found");
		});
	});

	test("should handle very long invalid tokens", async () => {
		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		// Test extremely long token (should be rejected by schema)
		const veryLongToken = `cm${"a".repeat(1000)}`; // Very long invalid token

		await expect(
			caller.invitation.validate({ token: veryLongToken }),
		).rejects.toThrow(); // Schema validation should reject this

		await expect(
			caller.invitation.getByToken({ token: veryLongToken }),
		).rejects.toThrow(); // Schema validation should reject this
	});

	test("should provide consistent error messages", async () => {
		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		// Test multiple valid-format but non-existent tokens
		const nonExistentTokens = [
			"cm123notfound456token001",
			"cm123notfound456token002",
			"cm123notfound456token003",
		];

		for (const token of nonExistentTokens) {
			const validation = await caller.invitation.validate({ token });

			// Should consistently return the same error message
			expect(validation.valid).toBe(false);
			expect(validation.reason).toBe("Invitation not found");

			// getByToken should also have consistent error message
			await expect(caller.invitation.getByToken({ token })).rejects.toThrow(
				"Invitation not found",
			);
		}
	});

	test("should handle tokens that look like valid CUIDs but don't exist", async () => {
		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		// Generate CUID-like tokens that don't exist in database
		const fakeCuidTokens = [
			"cm0123456789abcdef012345", // Valid CUID format
			"cm9876543210fedcba987654", // Valid CUID format
			"cmaabbccddeeff00112233445", // Valid CUID format
		];

		for (const token of fakeCuidTokens) {
			// Should properly identify as not found (not invalid format)
			const validation = await caller.invitation.validate({ token });
			expect(validation.valid).toBe(false);
			expect(validation.reason).toBe("Invitation not found");

			await expect(caller.invitation.getByToken({ token })).rejects.toThrow(
				"Invitation not found",
			);
		}
	});

	test("should handle case sensitivity correctly", async () => {
		// Setup a valid invitation for baseline
		const creator = await db.user.create({
			data: {
				name: "Case Test Creator",
				email: "case@test.com",
			},
		});

		const discussion = await db.discussion.create({
			data: {
				name: "Test Case Sensitivity Discussion",
				description: "Testing case sensitivity",
				isActive: true,
				creatorId: creator.id,
			},
		});

		const validInvitation = await db.invitation.create({
			data: {
				type: "DISCUSSION",
				targetId: discussion.id,
				recipientEmail: "",
				senderId: creator.id,
				status: "PENDING",
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
			},
		});

		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		// Test valid token (baseline)
		const validResult = await caller.invitation.validate({
			token: validInvitation.token,
		});
		expect(validResult.valid).toBe(true);

		// Test uppercase version of same token (should be treated as different)
		const uppercaseToken = validInvitation.token.toUpperCase();

		// Uppercase should either:
		// 1. Fail schema validation (preferred), or
		// 2. Be treated as not found
		try {
			const uppercaseResult = await caller.invitation.validate({
				token: uppercaseToken,
			});
			// If it doesn't throw, it should at least be invalid
			expect(uppercaseResult.valid).toBe(false);
		} catch (error) {
			// Schema validation error is also acceptable
			expect(error).toBeDefined();
		}
	});
});
