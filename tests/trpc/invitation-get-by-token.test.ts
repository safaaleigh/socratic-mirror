// T003: Contract test invitation.getByToken
import { afterEach, describe, expect, test } from "vitest";

import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import { db } from "@/server/db";

// Cleanup function
afterEach(async () => {
	// Clean up test data
	await db.invitation.deleteMany({ where: { recipientEmail: { contains: "@test" } } });
	await db.discussion.deleteMany({ where: { name: { contains: "Test " } } });
	await db.user.deleteMany({ where: { email: { contains: "@test" } } });
});

// Test invitation.getByToken contract compliance
describe("invitation.getByToken Contract", () => {
	test("should validate request schema - valid CUID token", async () => {
		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		// Valid CUID format should not throw validation error
		// For TDD: Should fail due to missing test data, not schema validation
		await expect(
			caller.invitation.getByToken({ token: "cm123abc456def789ghi012jkl" })
		).rejects.toThrow("Invitation not found");
	});

	test("should return full invitation details for valid token", async () => {
		// Setup test data
		const user = await db.user.create({
			data: {
				name: "Dr. Sarah Wilson",
				email: "sarah@test.edu",
			},
		});

		const discussion = await db.discussion.create({
			data: {
				name: "Test Critical Thinking Workshop",
				description: "A discussion on analytical reasoning",
				isActive: true,
				creatorId: user.id,
			},
		});

		const invitation = await db.invitation.create({
			data: {
				type: "DISCUSSION",
				targetId: discussion.id,
				recipientEmail: "",
				senderId: user.id,
				message: "Looking forward to your insights on this topic!",
				status: "PENDING",
				expiresAt: new Date("2025-09-16T12:00:00Z"),
			},
		});

		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		const result = await caller.invitation.getByToken({ token: invitation.token });

		// Verify response matches contract schema
		expect(result).toEqual({
			id: invitation.id,
			type: "DISCUSSION",
			targetId: discussion.id,
			recipientEmail: "",
			recipientId: null,
			senderId: user.id,
			sender: {
				id: user.id,
				name: "Dr. Sarah Wilson",
				email: "sarah@test.edu",
			},
			message: "Looking forward to your insights on this topic!",
			token: invitation.token,
			status: "PENDING",
			expiresAt: invitation.expiresAt,
			acceptedAt: null,
			declinedAt: null,
			createdAt: invitation.createdAt,
		});
	});

	test("should throw NOT_FOUND error for invalid token", async () => {
		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		await expect(
			caller.invitation.getByToken({ token: "cm123invalid456token" })
		).rejects.toThrow("Invitation not found");
	});

	test("should throw PRECONDITION_FAILED error for expired invitation", async () => {
		// Setup expired invitation
		const user = await db.user.create({
			data: {
				name: "Test User",
				email: "test@test.com",
			},
		});

		const discussion = await db.discussion.create({
			data: {
				name: "Test Expired Discussion",
				description: "Test description",
				isActive: true,
				creatorId: user.id,
			},
		});

		const expiredInvitation = await db.invitation.create({
			data: {
				type: "DISCUSSION",
				targetId: discussion.id,
				recipientEmail: "",
				senderId: user.id,
				status: "PENDING",
				expiresAt: new Date(Date.now() - 1000), // 1 second ago
			},
		});

		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		await expect(
			caller.invitation.getByToken({ token: expiredInvitation.token })
		).rejects.toThrow("Invitation has expired");
	});

	test("should include sender information without sensitive data", async () => {
		// Setup test data
		const sender = await db.user.create({
			data: {
				name: "John Doe",
				email: "john@test.com",
			},
		});

		const discussion = await db.discussion.create({
			data: {
				name: "Test Discussion Sender",
				description: "Test description",
				isActive: true,
				creatorId: sender.id,
			},
		});

		const invitation = await db.invitation.create({
			data: {
				type: "DISCUSSION",
				targetId: discussion.id,
				recipientEmail: "",
				senderId: sender.id,
				status: "PENDING",
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
			},
		});

		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		const result = await caller.invitation.getByToken({ token: invitation.token });

		// Verify sender information is included correctly
		expect(result.sender).toEqual({
			id: sender.id,
			name: "John Doe",
			email: "john@test.com",
		});

		// Verify no sensitive internal data is exposed
		expect(result).not.toHaveProperty("internalData");
		expect(result).not.toHaveProperty("privateNotes");
	});

	test("should handle performance requirement (<300ms)", async () => {
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

		const invitation = await db.invitation.create({
			data: {
				type: "DISCUSSION",
				targetId: discussion.id,
				recipientEmail: "",
				senderId: user.id,
				status: "PENDING",
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
			},
		});

		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		const startTime = Date.now();
		await caller.invitation.getByToken({ token: invitation.token });
		const endTime = Date.now();

		const responseTime = endTime - startTime;
		expect(responseTime).toBeLessThan(300);
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

		const invitation = await db.invitation.create({
			data: {
				type: "DISCUSSION",
				targetId: discussion.id,
				recipientEmail: "",
				senderId: user.id,
				status: "PENDING",
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
			},
		});

		// Create context without session (unauthenticated)
		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		// Should work without authentication
		const result = await caller.invitation.getByToken({ token: invitation.token });

		expect(result.id).toBe(invitation.id);
		expect(result.sender.name).toBe("Public Test User");
	});
});