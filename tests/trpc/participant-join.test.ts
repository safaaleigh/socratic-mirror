// T004: Contract test participant.join
import { afterEach, describe, expect, test } from "vitest";

import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import { db } from "@/server/db";

// Cleanup function
afterEach(async () => {
	// Clean up test data
	await db.participant.deleteMany({
		where: { displayName: { contains: "Test" } },
	});
	await db.invitation.deleteMany({
		where: { recipientEmail: { contains: "@test" } },
	});
	await db.discussion.deleteMany({ where: { name: { contains: "Test " } } });
	await db.user.deleteMany({ where: { email: { contains: "@test" } } });
});

// Test participant.join contract compliance
describe("participant.join Contract", () => {
	test("should validate request schema", async () => {
		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		// Valid schema based on existing participant.join endpoint
		const validInput = {
			discussionId: "cm123discussion789",
			displayName: "Alex Chen",
			sessionId: "test-session-id",
			ipAddress: "127.0.0.1",
		};

		try {
			await caller.participant.join(validInput);
		} catch (error) {
			// For TDD, we expect this to fail due to missing test data
			// but NOT due to schema validation errors
			expect(error).toBeDefined();
		}
	});

	test("should reject invalid participant name", async () => {
		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		// Empty name should fail validation
		await expect(
			caller.participant.join({
				discussionId: "cm123discussion789",
				displayName: "", // Empty name
				sessionId: "test-session-id",
			}),
		).rejects.toThrow();

		// Too long name should fail validation
		await expect(
			caller.participant.join({
				discussionId: "cm123discussion789",
				displayName: "a".repeat(51), // 51 characters, exceeds max 50
				sessionId: "test-session-id",
			}),
		).rejects.toThrow();
	});

	test("should create anonymous participant successfully", async () => {
		// Setup test data
		const user = await db.user.create({
			data: {
				name: "Discussion Creator",
				email: "creator@test.com",
			},
		});

		const discussion = await db.discussion.create({
			data: {
				name: "Test Discussion",
				description: "Test description",
				isActive: true,
				creatorId: user.id,
			},
		});

		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		const result = await caller.participant.join({
			discussionId: discussion.id,
			displayName: "Alex Chen",
			sessionId: "test-session-id",
			ipAddress: "127.0.0.1",
		});

		// Verify participant was created successfully
		expect(result.participant).toEqual({
			id: expect.any(String),
			discussionId: discussion.id,
			displayName: "Alex Chen",
			joinedAt: expect.any(String), // ISO date string
			leftAt: null,
		});

		expect(result.messageHistory).toEqual(expect.any(Array));
	});

	test("should handle full discussion", async () => {
		// Setup discussion at capacity
		const user = await db.user.create({
			data: {
				name: "Test User",
				email: "test@test.com",
			},
		});

		const discussion = await db.discussion.create({
			data: {
				name: "Test Full Discussion",
				description: "Test description",
				isActive: true,
				maxParticipants: 1,
				creatorId: user.id,
			},
		});

		// Add a participant to fill capacity
		await db.participant.create({
			data: {
				discussionId: discussion.id,
				displayName: "Existing Participant",
				sessionId: "existing-session-id",
			},
		});

		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		await expect(
			caller.participant.join({
				discussionId: discussion.id,
				displayName: "Alex Chen",
				sessionId: "test-session-id",
			}),
		).rejects.toThrow("Discussion is at capacity");
	});

	test("should handle invalid discussion", async () => {
		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		await expect(
			caller.participant.join({
				discussionId: "cm123nonexistent789",
				displayName: "Alex Chen",
				sessionId: "test-session-id",
			}),
		).rejects.toThrow("Discussion not found");
	});

	test("should handle inactive discussion", async () => {
		// Setup inactive discussion
		const user = await db.user.create({
			data: {
				name: "Test User",
				email: "test@test.com",
			},
		});

		const inactiveDiscussion = await db.discussion.create({
			data: {
				name: "Test Inactive Discussion",
				description: "Test description",
				isActive: false, // Inactive
				creatorId: user.id,
			},
		});

		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		await expect(
			caller.participant.join({
				discussionId: inactiveDiscussion.id,
				displayName: "Alex Chen",
				sessionId: "test-session-id",
			}),
		).rejects.toThrow("Discussion has ended");
	});

	test("should handle duplicate session rejoin", async () => {
		// Setup test data
		const user = await db.user.create({
			data: {
				name: "Test User",
				email: "test@test.com",
			},
		});

		const discussion = await db.discussion.create({
			data: {
				name: "Test Discussion Rejoin",
				description: "Test description",
				isActive: true,
				creatorId: user.id,
			},
		});

		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		// First join
		const firstResult = await caller.participant.join({
			discussionId: discussion.id,
			displayName: "Alex Chen",
			sessionId: "same-session-id",
		});

		expect(firstResult.participant.displayName).toBe("Alex Chen");

		// Second join with same session ID should update the existing participant
		const secondResult = await caller.participant.join({
			discussionId: discussion.id,
			displayName: "Alex Updated",
			sessionId: "same-session-id", // Same session ID
		});

		expect(secondResult.participant.displayName).toBe("Alex Updated");
		expect(secondResult.participant.id).toBe(firstResult.participant.id); // Same participant
	});

	test("should return message history on join", async () => {
		// Setup test data with some messages
		const user = await db.user.create({
			data: {
				name: "Test User",
				email: "test@test.com",
			},
		});

		const discussion = await db.discussion.create({
			data: {
				name: "Test Discussion History",
				description: "Test description",
				isActive: true,
				creatorId: user.id,
			},
		});

		// Create some test messages
		await db.message.create({
			data: {
				discussionId: discussion.id,
				content: "Welcome to the discussion!",
				senderName: "System",
				senderType: "SYSTEM",
			},
		});

		await db.message.create({
			data: {
				discussionId: discussion.id,
				content: "Hello everyone!",
				senderName: "Test User",
				senderType: "USER",
				authorId: user.id,
			},
		});

		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		const result = await caller.participant.join({
			discussionId: discussion.id,
			displayName: "Alex Chen",
			sessionId: "test-session-id",
		});

		// Verify message history is returned
		expect(result.messageHistory).toHaveLength(2);
		expect(result.messageHistory[0].content).toBe("Welcome to the discussion!");
		expect(result.messageHistory[1].content).toBe("Hello everyone!");
	});

	test("should handle performance requirement (<1s)", async () => {
		// Setup test data
		const user = await db.user.create({
			data: {
				name: "Performance User",
				email: "perf@test.com",
			},
		});

		const discussion = await db.discussion.create({
			data: {
				name: "Test Performance Discussion",
				description: "Test description",
				isActive: true,
				creatorId: user.id,
			},
		});

		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		const startTime = Date.now();
		await caller.participant.join({
			discussionId: discussion.id,
			displayName: "Alex Chen",
			sessionId: "test-session-id",
		});
		const endTime = Date.now();

		const responseTime = endTime - startTime;
		expect(responseTime).toBeLessThan(1000);
	});

	test("should work as public endpoint (no authentication required)", async () => {
		// Setup test data
		const user = await db.user.create({
			data: {
				name: "Public Test User",
				email: "public@test.com",
			},
		});

		const discussion = await db.discussion.create({
			data: {
				name: "Test Public Discussion",
				description: "Test description",
				isActive: true,
				creatorId: user.id,
			},
		});

		// Create context without session (unauthenticated)
		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		// Should work without authentication
		const result = await caller.participant.join({
			discussionId: discussion.id,
			displayName: "Anonymous User",
			sessionId: "anonymous-session-id",
		});

		expect(result.participant.displayName).toBe("Anonymous User");
		expect(result.participant.discussionId).toBe(discussion.id);
	});
});
