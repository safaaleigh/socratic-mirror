// T002: Contract test invitation.validate
import { afterEach, describe, expect, test } from "vitest";

import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import { db } from "@/server/db";

// Cleanup function
afterEach(async () => {
	// Clean up test data
	await db.invitation.deleteMany({
		where: { recipientEmail: { contains: "@test" } },
	});
	await db.discussionParticipant.deleteMany({
		where: { userId: { contains: "test-" } },
	});
	await db.discussion.deleteMany({ where: { name: { contains: "Test " } } });
	await db.user.deleteMany({ where: { email: { contains: "@test" } } });
});

// Test invitation.validate contract compliance
describe("invitation.validate Contract", () => {
	test("should validate request schema - valid CUID token", async () => {
		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		// Valid CUID format should not throw validation error
		// For TDD: This should fail due to missing test data, not schema validation
		const result = await caller.invitation.validate({
			token: "cm123abc456def789ghi012jkl",
		});

		expect(result).toEqual({
			valid: false,
			reason: "Invitation not found",
		});
	});

	test("should reject invalid token format", async () => {
		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		// Invalid CUID format should be rejected by Zod validation
		await expect(
			caller.invitation.validate({ token: "invalid_token_123" }),
		).rejects.toThrow();
	});

	test("should return valid:true response for valid invitation", async () => {
		// Setup test data
		const discussion = await db.discussion.create({
			data: {
				name: "Test Discussion",
				description: "Test description",
				isActive: true,
				maxParticipants: 10,
				creatorId: "test-user-id",
			},
		});

		const invitation = await db.invitation.create({
			data: {
				type: "DISCUSSION",
				targetId: discussion.id,
				recipientEmail: "",
				senderId: "test-user-id",
				status: "PENDING",
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
			},
		});

		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		const result = await caller.invitation.validate({
			token: invitation.token,
		});

		// Verify response matches contract
		expect(result).toEqual({
			valid: true,
			discussion: {
				id: discussion.id,
				name: "Test Discussion",
				participantCount: 0,
				maxParticipants: 10,
			},
		});
	});

	test("should return valid:false for expired invitation", async () => {
		// Setup expired invitation
		const discussion = await db.discussion.create({
			data: {
				name: "Test Discussion",
				description: "Test description",
				isActive: true,
				creatorId: "test-user-id",
			},
		});

		const expiredInvitation = await db.invitation.create({
			data: {
				type: "DISCUSSION",
				targetId: discussion.id,
				recipientEmail: "",
				senderId: "test-user-id",
				status: "PENDING",
				expiresAt: new Date(Date.now() - 1000), // 1 second ago
			},
		});

		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		const result = await caller.invitation.validate({
			token: expiredInvitation.token,
		});

		expect(result).toEqual({
			valid: false,
			reason: "Invitation has expired",
		});
	});

	test("should return valid:false for full discussion", async () => {
		// Setup discussion at capacity
		const discussion = await db.discussion.create({
			data: {
				name: "Test Full Discussion",
				description: "Test description",
				isActive: true,
				maxParticipants: 1,
				creatorId: "test-user-id",
			},
		});

		// Add a participant to fill capacity
		await db.discussionParticipant.create({
			data: {
				discussionId: discussion.id,
				userId: "test-participant-user-id",
				role: "PARTICIPANT",
				status: "ACTIVE",
			},
		});

		const invitation = await db.invitation.create({
			data: {
				type: "DISCUSSION",
				targetId: discussion.id,
				recipientEmail: "",
				senderId: "test-user-id",
				status: "PENDING",
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
			},
		});

		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		const result = await caller.invitation.validate({
			token: invitation.token,
		});

		expect(result).toEqual({
			valid: false,
			reason: "Discussion is full",
		});
	});

	test("should handle performance requirement (<500ms)", async () => {
		const discussion = await db.discussion.create({
			data: {
				name: "Test Performance Discussion",
				description: "Test description",
				isActive: true,
				creatorId: "test-user-id",
			},
		});

		const invitation = await db.invitation.create({
			data: {
				type: "DISCUSSION",
				targetId: discussion.id,
				recipientEmail: "",
				senderId: "test-user-id",
				status: "PENDING",
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
			},
		});

		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		const startTime = Date.now();
		await caller.invitation.validate({ token: invitation.token });
		const endTime = Date.now();

		const responseTime = endTime - startTime;
		expect(responseTime).toBeLessThan(500);
	});
});
