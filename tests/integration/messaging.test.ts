import type { Session } from "next-auth";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	cleanupDatabase,
	createTestCaller,
	createTestUser,
	testDb,
} from "../db-setup";

describe("Real-time Messaging Flow Integration Test", () => {
	let testUser: Awaited<ReturnType<typeof createTestUser>>;
	let participant: Awaited<ReturnType<typeof createTestUser>>;
	let testSession: Session;
	let participantSession: Session;
	let caller: Awaited<ReturnType<typeof createTestCaller>>;
	let participantCaller: Awaited<ReturnType<typeof createTestCaller>>;

	beforeEach(async () => {
		await cleanupDatabase();
		testUser = await createTestUser();
		participant = await createTestUser();

		testSession = {
			user: { id: testUser.id, email: testUser.email, name: testUser.name },
			expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		};

		participantSession = {
			user: {
				id: participant.id,
				email: participant.email,
				name: participant.name,
			},
			expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		};

		caller = await createTestCaller(testSession);
		participantCaller = await createTestCaller(participantSession);
	});

	afterEach(async () => {
		await cleanupDatabase();
	});

	it("should complete full messaging flow with real-time updates", async () => {
		// Step 1: Create lesson and discussion
		const lesson = await testDb.lesson.create({
			data: {
				title: "Communication Workshop",
				content: "Learn effective communication",
				objectives: ["Communicate clearly", "Listen actively"],
				keyQuestions: ["How do we communicate?"],
				facilitationStyle: "interactive",
				creatorId: testUser.id,
				isPublished: true,
			},
		});

		const discussion = await caller.discussion.create({
			lessonId: lesson.id,
			name: "Communication Practice Session",
			description: "Practice your communication skills",
			maxParticipants: 5,
			isPublic: true,
		});

		// Step 2: Participant joins discussion
		const { joinCode } = await caller.discussion.generateJoinCode({
			discussionId: discussion.id,
		});

		await participantCaller.discussion.join({ joinCode });

		// Step 3: Send initial message
		const firstMessage = await caller.message.send({
			discussionId: discussion.id,
			content: "Welcome everyone! Let's start our communication practice.",
			type: "USER",
		});

		expect(firstMessage).toMatchObject({
			id: expect.any(String),
			discussionId: discussion.id,
			authorId: testUser.id,
			content: "Welcome everyone! Let's start our communication practice.",
			type: "USER",
			isEdited: false,
		});

		// Step 4: Participant responds
		const response = await participantCaller.message.send({
			discussionId: discussion.id,
			content: "Thank you! I'm excited to participate.",
			type: "USER",
		});

		expect(response.authorId).toBe(participant.id);

		// Step 5: Send a threaded reply
		const threadReply = await caller.message.send({
			discussionId: discussion.id,
			content: "Great attitude! What's your biggest communication challenge?",
			parentId: response.id,
		});

		expect(threadReply).toMatchObject({
			parentId: response.id,
			parent: expect.objectContaining({
				id: response.id,
				content: response.content,
			}),
		});

		// Step 6: List messages with pagination
		const messageList = await caller.message.list({
			discussionId: discussion.id,
			limit: 10,
		});

		expect(messageList.messages).toHaveLength(3);
		expect(messageList.messages[0]?.id).toBe(threadReply.id); // Most recent first
		expect(messageList.messages[2]?.id).toBe(firstMessage.id); // Oldest last

		// Step 7: List replies to a specific message
		const replies = await caller.message.list({
			discussionId: discussion.id,
			parentId: response.id,
			limit: 5,
		});

		expect(replies.messages).toHaveLength(1);
		expect(replies.messages[0]?.id).toBe(threadReply.id);

		// Step 8: Edit a message
		const editedMessage = await caller.message.edit({
			messageId: firstMessage.id,
			content:
				"Welcome everyone! Let's start our communication practice. Updated instructions will follow.",
		});

		expect(editedMessage).toMatchObject({
			id: firstMessage.id,
			content:
				"Welcome everyone! Let's start our communication practice. Updated instructions will follow.",
			isEdited: true,
			editedAt: expect.any(Date),
		});

		// Step 9: Add reactions to messages
		const reaction1 = await participantCaller.message.react({
			messageId: firstMessage.id,
			reaction: "👍",
		});

		expect(reaction1.reactions).toHaveProperty("👍");
		expect(reaction1.reactions["👍"]).toBe(1);

		const reaction2 = await caller.message.react({
			messageId: response.id,
			reaction: "❤️",
		});

		expect(reaction2.reactions["❤️"]).toBe(1);

		// Step 10: Toggle reaction (remove it)
		const toggledReaction = await participantCaller.message.react({
			messageId: firstMessage.id,
			reaction: "👍",
		});

		expect(toggledReaction.reactions["👍"]).toBe(0);

		// Step 11: Mark messages as seen
		await participantCaller.message.markAsSeen({
			discussionId: discussion.id,
			messageId: firstMessage.id,
		});

		await participantCaller.message.markAsSeen({
			discussionId: discussion.id,
			messageId: threadReply.id,
		});

		// Step 12: Test typing indicators
		const typingStart = await caller.message.setTyping({
			discussionId: discussion.id,
			isTyping: true,
		});

		expect(typingStart.success).toBe(true);

		const typingStop = await caller.message.setTyping({
			discussionId: discussion.id,
			isTyping: false,
		});

		expect(typingStop.success).toBe(true);

		// Step 13: Test WebSocket subscription setup
		const subscription = await caller.message.subscribe({
			discussionId: discussion.id,
		});

		expect(subscription).toBeDefined();

		// Step 14: Delete a message
		const deleteResult = await caller.message.delete({
			messageId: threadReply.id,
		});

		expect(deleteResult.success).toBe(true);

		// Step 15: Verify message was deleted
		const updatedList = await caller.message.list({
			discussionId: discussion.id,
			limit: 10,
		});

		expect(updatedList.messages).toHaveLength(2);
		expect(
			updatedList.messages.find((m) => m.id === threadReply.id),
		).toBeUndefined();
	});

	it("should handle message permissions correctly", async () => {
		// Setup
		const lesson = await testDb.lesson.create({
			data: {
				title: "Test Lesson",
				content: "Content",
				objectives: ["Test"],
				keyQuestions: ["Test?"],
				facilitationStyle: "socratic",
				creatorId: testUser.id,
				isPublished: true,
			},
		});

		const discussion = await caller.discussion.create({
			lessonId: lesson.id,
			name: "Test Discussion",
			maxParticipants: 5,
		});

		// Participant joins
		const { joinCode } = await caller.discussion.generateJoinCode({
			discussionId: discussion.id,
		});
		await participantCaller.discussion.join({ joinCode });

		// Creator sends message
		const creatorMessage = await caller.message.send({
			discussionId: discussion.id,
			content: "Creator message",
		});

		// Participant sends message
		const participantMessage = await participantCaller.message.send({
			discussionId: discussion.id,
			content: "Participant message",
		});

		// Creator can edit own message
		await caller.message.edit({
			messageId: creatorMessage.id,
			content: "Updated creator message",
		});

		// Participant cannot edit creator's message
		await expect(
			participantCaller.message.edit({
				messageId: creatorMessage.id,
				content: "Hacking attempt",
			}),
		).rejects.toThrow();

		// Participant can edit own message
		await participantCaller.message.edit({
			messageId: participantMessage.id,
			content: "Updated participant message",
		});

		// Creator can delete any message (moderator rights)
		await caller.message.delete({
			messageId: participantMessage.id,
		});

		// Participant cannot delete creator's message
		await expect(
			participantCaller.message.delete({
				messageId: creatorMessage.id,
			}),
		).rejects.toThrow();
	});

	it("should handle complex threading scenarios", async () => {
		// Setup
		const lesson = await testDb.lesson.create({
			data: {
				title: "Threading Test",
				content: "Content",
				objectives: ["Test threading"],
				keyQuestions: ["How does threading work?"],
				facilitationStyle: "socratic",
				creatorId: testUser.id,
				isPublished: true,
			},
		});

		const discussion = await caller.discussion.create({
			lessonId: lesson.id,
			name: "Threading Discussion",
			maxParticipants: 5,
		});

		// Add participant
		const { joinCode } = await caller.discussion.generateJoinCode({
			discussionId: discussion.id,
		});
		await participantCaller.discussion.join({ joinCode });

		// Create a root message
		const rootMessage = await caller.message.send({
			discussionId: discussion.id,
			content: "What are your thoughts on effective communication?",
		});

		// Create multiple replies to the root
		const reply1 = await participantCaller.message.send({
			discussionId: discussion.id,
			content: "I think clarity is most important.",
			parentId: rootMessage.id,
		});

		const reply2 = await caller.message.send({
			discussionId: discussion.id,
			content: "Active listening is equally crucial.",
			parentId: rootMessage.id,
		});

		// Create a reply to a reply (nested threading)
		const nestedReply = await participantCaller.message.send({
			discussionId: discussion.id,
			content: "Can you elaborate on what you mean by clarity?",
			parentId: reply1.id,
		});

		// List all messages
		const allMessages = await caller.message.list({
			discussionId: discussion.id,
			limit: 20,
		});

		expect(allMessages.messages).toHaveLength(4);

		// List only replies to root message
		const rootReplies = await caller.message.list({
			discussionId: discussion.id,
			parentId: rootMessage.id,
			limit: 10,
		});

		expect(rootReplies.messages).toHaveLength(2);
		const replyIds = rootReplies.messages.map((m) => m.id);
		expect(replyIds).toContain(reply1.id);
		expect(replyIds).toContain(reply2.id);

		// List replies to the first reply
		const nestedReplies = await caller.message.list({
			discussionId: discussion.id,
			parentId: reply1.id,
			limit: 10,
		});

		expect(nestedReplies.messages).toHaveLength(1);
		expect(nestedReplies.messages[0]?.id).toBe(nestedReply.id);

		// Verify parent relationships
		expect(nestedReply.parentId).toBe(reply1.id);
		expect(nestedReply.parent).toMatchObject({
			id: reply1.id,
			content: reply1.content,
		});
	});

	it("should handle message validation and limits", async () => {
		// Setup
		const lesson = await testDb.lesson.create({
			data: {
				title: "Validation Test",
				content: "Content",
				objectives: ["Test validation"],
				keyQuestions: ["How to validate?"],
				facilitationStyle: "socratic",
				creatorId: testUser.id,
				isPublished: true,
			},
		});

		const discussion = await caller.discussion.create({
			lessonId: lesson.id,
			name: "Validation Discussion",
			maxParticipants: 5,
		});

		// Test empty message
		await expect(
			caller.message.send({
				discussionId: discussion.id,
				content: "",
			}),
		).rejects.toThrow();

		// Test message too long (over 5000 characters)
		const veryLongMessage = "x".repeat(5001);
		await expect(
			caller.message.send({
				discussionId: discussion.id,
				content: veryLongMessage,
			}),
		).rejects.toThrow();

		// Test valid message at limit (5000 characters)
		const maxLengthMessage = "x".repeat(5000);
		const validMessage = await caller.message.send({
			discussionId: discussion.id,
			content: maxLengthMessage,
		});

		expect(validMessage.content).toBe(maxLengthMessage);

		// Test non-existent parent ID
		await expect(
			caller.message.send({
				discussionId: discussion.id,
				content: "Reply to non-existent message",
				parentId: "non-existent-id",
			}),
		).rejects.toThrow();

		// Test non-existent discussion ID
		await expect(
			caller.message.send({
				discussionId: "non-existent-discussion",
				content: "Message to nowhere",
			}),
		).rejects.toThrow();
	});
});
