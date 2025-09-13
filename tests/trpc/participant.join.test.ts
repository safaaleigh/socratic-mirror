import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import { db } from "@/server/db";
import jwt from "jsonwebtoken";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "vitest";

/**
 * Contract Test: participant.join
 *
 * Tests the tRPC procedure that allows anonymous participants to join discussions.
 * Based on contract specification in participant-trpc-router.yaml
 *
 * This test MUST FAIL initially to follow TDD red-green-refactor cycle.
 */

describe("participant.join", () => {
	let testUser: { id: string };
	let testLesson: { id: string };
	let testDiscussion: { id: string };
	let validToken: string;
	let expiredToken: string;

	const mockCtx = {
		db,
		session: null, // No authentication required for participants
	};

	beforeAll(async () => {
		// Create test user
		testUser = await db.user.create({
			data: {
				email: "test-user@example.com",
				name: "Test User",
			},
		});

		// Create test lesson
		testLesson = await db.lesson.create({
			data: {
				title: "Test Lesson",
				description: "Test lesson description",
				content: "Test lesson content",
				creatorId: testUser.id,
				isPublished: true,
			},
		});

		// Create test discussion
		testDiscussion = await db.discussion.create({
			data: {
				title: "Test Discussion for Joining",
				status: "active",
				createdBy: testUser.id,
				lessonId: testLesson.id,
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
		await db.participant.deleteMany({
			where: { discussionId: testDiscussion.id },
		});
		await db.discussion.delete({
			where: { id: testDiscussion.id },
		});
		await db.lesson.delete({
			where: { id: testLesson.id },
		});
		await db.user.delete({
			where: { id: testUser.id },
		});
	});

	beforeEach(async () => {
		// Clean up any participants from previous tests
		await db.participant.deleteMany({
			where: { discussionId: testDiscussion.id },
		});
	});

	afterEach(async () => {
		// Clean up participants after each test
		await db.participant.deleteMany({
			where: { discussionId: testDiscussion.id },
		});
	});

	describe("Successful join scenarios", () => {
		it("should join discussion with valid invitation and return participant info", async () => {
			const caller = appRouter.createCaller(mockCtx);

			const result = await caller.participant.join({
				discussionId: testDiscussion.id,
				displayName: "Test Participant",
				sessionId: "test-session-123",
				ipAddress: "127.0.0.1",
			});

			// Contract assertions based on ParticipantJoinOutput schema
			expect(result.participant).toBeDefined();
			expect(result.participant.id).toBeTruthy();
			expect(result.participant.discussionId).toBe(testDiscussion.id);
			expect(result.participant.displayName).toBe("Test Participant");
			expect(result.participant.joinedAt).toBeTruthy();
			expect(result.participant.leftAt).toBeNull();

			expect(result.messageHistory).toBeDefined();
			expect(Array.isArray(result.messageHistory)).toBe(true);
		});

		it("should return recent message history when joining", async () => {
			// Create some test messages first
			const message1 = await db.message.create({
				data: {
					discussionId: testDiscussion.id,
					content: "First message",
					senderType: "user",
					senderId: testUser.id,
				},
			});

			const message2 = await db.message.create({
				data: {
					discussionId: testDiscussion.id,
					content: "Second message",
					senderType: "system",
					senderId: null,
				},
			});

			const caller = appRouter.createCaller(mockCtx);

			const result = await caller.participant.join({
				discussionId: testDiscussion.id,
				displayName: "Test Participant",
				sessionId: "test-session-456",
				ipAddress: "127.0.0.1",
			});

			// Should return message history
			expect(result.messageHistory).toHaveLength(2);

			// Messages should have correct structure per MessageSummary schema
			const firstMessage = result.messageHistory[0];
			expect(firstMessage.id).toBeTruthy();
			expect(firstMessage.content).toBeTruthy();
			expect(firstMessage.senderName).toBeTruthy();
			expect(firstMessage.senderType).toMatch(/^(user|participant|system)$/);
			expect(firstMessage.createdAt).toBeTruthy();

			// Cleanup messages
			await db.message.deleteMany({
				where: { discussionId: testDiscussion.id },
			});
		});

		it("should allow rejoining after leaving", async () => {
			const caller = appRouter.createCaller(mockCtx);

			// Join first time
			const joinResult = await caller.participant.join({
				discussionId: testDiscussion.id,
				displayName: "Test Participant",
				sessionId: "test-session-789",
				ipAddress: "127.0.0.1",
			});

			const participantId = joinResult.participant.id;

			// Leave
			await caller.participant.leave({
				participantId: participantId,
			});

			// Join again
			const rejoinResult = await caller.participant.join({
				discussionId: testDiscussion.id,
				displayName: "Test Participant Rejoined",
				sessionId: "test-session-789",
				ipAddress: "127.0.0.1",
			});

			expect(rejoinResult.participant.id).toBeTruthy();
			expect(rejoinResult.participant.displayName).toBe(
				"Test Participant Rejoined",
			);
			expect(rejoinResult.participant.leftAt).toBeNull(); // Should be null for new join
		});
	});

	describe("Failed join scenarios", () => {
		it("should reject join for non-existent discussion", async () => {
			const caller = appRouter.createCaller(mockCtx);

			await expect(
				caller.participant.join({
					discussionId: "non-existent-discussion-id",
					displayName: "Test Participant",
					sessionId: "test-session-404",
					ipAddress: "127.0.0.1",
				}),
			).rejects.toThrow("Discussion not found");
		});

		it("should reject join for completed discussion", async () => {
			// Create completed discussion
			const completedDiscussion = await db.discussion.create({
				data: {
					title: "Completed Discussion",
					status: "completed",
					createdBy: testUser.id,
					lessonId: testLesson.id,
				},
			});

			const caller = appRouter.createCaller(mockCtx);

			await expect(
				caller.participant.join({
					discussionId: completedDiscussion.id,
					displayName: "Test Participant",
					sessionId: "test-session-completed",
					ipAddress: "127.0.0.1",
				}),
			).rejects.toThrow("Discussion has ended");

			// Cleanup
			await db.discussion.delete({ where: { id: completedDiscussion.id } });
		});

		it("should reject join for cancelled discussion", async () => {
			// Create cancelled discussion
			const cancelledDiscussion = await db.discussion.create({
				data: {
					title: "Cancelled Discussion",
					status: "cancelled",
					createdBy: testUser.id,
					lessonId: testLesson.id,
				},
			});

			const caller = appRouter.createCaller(mockCtx);

			await expect(
				caller.participant.join({
					discussionId: cancelledDiscussion.id,
					displayName: "Test Participant",
					sessionId: "test-session-cancelled",
					ipAddress: "127.0.0.1",
				}),
			).rejects.toThrow("Discussion has ended");

			// Cleanup
			await db.discussion.delete({ where: { id: cancelledDiscussion.id } });
		});

		it("should reject join when discussion is at capacity", async () => {
			// Create discussion with max participants of 2
			const limitedDiscussion = await db.discussion.create({
				data: {
					title: "Limited Discussion",
					status: "active",
					createdBy: testUser.id,
					lessonId: testLesson.id,
					maxParticipants: 2,
				},
			});

			// Add 2 participants to reach capacity
			await db.participant.createMany({
				data: [
					{
						discussionId: limitedDiscussion.id,
						displayName: "Participant 1",
						sessionId: "session-1",
					},
					{
						discussionId: limitedDiscussion.id,
						displayName: "Participant 2",
						sessionId: "session-2",
					},
				],
			});

			const caller = appRouter.createCaller(mockCtx);

			await expect(
				caller.participant.join({
					discussionId: limitedDiscussion.id,
					displayName: "Test Participant",
					sessionId: "test-session-full",
					ipAddress: "127.0.0.1",
				}),
			).rejects.toThrow("Discussion is at capacity");

			// Cleanup
			await db.participant.deleteMany({
				where: { discussionId: limitedDiscussion.id },
			});
			await db.discussion.delete({ where: { id: limitedDiscussion.id } });
		});
	});

	describe("Input validation", () => {
		it("should require discussionId parameter", async () => {
			const caller = appRouter.createCaller(mockCtx);

			await expect(
				caller.participant.join({
					// @ts-expect-error - Testing missing required field
					displayName: "Test Participant",
					sessionId: "test-session-123",
					ipAddress: "127.0.0.1",
				}),
			).rejects.toThrow();
		});

		it("should require displayName parameter", async () => {
			const caller = appRouter.createCaller(mockCtx);

			await expect(
				caller.participant.join({
					discussionId: testDiscussion.id,
					// @ts-expect-error - Testing missing required field
					sessionId: "test-session-123",
					ipAddress: "127.0.0.1",
				}),
			).rejects.toThrow();
		});

		it("should require sessionId parameter", async () => {
			const caller = appRouter.createCaller(mockCtx);

			await expect(
				caller.participant.join({
					discussionId: testDiscussion.id,
					displayName: "Test Participant",
					// @ts-expect-error - Testing missing required field
					ipAddress: "127.0.0.1",
				}),
			).rejects.toThrow();
		});

		it("should reject empty displayName", async () => {
			const caller = appRouter.createCaller(mockCtx);

			await expect(
				caller.participant.join({
					discussionId: testDiscussion.id,
					displayName: "",
					sessionId: "test-session-123",
					ipAddress: "127.0.0.1",
				}),
			).rejects.toThrow();
		});

		it("should reject displayName longer than 50 characters", async () => {
			const caller = appRouter.createCaller(mockCtx);
			const longName = "A".repeat(51); // 51 characters, exceeds maxLength: 50

			await expect(
				caller.participant.join({
					discussionId: testDiscussion.id,
					displayName: longName,
					sessionId: "test-session-123",
					ipAddress: "127.0.0.1",
				}),
			).rejects.toThrow();
		});
	});

	describe("Edge cases", () => {
		it("should handle participant with same sessionId but different displayName", async () => {
			const caller = appRouter.createCaller(mockCtx);
			const sessionId = "duplicate-session-test";

			// First join
			await caller.participant.join({
				discussionId: testDiscussion.id,
				displayName: "First Name",
				sessionId: sessionId,
				ipAddress: "127.0.0.1",
			});

			// Second join with same session but different name should succeed
			const result = await caller.participant.join({
				discussionId: testDiscussion.id,
				displayName: "Second Name",
				sessionId: sessionId,
				ipAddress: "127.0.0.1",
			});

			expect(result.participant.displayName).toBe("Second Name");
		});

		it("should handle special characters in displayName", async () => {
			const caller = appRouter.createCaller(mockCtx);

			const result = await caller.participant.join({
				discussionId: testDiscussion.id,
				displayName: "Test 🚀 Émoji & Special-Chars",
				sessionId: "special-chars-session",
				ipAddress: "127.0.0.1",
			});

			expect(result.participant.displayName).toBe(
				"Test 🚀 Émoji & Special-Chars",
			);
		});
	});
});
