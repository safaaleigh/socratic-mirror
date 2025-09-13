import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import { db } from "@/server/db";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Contract Test: participant.validateInvitation
 *
 * Tests the tRPC procedure that validates invitation links and returns discussion info.
 * Based on contract specification in participant-trpc-router.yaml
 *
 * This test MUST FAIL initially to follow TDD red-green-refactor cycle.
 */

describe("participant.validateInvitation", () => {
	let testDiscussion: { id: string };
	let validToken: string;
	let expiredToken: string;

	const mockCtx = {
		db,
		session: null, // No authentication required for participants
	};

	beforeAll(async () => {
		// Create test discussion
		testDiscussion = await db.discussion.create({
			data: {
				title: "Test Discussion for Invitation",
				status: "active",
				createdBy: "test-user-id", // Would be real user ID in actual implementation
				lessonId: "test-lesson-id", // Would be real lesson ID in actual implementation
				invitationToken: null, // Will be set during test
			},
		});

		// Create valid token
		validToken = jwt.sign(
			{
				discussionId: testDiscussion.id,
				expiresAt: Date.now() + 3600000, // 1 hour from now
			},
			process.env.JWT_SECRET || "test-secret",
		);

		// Create expired token
		expiredToken = jwt.sign(
			{
				discussionId: testDiscussion.id,
				expiresAt: Date.now() - 3600000, // 1 hour ago
			},
			process.env.JWT_SECRET || "test-secret",
		);
	});

	afterAll(async () => {
		// Cleanup test data
		await db.discussion.delete({
			where: { id: testDiscussion.id },
		});
	});

	describe("Valid invitation scenarios", () => {
		it("should validate valid invitation token and return discussion info", async () => {
			const caller = appRouter.createCaller(mockCtx);

			const result = await caller.participant.validateInvitation({
				discussionId: testDiscussion.id,
				token: validToken,
			});

			// Contract assertions based on InvitationValidationOutput schema
			expect(result.valid).toBe(true);
			expect(result.discussion).toBeDefined();
			expect(result.discussion.id).toBe(testDiscussion.id);
			expect(result.discussion.title).toBe("Test Discussion for Invitation");
			expect(result.discussion.status).toBe("active");
			expect(result.discussion.participantCount).toBe(0); // No participants yet
			expect(result.discussion.maxParticipants).toBeNull(); // Unlimited
			expect(result.error).toBeUndefined();
		});

		it("should handle discussion with existing participants", async () => {
			// Create a participant to test participantCount
			const participant = await db.participant.create({
				data: {
					discussionId: testDiscussion.id,
					displayName: "Test Participant",
					sessionId: "test-session-123",
				},
			});

			const caller = appRouter.createCaller(mockCtx);
			const result = await caller.participant.validateInvitation({
				discussionId: testDiscussion.id,
				token: validToken,
			});

			expect(result.valid).toBe(true);
			expect(result.discussion.participantCount).toBe(1);

			// Cleanup
			await db.participant.delete({ where: { id: participant.id } });
		});
	});

	describe("Invalid invitation scenarios", () => {
		it("should reject expired invitation token", async () => {
			const caller = appRouter.createCaller(mockCtx);

			const result = await caller.participant.validateInvitation({
				discussionId: testDiscussion.id,
				token: expiredToken,
			});

			expect(result.valid).toBe(false);
			expect(result.error).toContain("expired");
			expect(result.discussion).toBeUndefined();
		});

		it("should reject malformed JWT token", async () => {
			const caller = appRouter.createCaller(mockCtx);

			const result = await caller.participant.validateInvitation({
				discussionId: testDiscussion.id,
				token: "invalid-jwt-token",
			});

			expect(result.valid).toBe(false);
			expect(result.error).toContain("Invalid invitation link");
			expect(result.discussion).toBeUndefined();
		});

		it("should reject invitation for non-existent discussion", async () => {
			const nonExistentToken = jwt.sign(
				{
					discussionId: "non-existent-id",
					expiresAt: Date.now() + 3600000,
				},
				process.env.JWT_SECRET || "test-secret",
			);

			const caller = appRouter.createCaller(mockCtx);

			const result = await caller.participant.validateInvitation({
				discussionId: "non-existent-id",
				token: nonExistentToken,
			});

			expect(result.valid).toBe(false);
			expect(result.error).toContain("Discussion not found");
			expect(result.discussion).toBeUndefined();
		});

		it("should reject invitation for completed discussion", async () => {
			// Create completed discussion
			const completedDiscussion = await db.discussion.create({
				data: {
					title: "Completed Discussion",
					status: "completed",
					createdBy: "test-user-id",
					lessonId: "test-lesson-id",
				},
			});

			const completedToken = jwt.sign(
				{
					discussionId: completedDiscussion.id,
					expiresAt: Date.now() + 3600000,
				},
				process.env.JWT_SECRET || "test-secret",
			);

			const caller = appRouter.createCaller(mockCtx);

			const result = await caller.participant.validateInvitation({
				discussionId: completedDiscussion.id,
				token: completedToken,
			});

			expect(result.valid).toBe(false);
			expect(result.error).toContain("Discussion has ended");
			expect(result.discussion).toBeUndefined();

			// Cleanup
			await db.discussion.delete({ where: { id: completedDiscussion.id } });
		});
	});

	describe("Input validation", () => {
		it("should require discussionId parameter", async () => {
			const caller = appRouter.createCaller(mockCtx);

			await expect(
				caller.participant.validateInvitation({
					// @ts-expect-error - Testing missing required field
					token: validToken,
				}),
			).rejects.toThrow();
		});

		it("should require token parameter", async () => {
			const caller = appRouter.createCaller(mockCtx);

			await expect(
				caller.participant.validateInvitation({
					discussionId: testDiscussion.id,
					// @ts-expect-error - Testing missing required field
				}),
			).rejects.toThrow();
		});
	});
});
