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
 * Contract Test: participant.getMessageHistory
 *
 * Tests the tRPC procedure that retrieves paginated message history for discussions.
 * Based on contract specification in participant-trpc-router.yaml
 *
 * This test MUST FAIL initially to follow TDD red-green-refactor cycle.
 */

describe("participant.getMessageHistory", () => {
	let testUser: { id: string };
	let testLesson: { id: string };
	let testDiscussion: { id: string };
	let testParticipant: { id: string };
	let testMessages: Array<{ id: string; createdAt: Date }> = [];

	const mockCtx = {
		db,
		session: null, // No authentication required for participants
	};

	beforeAll(async () => {
		// Create test user
		testUser = await db.user.create({
			data: {
				email: "test-user-history@example.com",
				name: "Test User History",
			},
		});

		// Create test lesson
		testLesson = await db.lesson.create({
			data: {
				title: "Test Lesson for History",
				description: "Test lesson description",
				content: "Test lesson content",
				creatorId: testUser.id,
				isPublished: true,
			},
		});

		// Create test discussion
		testDiscussion = await db.discussion.create({
			data: {
				title: "Test Discussion for Message History",
				status: "active",
				createdBy: testUser.id,
				lessonId: testLesson.id,
			},
		});

		// Create test participant
		const participant = await db.participant.create({
			data: {
				discussionId: testDiscussion.id,
				displayName: "History Test Participant",
				sessionId: "history-session-test",
			},
		});
		testParticipant = { id: participant.id };
	});

	afterAll(async () => {
		// Cleanup test data
		await db.message.deleteMany({
			where: { discussionId: testDiscussion.id },
		});
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
		// Create test messages for each test
		const now = new Date();
		const messages = [];

		// Create 25 messages with staggered timestamps for pagination testing
		for (let i = 0; i < 25; i++) {
			const messageTime = new Date(now.getTime() - i * 60000); // 1 minute apart
			const senderType =
				i % 3 === 0 ? "user" : i % 3 === 1 ? "participant" : "system";
			const senderId =
				senderType === "user"
					? testUser.id
					: senderType === "participant"
						? testParticipant.id
						: null;

			const message = await db.message.create({
				data: {
					discussionId: testDiscussion.id,
					content: `Test message ${i + 1}`,
					senderType: senderType as any,
					senderId: senderId,
					createdAt: messageTime,
				},
			});

			messages.push({ id: message.id, createdAt: messageTime });
		}

		// Sort by creation time (newest first for reference)
		testMessages = messages.sort(
			(a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
		);
	});

	afterEach(async () => {
		// Clean up messages after each test
		await db.message.deleteMany({
			where: { discussionId: testDiscussion.id },
		});
		testMessages = [];
	});

	describe("Basic message history retrieval", () => {
		it("should return message history with correct structure", async () => {
			const caller = appRouter.createCaller(mockCtx);

			const result = await caller.participant.getMessageHistory({
				discussionId: testDiscussion.id,
			});

			// Contract assertions based on MessageHistoryOutput schema
			expect(result.messages).toBeDefined();
			expect(Array.isArray(result.messages)).toBe(true);
			expect(result.hasMore).toBeDefined();
			expect(typeof result.hasMore).toBe("boolean");

			// Should return default limit (20 messages)
			expect(result.messages.length).toBe(20);
			expect(result.hasMore).toBe(true); // Should have 5 more messages

			// Each message should follow MessageSummary schema
			const firstMessage = result.messages[0];
			expect(firstMessage.id).toBeTruthy();
			expect(firstMessage.content).toBeTruthy();
			expect(firstMessage.senderName).toBeTruthy();
			expect(firstMessage.senderType).toMatch(/^(user|participant|system)$/);
			expect(firstMessage.createdAt).toBeTruthy();

			// Messages should be in chronological order (oldest first)
			for (let i = 1; i < result.messages.length; i++) {
				const prevDate = new Date(result.messages[i - 1].createdAt);
				const currDate = new Date(result.messages[i].createdAt);
				expect(prevDate.getTime()).toBeLessThanOrEqual(currDate.getTime());
			}
		});

		it("should return empty history for discussion with no messages", async () => {
			// Clean up all messages
			await db.message.deleteMany({
				where: { discussionId: testDiscussion.id },
			});

			const caller = appRouter.createCaller(mockCtx);

			const result = await caller.participant.getMessageHistory({
				discussionId: testDiscussion.id,
			});

			expect(result.messages).toEqual([]);
			expect(result.hasMore).toBe(false);
		});

		it("should handle discussion with fewer messages than default limit", async () => {
			// Clean up and create only 5 messages
			await db.message.deleteMany({
				where: { discussionId: testDiscussion.id },
			});

			const now = new Date();
			for (let i = 0; i < 5; i++) {
				await db.message.create({
					data: {
						discussionId: testDiscussion.id,
						content: `Message ${i + 1}`,
						senderType: "system",
						senderId: null,
						createdAt: new Date(now.getTime() - i * 60000),
					},
				});
			}

			const caller = appRouter.createCaller(mockCtx);

			const result = await caller.participant.getMessageHistory({
				discussionId: testDiscussion.id,
			});

			expect(result.messages).toHaveLength(5);
			expect(result.hasMore).toBe(false);
		});
	});

	describe("Pagination functionality", () => {
		it("should respect custom limit parameter", async () => {
			const caller = appRouter.createCaller(mockCtx);

			const result = await caller.participant.getMessageHistory({
				discussionId: testDiscussion.id,
				limit: 10,
			});

			expect(result.messages).toHaveLength(10);
			expect(result.hasMore).toBe(true); // Should have 15 more messages
		});

		it("should handle cursor-based pagination with before parameter", async () => {
			const caller = appRouter.createCaller(mockCtx);

			// Get first page
			const firstPage = await caller.participant.getMessageHistory({
				discussionId: testDiscussion.id,
				limit: 10,
			});

			expect(firstPage.messages).toHaveLength(10);
			expect(firstPage.hasMore).toBe(true);

			// Get second page using cursor
			const lastMessageId =
				firstPage.messages[firstPage.messages.length - 1].id;
			const secondPage = await caller.participant.getMessageHistory({
				discussionId: testDiscussion.id,
				limit: 10,
				before: lastMessageId,
			});

			expect(secondPage.messages).toHaveLength(10);
			expect(secondPage.hasMore).toBe(true);

			// Messages should be different between pages
			const firstPageIds = new Set(firstPage.messages.map((m) => m.id));
			const secondPageIds = new Set(secondPage.messages.map((m) => m.id));

			// No overlap between pages
			const intersection = new Set(
				[...firstPageIds].filter((id) => secondPageIds.has(id)),
			);
			expect(intersection.size).toBe(0);
		});

		it("should handle final page correctly", async () => {
			const caller = appRouter.createCaller(mockCtx);

			// Get first 20 messages
			const firstPage = await caller.participant.getMessageHistory({
				discussionId: testDiscussion.id,
				limit: 20,
			});

			// Get remaining messages (should be 5)
			const lastMessageId =
				firstPage.messages[firstPage.messages.length - 1].id;
			const lastPage = await caller.participant.getMessageHistory({
				discussionId: testDiscussion.id,
				limit: 20,
				before: lastMessageId,
			});

			expect(lastPage.messages).toHaveLength(5);
			expect(lastPage.hasMore).toBe(false);
		});

		it("should handle pagination beyond available messages", async () => {
			const caller = appRouter.createCaller(mockCtx);

			// Try to get messages before the earliest message
			const oldestMessageId = testMessages[testMessages.length - 1].id;

			const result = await caller.participant.getMessageHistory({
				discussionId: testDiscussion.id,
				limit: 10,
				before: oldestMessageId,
			});

			expect(result.messages).toHaveLength(0);
			expect(result.hasMore).toBe(false);
		});
	});

	describe("Input validation", () => {
		it("should require discussionId parameter", async () => {
			const caller = appRouter.createCaller(mockCtx);

			await expect(
				caller.participant.getMessageHistory({
					// @ts-expect-error - Testing missing required field
					limit: 20,
				}),
			).rejects.toThrow();
		});

		it("should reject empty discussionId", async () => {
			const caller = appRouter.createCaller(mockCtx);

			await expect(
				caller.participant.getMessageHistory({
					discussionId: "",
				}),
			).rejects.toThrow();
		});

		it("should enforce minimum limit of 1", async () => {
			const caller = appRouter.createCaller(mockCtx);

			await expect(
				caller.participant.getMessageHistory({
					discussionId: testDiscussion.id,
					limit: 0,
				}),
			).rejects.toThrow();
		});

		it("should enforce maximum limit of 50", async () => {
			const caller = appRouter.createCaller(mockCtx);

			await expect(
				caller.participant.getMessageHistory({
					discussionId: testDiscussion.id,
					limit: 51,
				}),
			).rejects.toThrow();
		});

		it("should handle invalid before cursor gracefully", async () => {
			const caller = appRouter.createCaller(mockCtx);

			const result = await caller.participant.getMessageHistory({
				discussionId: testDiscussion.id,
				before: "invalid-message-id",
			});

			// Should return empty results for invalid cursor
			expect(result.messages).toEqual([]);
			expect(result.hasMore).toBe(false);
		});

		it("should handle non-existent discussion", async () => {
			const caller = appRouter.createCaller(mockCtx);

			await expect(
				caller.participant.getMessageHistory({
					discussionId: "non-existent-discussion-id",
				}),
			).rejects.toThrow("Discussion not found");
		});
	});

	describe("Message content and sender types", () => {
		it("should return correct sender information for different message types", async () => {
			// Clean up and create specific message types
			await db.message.deleteMany({
				where: { discussionId: testDiscussion.id },
			});

			// Create user message
			await db.message.create({
				data: {
					discussionId: testDiscussion.id,
					content: "User message",
					senderType: "user",
					senderId: testUser.id,
				},
			});

			// Create participant message
			await db.message.create({
				data: {
					discussionId: testDiscussion.id,
					content: "Participant message",
					senderType: "participant",
					senderId: testParticipant.id,
				},
			});

			// Create system message
			await db.message.create({
				data: {
					discussionId: testDiscussion.id,
					content: "System message",
					senderType: "system",
					senderId: null,
				},
			});

			const caller = appRouter.createCaller(mockCtx);

			const result = await caller.participant.getMessageHistory({
				discussionId: testDiscussion.id,
			});

			expect(result.messages).toHaveLength(3);

			// Find each message type
			const userMessage = result.messages.find((m) => m.senderType === "user");
			const participantMessage = result.messages.find(
				(m) => m.senderType === "participant",
			);
			const systemMessage = result.messages.find(
				(m) => m.senderType === "system",
			);

			expect(userMessage?.content).toBe("User message");
			expect(userMessage?.senderName).toBeTruthy();

			expect(participantMessage?.content).toBe("Participant message");
			expect(participantMessage?.senderName).toBeTruthy();

			expect(systemMessage?.content).toBe("System message");
			expect(systemMessage?.senderName).toBeTruthy();
		});

		it("should handle messages with special characters and formatting", async () => {
			await db.message.deleteMany({
				where: { discussionId: testDiscussion.id },
			});

			await db.message.create({
				data: {
					discussionId: testDiscussion.id,
					content:
						"Message with 🚀 emoji, **markdown**, and <script>alert('xss')</script>",
					senderType: "user",
					senderId: testUser.id,
				},
			});

			const caller = appRouter.createCaller(mockCtx);

			const result = await caller.participant.getMessageHistory({
				discussionId: testDiscussion.id,
			});

			expect(result.messages).toHaveLength(1);
			expect(result.messages[0].content).toBe(
				"Message with 🚀 emoji, **markdown**, and <script>alert('xss')</script>",
			);
		});
	});

	describe("Performance and edge cases", () => {
		it("should handle large message counts efficiently", async () => {
			// This test ensures the pagination works with large datasets
			const caller = appRouter.createCaller(mockCtx);

			const startTime = Date.now();
			const result = await caller.participant.getMessageHistory({
				discussionId: testDiscussion.id,
				limit: 50,
			});
			const endTime = Date.now();

			// Should complete within reasonable time (2 seconds)
			expect(endTime - startTime).toBeLessThan(2000);
			expect(result.messages.length).toBeGreaterThan(0);
		});

		it("should maintain consistent ordering across multiple requests", async () => {
			const caller = appRouter.createCaller(mockCtx);

			// Get same page multiple times
			const requests = Array(5)
				.fill(null)
				.map(() =>
					caller.participant.getMessageHistory({
						discussionId: testDiscussion.id,
						limit: 10,
					}),
				);

			const results = await Promise.all(requests);

			// All results should be identical
			const firstResult = JSON.stringify(results[0]);
			results.forEach((result, index) => {
				expect(JSON.stringify(result)).toBe(firstResult);
			});
		});
	});
});
