import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import { db } from "@/server/db";
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
 * Contract Test: participant.leave
 *
 * Tests the tRPC procedure that allows participants to leave discussions.
 * Based on contract specification in participant-trpc-router.yaml
 *
 * This test MUST FAIL initially to follow TDD red-green-refactor cycle.
 */

describe("participant.leave", () => {
	let testUser: { id: string };
	let testLesson: { id: string };
	let testDiscussion: { id: string };
	let testParticipant: { id: string };

	const mockCtx = {
		db,
		session: null, // No authentication required for participants
	};

	beforeAll(async () => {
		// Create test user
		testUser = await db.user.create({
			data: {
				email: "test-user-leave@example.com",
				name: "Test User Leave",
			},
		});

		// Create test lesson
		testLesson = await db.lesson.create({
			data: {
				title: "Test Lesson for Leave",
				description: "Test lesson description",
				content: "Test lesson content",
				creatorId: testUser.id,
				isPublished: true,
			},
		});

		// Create test discussion
		testDiscussion = await db.discussion.create({
			data: {
				title: "Test Discussion for Leaving",
				status: "active",
				createdBy: testUser.id,
				lessonId: testLesson.id,
			},
		});
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
		// Create a test participant for each test
		const participant = await db.participant.create({
			data: {
				discussionId: testDiscussion.id,
				displayName: "Test Participant",
				sessionId: "test-session-leave",
			},
		});
		testParticipant = { id: participant.id };
	});

	afterEach(async () => {
		// Clean up participants after each test
		await db.participant.deleteMany({
			where: { discussionId: testDiscussion.id },
		});
	});

	describe("Successful leave scenarios", () => {
		it("should mark participant as left when leaving discussion", async () => {
			const caller = appRouter.createCaller(mockCtx);

			// Leave the discussion
			await caller.participant.leave({
				participantId: testParticipant.id,
			});

			// Verify participant is marked as left
			const updatedParticipant = await db.participant.findUnique({
				where: { id: testParticipant.id },
			});

			expect(updatedParticipant).toBeTruthy();
			expect(updatedParticipant?.leftAt).toBeTruthy();
			expect(updatedParticipant?.leftAt).toBeInstanceOf(Date);
		});

		it("should return success response with no content", async () => {
			const caller = appRouter.createCaller(mockCtx);

			// Based on contract, leave should return success (200) with no specific content
			const result = await caller.participant.leave({
				participantId: testParticipant.id,
			});

			// Should not throw and should return successfully
			expect(result).toBeDefined();
		});

		it("should handle leaving multiple times gracefully", async () => {
			const caller = appRouter.createCaller(mockCtx);

			// Leave first time
			await caller.participant.leave({
				participantId: testParticipant.id,
			});

			// Leave second time - should not throw
			await expect(
				caller.participant.leave({
					participantId: testParticipant.id,
				}),
			).resolves.toBeDefined();

			// Verify participant still has leftAt timestamp
			const participant = await db.participant.findUnique({
				where: { id: testParticipant.id },
			});

			expect(participant?.leftAt).toBeTruthy();
		});
	});

	describe("Failed leave scenarios", () => {
		it("should reject leave request for non-existent participant", async () => {
			const caller = appRouter.createCaller(mockCtx);

			await expect(
				caller.participant.leave({
					participantId: "non-existent-participant-id",
				}),
			).rejects.toThrow("Participant not found");
		});

		it("should handle malformed participant ID", async () => {
			const caller = appRouter.createCaller(mockCtx);

			await expect(
				caller.participant.leave({
					participantId: "invalid-id-format",
				}),
			).rejects.toThrow();
		});
	});

	describe("Input validation", () => {
		it("should require participantId parameter", async () => {
			const caller = appRouter.createCaller(mockCtx);

			await expect(
				caller.participant.leave({
					// @ts-expect-error - Testing missing required field
				}),
			).rejects.toThrow();
		});

		it("should reject empty participantId", async () => {
			const caller = appRouter.createCaller(mockCtx);

			await expect(
				caller.participant.leave({
					participantId: "",
				}),
			).rejects.toThrow();
		});

		it("should reject null participantId", async () => {
			const caller = appRouter.createCaller(mockCtx);

			await expect(
				caller.participant.leave({
					// @ts-expect-error - Testing invalid type
					participantId: null,
				}),
			).rejects.toThrow();
		});

		it("should reject undefined participantId", async () => {
			const caller = appRouter.createCaller(mockCtx);

			await expect(
				caller.participant.leave({
					// @ts-expect-error - Testing invalid type
					participantId: undefined,
				}),
			).rejects.toThrow();
		});
	});

	describe("Leave behavior edge cases", () => {
		it("should preserve original joinedAt timestamp when leaving", async () => {
			const originalParticipant = await db.participant.findUnique({
				where: { id: testParticipant.id },
			});
			const originalJoinedAt = originalParticipant?.joinedAt;

			const caller = appRouter.createCaller(mockCtx);

			await caller.participant.leave({
				participantId: testParticipant.id,
			});

			const updatedParticipant = await db.participant.findUnique({
				where: { id: testParticipant.id },
			});

			expect(updatedParticipant?.joinedAt).toEqual(originalJoinedAt);
			expect(updatedParticipant?.leftAt).toBeTruthy();
			expect(updatedParticipant?.leftAt).not.toEqual(originalJoinedAt);
		});

		it("should preserve participant display name and session after leaving", async () => {
			const originalParticipant = await db.participant.findUnique({
				where: { id: testParticipant.id },
			});

			const caller = appRouter.createCaller(mockCtx);

			await caller.participant.leave({
				participantId: testParticipant.id,
			});

			const updatedParticipant = await db.participant.findUnique({
				where: { id: testParticipant.id },
			});

			expect(updatedParticipant?.displayName).toBe(
				originalParticipant?.displayName,
			);
			expect(updatedParticipant?.sessionId).toBe(
				originalParticipant?.sessionId,
			);
			expect(updatedParticipant?.discussionId).toBe(
				originalParticipant?.discussionId,
			);
		});

		it("should handle concurrent leave requests", async () => {
			const caller = appRouter.createCaller(mockCtx);

			// Simulate concurrent leave requests
			const leavePromise1 = caller.participant.leave({
				participantId: testParticipant.id,
			});

			const leavePromise2 = caller.participant.leave({
				participantId: testParticipant.id,
			});

			// Both should complete successfully
			await expect(
				Promise.all([leavePromise1, leavePromise2]),
			).resolves.toBeDefined();

			// Verify final state
			const participant = await db.participant.findUnique({
				where: { id: testParticipant.id },
			});

			expect(participant?.leftAt).toBeTruthy();
		});
	});

	describe("Integration with other operations", () => {
		it("should allow participant to join again after leaving", async () => {
			const caller = appRouter.createCaller(mockCtx);

			// Leave first
			await caller.participant.leave({
				participantId: testParticipant.id,
			});

			// Verify participant is marked as left
			const leftParticipant = await db.participant.findUnique({
				where: { id: testParticipant.id },
			});
			expect(leftParticipant?.leftAt).toBeTruthy();

			// Should be able to join again with same session
			const joinResult = await caller.participant.join({
				discussionId: testDiscussion.id,
				displayName: "Test Participant Rejoined",
				sessionId: "test-session-leave", // Same session ID
				ipAddress: "127.0.0.1",
			});

			expect(joinResult.participant.id).toBeTruthy();
			expect(joinResult.participant.displayName).toBe(
				"Test Participant Rejoined",
			);
			expect(joinResult.participant.leftAt).toBeNull(); // New participant record
		});

		it("should not affect message history when participant leaves", async () => {
			// Create some messages from the participant
			await db.message.create({
				data: {
					discussionId: testDiscussion.id,
					content: "Message from participant before leaving",
					senderType: "participant",
					senderId: testParticipant.id,
				},
			});

			const caller = appRouter.createCaller(mockCtx);

			// Leave the discussion
			await caller.participant.leave({
				participantId: testParticipant.id,
			});

			// Verify messages still exist
			const messages = await db.message.findMany({
				where: {
					discussionId: testDiscussion.id,
					senderId: testParticipant.id,
				},
			});

			expect(messages).toHaveLength(1);
			expect(messages[0]?.content).toBe(
				"Message from participant before leaving",
			);

			// Cleanup messages
			await db.message.deleteMany({
				where: { discussionId: testDiscussion.id },
			});
		});
	});
});
