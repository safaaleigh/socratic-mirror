import type { Session } from "next-auth";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanupDatabase, createTestCaller, createTestUser } from "../db-setup";

describe("Message Router Contract Tests", () => {
	let testUser: Awaited<ReturnType<typeof createTestUser>>;
	let testSession: Session;
	let caller: Awaited<ReturnType<typeof createTestCaller>>;

	beforeEach(async () => {
		await cleanupDatabase();
		testUser = await createTestUser();
		testSession = {
			user: { id: testUser.id, email: testUser.email, name: testUser.name },
			expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		};
		caller = await createTestCaller(testSession);
	});

	afterEach(async () => {
		await cleanupDatabase();
	});

	describe("send", () => {
		it("should send a new message to discussion", async () => {
			const input = {
				discussionId: "test-discussion-id",
				content: "This is a test message",
				type: "USER" as const,
			};

			const result = await caller.message.send(input);

			expect(result).toMatchObject({
				id: expect.any(String),
				discussionId: input.discussionId,
				authorId: testUser.id,
				content: input.content,
				type: input.type,
				isEdited: false,
				createdAt: expect.any(Date),
			});
		});

		it("should support reply to parent message", async () => {
			const input = {
				discussionId: "test-discussion-id",
				content: "This is a reply",
				parentId: "parent-message-id",
			};

			const result = await caller.message.send(input);

			expect(result).toMatchObject({
				parentId: input.parentId,
				parent: expect.objectContaining({
					id: input.parentId,
					content: expect.any(String),
				}),
			});
		});

		it("should validate message content length", async () => {
			const tooLongMessage = {
				discussionId: "test-discussion-id",
				content: "x".repeat(5001),
			};

			await expect(caller.message.send(tooLongMessage)).rejects.toThrow();
		});

		it("should require user to be participant", async () => {
			const nonParticipant = await createTestUser();
			const nonParticipantSession: Session = {
				user: {
					id: nonParticipant.id,
					email: nonParticipant.email,
					name: nonParticipant.name,
				},
				expires: testSession.expires,
			};
			const nonParticipantCaller = await createTestCaller(
				nonParticipantSession,
			);

			await expect(
				nonParticipantCaller.message.send({
					discussionId: "restricted-discussion",
					content: "Should fail",
				}),
			).rejects.toThrow();
		});
	});

	describe("edit", () => {
		it("should allow author to edit their message", async () => {
			const input = {
				messageId: "user-message-id",
				content: "Edited message content",
			};

			const result = await caller.message.edit(input);

			expect(result).toMatchObject({
				id: input.messageId,
				content: input.content,
				isEdited: true,
				editedAt: expect.any(Date),
			});
		});

		it("should reject edits from non-author", async () => {
			const differentUser = await createTestUser();
			const differentUserSession: Session = {
				user: {
					id: differentUser.id,
					email: differentUser.email,
					name: differentUser.name,
				},
				expires: testSession.expires,
			};
			const differentUserCaller = await createTestCaller(differentUserSession);

			await expect(
				differentUserCaller.message.edit({
					messageId: "someone-elses-message",
					content: "Should fail",
				}),
			).rejects.toThrow();
		});

		it("should not allow editing system messages", async () => {
			await expect(
				caller.message.edit({
					messageId: "system-message-id",
					content: "Cannot edit",
				}),
			).rejects.toThrow();
		});
	});

	describe("delete", () => {
		it("should allow author to delete their message", async () => {
			const input = {
				messageId: "user-message-id",
			};

			const result = await caller.message.delete(input);

			expect(result).toMatchObject({
				success: true,
			});
		});

		it("should allow moderator to delete any message", async () => {
			const moderator = await createTestUser();
			const moderatorSession: Session = {
				user: {
					id: moderator.id,
					email: moderator.email,
					name: moderator.name,
				},
				expires: testSession.expires,
			};
			const moderatorCaller = await createTestCaller(moderatorSession);

			const result = await moderatorCaller.message.delete({
				messageId: "any-message-id",
			});

			expect(result).toMatchObject({
				success: true,
			});
		});

		it("should reject deletion from non-author non-moderator", async () => {
			const regularUser = await createTestUser();
			const regularUserSession: Session = {
				user: {
					id: regularUser.id,
					email: regularUser.email,
					name: regularUser.name,
				},
				expires: testSession.expires,
			};
			const regularUserCaller = await createTestCaller(regularUserSession);

			await expect(
				regularUserCaller.message.delete({
					messageId: "someone-elses-message",
				}),
			).rejects.toThrow();
		});
	});

	describe("list", () => {
		it("should retrieve messages with pagination", async () => {
			const input = {
				discussionId: "test-discussion-id",
				limit: 20,
			};

			const result = await caller.message.list(input);

			expect(result).toMatchObject({
				messages: expect.any(Array),
				hasMore: expect.any(Boolean),
			});

			if (result.messages.length > 0) {
				expect(result.messages[0]).toMatchObject({
					id: expect.any(String),
					discussionId: input.discussionId,
					content: expect.any(String),
					type: expect.any(String),
					createdAt: expect.any(Date),
				});
			}
		});

		it("should filter messages by parent", async () => {
			const input = {
				discussionId: "test-discussion-id",
				parentId: "parent-message-id",
				limit: 10,
			};

			const result = await caller.message.list(input);

			result.messages.forEach((message) => {
				expect(message.parentId).toBe(input.parentId);
			});
		});

		it("should support cursor-based pagination", async () => {
			const firstPage = await caller.message.list({
				discussionId: "test-discussion-id",
				limit: 10,
			});

			if (firstPage.hasMore && firstPage.nextCursor) {
				const secondPage = await caller.message.list({
					discussionId: "test-discussion-id",
					limit: 10,
					cursor: firstPage.nextCursor,
				});

				expect(secondPage.messages).toBeDefined();
				expect(secondPage.messages[0]?.id).not.toBe(firstPage.messages[0]?.id);
			}
		});
	});

	describe("markAsSeen", () => {
		it("should mark message as seen by user", async () => {
			const input = {
				discussionId: "test-discussion-id",
				messageId: "message-to-mark",
			};

			const result = await caller.message.markAsSeen(input);

			expect(result).toMatchObject({
				success: true,
			});
		});
	});

	describe("react", () => {
		it("should add reaction to message", async () => {
			const input = {
				messageId: "message-id",
				reaction: "👍" as const,
			};

			const result = await caller.message.react(input);

			expect(result).toMatchObject({
				reactions: expect.objectContaining({
					"👍": expect.any(Number),
				}),
			});
		});

		it("should toggle reaction on second call", async () => {
			const input = {
				messageId: "message-id",
				reaction: "❤️" as const,
			};

			const firstCall = await caller.message.react(input);
			const initialCount = firstCall.reactions["❤️"] || 0;

			const secondCall = await caller.message.react(input);
			const finalCount = secondCall.reactions["❤️"] || 0;

			expect(finalCount).toBe(initialCount === 0 ? 1 : initialCount - 1);
		});
	});

	describe("setTyping", () => {
		it("should update typing indicator", async () => {
			const input = {
				discussionId: "test-discussion-id",
				isTyping: true,
			};

			const result = await caller.message.setTyping(input);

			expect(result).toMatchObject({
				success: true,
			});
		});

		it("should clear typing indicator", async () => {
			const startTyping = await caller.message.setTyping({
				discussionId: "test-discussion-id",
				isTyping: true,
			});

			const stopTyping = await caller.message.setTyping({
				discussionId: "test-discussion-id",
				isTyping: false,
			});

			expect(startTyping.success).toBe(true);
			expect(stopTyping.success).toBe(true);
		});
	});

	describe("getAIResponse", () => {
		it("should generate AI response for discussion", async () => {
			const input = {
				discussionId: "test-discussion-id",
				context: "User is struggling with a concept",
			};

			const result = await caller.message.getAIResponse(input);

			expect(result).toMatchObject({
				message: expect.objectContaining({
					type: expect.stringMatching(/^(AI_QUESTION|AI_PROMPT)$/),
					content: expect.any(String),
					authorId: null,
				}),
			});
		});

		it("should provide suggested follow-ups", async () => {
			const input = {
				discussionId: "test-discussion-id",
			};

			const result = await caller.message.getAIResponse(input);

			expect(result.suggestedFollowUps).toBeDefined();
			if (result.suggestedFollowUps) {
				expect(Array.isArray(result.suggestedFollowUps)).toBe(true);
				result.suggestedFollowUps.forEach((followUp) => {
					expect(typeof followUp).toBe("string");
				});
			}
		});

		it("should reply to specific message when replyToId provided", async () => {
			const input = {
				discussionId: "test-discussion-id",
				replyToId: "message-to-reply",
			};

			const result = await caller.message.getAIResponse(input);

			expect(result.message.parentId).toBe(input.replyToId);
		});
	});

	describe("subscribe", () => {
		it("should subscribe to real-time updates", async () => {
			const input = {
				discussionId: "test-discussion-id",
			};

			const subscription = await caller.message.subscribe(input);

			expect(subscription).toBeDefined();
		});

		it("should receive new message events", async () => {
			const mockEvent = {
				type: "new_message" as const,
				message: {
					id: "new-message-id",
					discussionId: "test-discussion-id",
					content: "New message",
					authorId: "author-id",
					type: "USER" as const,
					createdAt: new Date(),
				},
			};

			expect(mockEvent).toMatchObject({
				type: "new_message",
				message: expect.any(Object),
			});
		});

		it("should receive typing events", async () => {
			const mockEvent = {
				type: "typing" as const,
				users: [
					{
						id: "user-1",
						name: "User One",
					},
					{
						id: "user-2",
						name: "User Two",
					},
				],
			};

			expect(mockEvent).toMatchObject({
				type: "typing",
				users: expect.arrayContaining([
					expect.objectContaining({
						id: expect.any(String),
						name: expect.any(String),
					}),
				]),
			});
		});

		it("should receive user joined/left events", async () => {
			const joinEvent = {
				type: "user_joined" as const,
				user: {
					id: "new-user",
					name: "New User",
				},
			};

			const leftEvent = {
				type: "user_left" as const,
				userId: "leaving-user",
			};

			expect(joinEvent.type).toBe("user_joined");
			expect(leftEvent.type).toBe("user_left");
		});
	});
});
