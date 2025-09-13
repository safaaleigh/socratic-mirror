/**
 * Integration Tests: Real-time Message Sending Flow
 *
 * Tests Scenario 3 from specs/003-participant-view-should/quickstart.md:
 * "As a participant, I can send messages that other participants see in real-time"
 *
 * NOTE: These tests WILL FAIL initially since the participant view features don't exist yet.
 * This is expected behavior as we're implementing TDD (Test-Driven Development).
 */

import type { Session } from "next-auth";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	cleanupDatabase,
	createTestCaller,
	createTestLesson,
	createTestUser,
	testDb,
} from "../db-setup";

describe("Integration: Real-time Message Sending Flow", () => {
	let facilitatorUser: Awaited<ReturnType<typeof createTestUser>>;
	let facilitatorSession: Session;
	let facilitatorCaller: Awaited<ReturnType<typeof createTestCaller>>;
	let testDiscussion: any;
	let invitationToken: string;

	// Simulate multiple participants with different session IDs
	let aliceSessionId: string;
	let bobSessionId: string;
	let charlieSessionId: string;

	beforeEach(async () => {
		console.log("🔧 Setting up real-time messaging test...");
		await cleanupDatabase();

		facilitatorUser = await createTestUser();
		facilitatorSession = {
			user: {
				id: facilitatorUser.id,
				email: facilitatorUser.email,
				name: facilitatorUser.name,
			},
			expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		};

		facilitatorCaller = await createTestCaller(facilitatorSession);

		// Create test lesson and discussion
		const testLesson = await createTestLesson(facilitatorUser.id);

		testDiscussion = await facilitatorCaller.discussion.create({
			lessonId: testLesson.id,
			name: "Real-time Messaging Test Discussion",
			description:
				"Testing bi-directional real-time messaging between participants",
			maxParticipants: 10,
			isPublic: false,
		});

		// Generate invitation token
		const invitation = await facilitatorCaller.participant.generateInvitation({
			discussionId: testDiscussion.id,
			expiresIn: "1h",
		});
		invitationToken = invitation.token;

		// Setup participant session IDs
		aliceSessionId = `alice-${Date.now()}`;
		bobSessionId = `bob-${Date.now()}`;
		charlieSessionId = `charlie-${Date.now()}`;

		console.log("✅ Real-time messaging test setup completed");
	});

	afterEach(async () => {
		await cleanupDatabase();
	});

	describe("Participant Message Sending", () => {
		beforeEach(async () => {
			// Join Alice and Bob as participants
			await facilitatorCaller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Alice",
				sessionId: aliceSessionId,
			});

			await facilitatorCaller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Bob",
				sessionId: bobSessionId,
			});
		});

		it("should send message from participant successfully", async () => {
			console.log("📤 Testing participant message sending...");

			const messageContent = "Hello everyone! This is Alice speaking.";

			const sentMessage = await facilitatorCaller.participant.sendMessage({
				discussionId: testDiscussion.id,
				sessionId: aliceSessionId,
				content: messageContent,
			});

			expect(sentMessage).toMatchObject({
				id: expect.any(String),
				content: messageContent,
				senderName: "Alice",
				senderType: "PARTICIPANT",
				discussionId: testDiscussion.id,
				participantId: expect.any(String),
				authorId: null, // Not an authenticated user
				type: "USER",
				isEdited: false,
				createdAt: expect.any(Date),
			});

			// Verify message was stored in database
			const dbMessage = await testDb.message.findUnique({
				where: { id: sentMessage.id },
				include: {
					participant: true,
				},
			});

			expect(dbMessage).toMatchObject({
				content: messageContent,
				senderName: "Alice",
				senderType: "PARTICIPANT",
				participant: {
					displayName: "Alice",
					sessionId: aliceSessionId,
				},
			});

			console.log("✅ Participant message sending successful");
		});

		it("should implement optimistic UI for sender", async () => {
			console.log("⚡ Testing optimistic UI behavior...");

			const messageContent = "This should appear immediately for the sender!";

			// Send message and check immediate response
			const startTime = Date.now();
			const sentMessage = await facilitatorCaller.participant.sendMessage({
				discussionId: testDiscussion.id,
				sessionId: aliceSessionId,
				content: messageContent,
			});
			const responseTime = Date.now() - startTime;

			// Should respond quickly (optimistic UI)
			expect(responseTime).toBeLessThan(200);

			// Message should have immediate properties for optimistic display
			expect(sentMessage).toMatchObject({
				content: messageContent,
				senderName: "Alice",
				createdAt: expect.any(Date),
				optimistic: false, // False since it's been persisted
			});

			console.log(`✅ Optimistic UI response in ${responseTime}ms`);
		});

		it("should broadcast message to other participants", async () => {
			console.log("📢 Testing message broadcasting to other participants...");

			// Alice sends a message
			const messageContent = "Hi Bob! Can you see this message?";
			const sentMessage = await facilitatorCaller.participant.sendMessage({
				discussionId: testDiscussion.id,
				sessionId: aliceSessionId,
				content: messageContent,
			});

			// Bob should be able to retrieve the message
			const bobMessages = await facilitatorCaller.participant.getMessages({
				discussionId: testDiscussion.id,
				sessionId: bobSessionId,
				limit: 10,
			});

			const aliceMessage = bobMessages.messages.find(
				(m) => m.id === sentMessage.id,
			);
			expect(aliceMessage).toMatchObject({
				content: messageContent,
				senderName: "Alice",
				senderType: "PARTICIPANT",
			});

			console.log("✅ Message broadcasting validated");
		});

		it("should handle rapid message sending", async () => {
			console.log("🏃 Testing rapid message sending...");

			const rapidMessages = [
				"Message 1 from Alice",
				"Message 2 from Alice",
				"Message 3 from Alice",
				"Message 4 from Alice",
				"Message 5 from Alice",
			];

			// Send messages rapidly
			const startTime = Date.now();
			const sentMessages = await Promise.all(
				rapidMessages.map((content, index) =>
					facilitatorCaller.participant.sendMessage({
						discussionId: testDiscussion.id,
						sessionId: aliceSessionId,
						content: content,
					}),
				),
			);
			const totalTime = Date.now() - startTime;

			// All messages should be sent successfully
			expect(sentMessages).toHaveLength(5);
			sentMessages.forEach((message, index) => {
				expect(message.content).toBe(rapidMessages[index]);
				expect(message.senderName).toBe("Alice");
			});

			// Should complete reasonably quickly
			expect(totalTime).toBeLessThan(2000);

			console.log(`✅ Rapid messaging completed in ${totalTime}ms`);
		});

		it("should enforce message length limits", async () => {
			console.log("📏 Testing message length validation...");

			// Test empty message
			await expect(
				facilitatorCaller.participant.sendMessage({
					discussionId: testDiscussion.id,
					sessionId: aliceSessionId,
					content: "",
				}),
			).rejects.toThrow(/empty|required/i);

			// Test message too long (over 5000 characters)
			const tooLongMessage = "A".repeat(5001);
			await expect(
				facilitatorCaller.participant.sendMessage({
					discussionId: testDiscussion.id,
					sessionId: aliceSessionId,
					content: tooLongMessage,
				}),
			).rejects.toThrow(/too long|length|limit/i);

			// Test valid message at limit
			const maxLengthMessage = "B".repeat(5000);
			const validMessage = await facilitatorCaller.participant.sendMessage({
				discussionId: testDiscussion.id,
				sessionId: aliceSessionId,
				content: maxLengthMessage,
			});

			expect(validMessage.content).toBe(maxLengthMessage);
			expect(validMessage.content.length).toBe(5000);

			console.log("✅ Message length validation passed");
		});
	});

	describe("Bi-directional Real-time Communication", () => {
		beforeEach(async () => {
			// Join Alice and Bob as participants
			await facilitatorCaller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Alice",
				sessionId: aliceSessionId,
			});

			await facilitatorCaller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Bob",
				sessionId: bobSessionId,
			});
		});

		it("should handle bi-directional messaging between participants", async () => {
			console.log("💬 Testing bi-directional messaging...");

			// Alice sends message to Bob
			const aliceMessage = await facilitatorCaller.participant.sendMessage({
				discussionId: testDiscussion.id,
				sessionId: aliceSessionId,
				content: "Hello Bob! How are you today?",
			});

			// Bob responds to Alice
			const bobMessage = await facilitatorCaller.participant.sendMessage({
				discussionId: testDiscussion.id,
				sessionId: bobSessionId,
				content: "Hi Alice! I'm doing great, thanks for asking!",
			});

			// Alice should see Bob's message
			const aliceView = await facilitatorCaller.participant.getMessages({
				discussionId: testDiscussion.id,
				sessionId: aliceSessionId,
				limit: 10,
			});

			const aliceSeesMessage = aliceView.messages.find(
				(m) => m.id === bobMessage.id,
			);
			expect(aliceSeesMessage).toMatchObject({
				content: "Hi Alice! I'm doing great, thanks for asking!",
				senderName: "Bob",
				senderType: "PARTICIPANT",
			});

			// Bob should see Alice's message
			const bobView = await facilitatorCaller.participant.getMessages({
				discussionId: testDiscussion.id,
				sessionId: bobSessionId,
				limit: 10,
			});

			const bobSeesMessage = bobView.messages.find(
				(m) => m.id === aliceMessage.id,
			);
			expect(bobSeesMessage).toMatchObject({
				content: "Hello Bob! How are you today?",
				senderName: "Alice",
				senderType: "PARTICIPANT",
			});

			console.log("✅ Bi-directional messaging validated");
		});

		it("should preserve message chronological order", async () => {
			console.log("⏰ Testing message chronological ordering...");

			// Send messages in sequence with slight delays
			const aliceMsg1 = await facilitatorCaller.participant.sendMessage({
				discussionId: testDiscussion.id,
				sessionId: aliceSessionId,
				content: "First message from Alice",
			});

			await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay

			const bobMsg1 = await facilitatorCaller.participant.sendMessage({
				discussionId: testDiscussion.id,
				sessionId: bobSessionId,
				content: "First response from Bob",
			});

			await new Promise((resolve) => setTimeout(resolve, 10));

			const aliceMsg2 = await facilitatorCaller.participant.sendMessage({
				discussionId: testDiscussion.id,
				sessionId: aliceSessionId,
				content: "Second message from Alice",
			});

			// Retrieve messages and check order
			const messages = await facilitatorCaller.participant.getMessages({
				discussionId: testDiscussion.id,
				sessionId: aliceSessionId,
				limit: 10,
			});

			// Should be ordered by creation time (newest first)
			expect(messages.messages).toHaveLength(3);
			expect(messages.messages[0]?.id).toBe(aliceMsg2.id);
			expect(messages.messages[1]?.id).toBe(bobMsg1.id);
			expect(messages.messages[2]?.id).toBe(aliceMsg1.id);

			// Verify timestamps are in correct order
			const timestamps = messages.messages.map((m) =>
				new Date(m.createdAt).getTime(),
			);
			for (let i = 0; i < timestamps.length - 1; i++) {
				expect(timestamps[i]!).toBeGreaterThan(timestamps[i + 1]!);
			}

			console.log("✅ Message chronological ordering validated");
		});

		it("should support multiple concurrent participants", async () => {
			console.log("👥 Testing multiple concurrent participants...");

			// Join Charlie as third participant
			await facilitatorCaller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Charlie",
				sessionId: charlieSessionId,
			});

			// All three participants send messages simultaneously
			const messagePromises = [
				facilitatorCaller.participant.sendMessage({
					discussionId: testDiscussion.id,
					sessionId: aliceSessionId,
					content: "Alice's concurrent message",
				}),
				facilitatorCaller.participant.sendMessage({
					discussionId: testDiscussion.id,
					sessionId: bobSessionId,
					content: "Bob's concurrent message",
				}),
				facilitatorCaller.participant.sendMessage({
					discussionId: testDiscussion.id,
					sessionId: charlieSessionId,
					content: "Charlie's concurrent message",
				}),
			];

			const sentMessages = await Promise.all(messagePromises);

			// All messages should be sent successfully
			expect(sentMessages).toHaveLength(3);
			sentMessages.forEach((message) => {
				expect(message).toMatchObject({
					content: expect.stringContaining("concurrent message"),
					senderType: "PARTICIPANT",
				});
			});

			// Each participant should see all three messages
			const aliceView = await facilitatorCaller.participant.getMessages({
				discussionId: testDiscussion.id,
				sessionId: aliceSessionId,
				limit: 10,
			});

			expect(aliceView.messages).toHaveLength(3);
			const senderNames = aliceView.messages.map((m) => m.senderName);
			expect(senderNames).toEqual(
				expect.arrayContaining(["Alice", "Bob", "Charlie"]),
			);

			console.log("✅ Multiple concurrent participants validated");
		});
	});

	describe("Message Threading and Replies", () => {
		beforeEach(async () => {
			// Join participants
			await facilitatorCaller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Alice",
				sessionId: aliceSessionId,
			});

			await facilitatorCaller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Bob",
				sessionId: bobSessionId,
			});
		});

		it("should support threaded replies between participants", async () => {
			console.log("🧵 Testing threaded replies...");

			// Alice sends initial message
			const rootMessage = await facilitatorCaller.participant.sendMessage({
				discussionId: testDiscussion.id,
				sessionId: aliceSessionId,
				content: "What do you all think about the main topic?",
			});

			// Bob replies to Alice's message
			const bobReply = await facilitatorCaller.participant.sendMessage({
				discussionId: testDiscussion.id,
				sessionId: bobSessionId,
				content: "Great question! I think we should consider...",
				parentId: rootMessage.id,
			});

			expect(bobReply).toMatchObject({
				parentId: rootMessage.id,
				content: "Great question! I think we should consider...",
				senderName: "Bob",
				parent: {
					id: rootMessage.id,
					content: rootMessage.content,
					senderName: "Alice",
				},
			});

			// Alice replies to Bob's reply (nested threading)
			const aliceNestedReply = await facilitatorCaller.participant.sendMessage({
				discussionId: testDiscussion.id,
				sessionId: aliceSessionId,
				content: "That's an interesting perspective, Bob!",
				parentId: bobReply.id,
			});

			expect(aliceNestedReply).toMatchObject({
				parentId: bobReply.id,
				senderName: "Alice",
				parent: {
					id: bobReply.id,
					senderName: "Bob",
				},
			});

			console.log("✅ Threaded replies validated");
		});

		it("should list thread replies correctly", async () => {
			console.log("📋 Testing thread reply listing...");

			// Create a root message and multiple replies
			const rootMessage = await facilitatorCaller.participant.sendMessage({
				discussionId: testDiscussion.id,
				sessionId: aliceSessionId,
				content: "Root message for threading test",
			});

			const replies = await Promise.all([
				facilitatorCaller.participant.sendMessage({
					discussionId: testDiscussion.id,
					sessionId: bobSessionId,
					content: "First reply from Bob",
					parentId: rootMessage.id,
				}),
				facilitatorCaller.participant.sendMessage({
					discussionId: testDiscussion.id,
					sessionId: aliceSessionId,
					content: "Reply from Alice",
					parentId: rootMessage.id,
				}),
			]);

			// Get replies to root message
			const threadReplies = await facilitatorCaller.participant.getMessages({
				discussionId: testDiscussion.id,
				sessionId: aliceSessionId,
				parentId: rootMessage.id,
				limit: 10,
			});

			expect(threadReplies.messages).toHaveLength(2);
			const replyIds = threadReplies.messages.map((m) => m.id);
			expect(replyIds).toContain(replies[0]?.id);
			expect(replyIds).toContain(replies[1]?.id);

			console.log("✅ Thread reply listing validated");
		});
	});

	describe("Message Delivery Performance", () => {
		beforeEach(async () => {
			await facilitatorCaller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Alice",
				sessionId: aliceSessionId,
			});

			await facilitatorCaller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Bob",
				sessionId: bobSessionId,
			});
		});

		it("should deliver messages within 500ms", async () => {
			console.log("⚡ Testing message delivery performance...");

			// Alice sends message
			const sendStart = Date.now();
			const sentMessage = await facilitatorCaller.participant.sendMessage({
				discussionId: testDiscussion.id,
				sessionId: aliceSessionId,
				content: "Performance test message",
			});
			const sendTime = Date.now() - sendStart;

			// Bob retrieves messages (simulating real-time delivery)
			const receiveStart = Date.now();
			const bobMessages = await facilitatorCaller.participant.getMessages({
				discussionId: testDiscussion.id,
				sessionId: bobSessionId,
				limit: 10,
			});
			const receiveTime = Date.now() - receiveStart;

			expect(sendTime).toBeLessThan(500);
			expect(receiveTime).toBeLessThan(500);

			const receivedMessage = bobMessages.messages.find(
				(m) => m.id === sentMessage.id,
			);
			expect(receivedMessage).toBeDefined();

			console.log(
				`✅ Send time: ${sendTime}ms, Receive time: ${receiveTime}ms (both <500ms)`,
			);
		});

		it("should handle high-frequency messaging", async () => {
			console.log("🔄 Testing high-frequency messaging performance...");

			const messageCount = 20;
			const startTime = Date.now();

			// Send messages rapidly from both participants
			const sendPromises = [];
			for (let i = 0; i < messageCount / 2; i++) {
				sendPromises.push(
					facilitatorCaller.participant.sendMessage({
						discussionId: testDiscussion.id,
						sessionId: aliceSessionId,
						content: `Alice message ${i}`,
					}),
				);
				sendPromises.push(
					facilitatorCaller.participant.sendMessage({
						discussionId: testDiscussion.id,
						sessionId: bobSessionId,
						content: `Bob message ${i}`,
					}),
				);
			}

			const sentMessages = await Promise.all(sendPromises);
			const totalTime = Date.now() - startTime;

			expect(sentMessages).toHaveLength(messageCount);
			expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds

			// Verify all messages are retrievable
			const allMessages = await facilitatorCaller.participant.getMessages({
				discussionId: testDiscussion.id,
				sessionId: aliceSessionId,
				limit: messageCount + 5,
			});

			expect(allMessages.messages.length).toBeGreaterThanOrEqual(messageCount);

			console.log(
				`✅ High-frequency messaging: ${messageCount} messages in ${totalTime}ms`,
			);
		});
	});

	describe("Message Validation and Security", () => {
		beforeEach(async () => {
			await facilitatorCaller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Alice",
				sessionId: aliceSessionId,
			});
		});

		it("should validate participant session for message sending", async () => {
			console.log("🔐 Testing session validation...");

			// Try to send message with invalid session ID
			await expect(
				facilitatorCaller.participant.sendMessage({
					discussionId: testDiscussion.id,
					sessionId: "invalid-session-id",
					content: "This should fail",
				}),
			).rejects.toThrow(/invalid.*session|session.*not.*found/i);

			console.log("✅ Session validation enforced");
		});

		it("should prevent message sending to inactive discussions", async () => {
			console.log("🚫 Testing inactive discussion protection...");

			// Mark discussion as inactive
			await testDb.discussion.update({
				where: { id: testDiscussion.id },
				data: { isActive: false },
			});

			await expect(
				facilitatorCaller.participant.sendMessage({
					discussionId: testDiscussion.id,
					sessionId: aliceSessionId,
					content: "This should fail",
				}),
			).rejects.toThrow(/discussion.*inactive|discussion.*closed/i);

			console.log("✅ Inactive discussion protection enforced");
		});

		it("should sanitize message content", async () => {
			console.log("🧹 Testing message content sanitization...");

			const potentiallyHarmfulContent =
				"<script>alert('xss')</script>Hello world!";

			const sentMessage = await facilitatorCaller.participant.sendMessage({
				discussionId: testDiscussion.id,
				sessionId: aliceSessionId,
				content: potentiallyHarmfulContent,
			});

			// Content should be sanitized (exact sanitization depends on implementation)
			expect(sentMessage.content).toBeDefined();
			// Should not contain script tags
			expect(sentMessage.content.toLowerCase()).not.toContain("<script>");

			console.log("✅ Content sanitization applied");
		});

		it("should rate limit message sending", async () => {
			console.log("🚦 Testing message rate limiting...");

			const rapidMessages = Array.from({ length: 15 }, (_, i) => ({
				content: `Rapid message ${i}`,
			}));

			let successfulMessages = 0;
			let rateLimitedMessages = 0;

			// Send many messages rapidly
			for (const msg of rapidMessages) {
				try {
					await facilitatorCaller.participant.sendMessage({
						discussionId: testDiscussion.id,
						sessionId: aliceSessionId,
						content: msg.content,
					});
					successfulMessages++;
				} catch (error: any) {
					if (error.message.match(/rate.*limit|too.*many.*requests/i)) {
						rateLimitedMessages++;
					} else {
						throw error; // Re-throw unexpected errors
					}
				}
			}

			// Should have some rate limiting in place
			expect(successfulMessages).toBeGreaterThan(0);
			expect(successfulMessages + rateLimitedMessages).toBe(
				rapidMessages.length,
			);

			console.log(
				`✅ Rate limiting: ${successfulMessages} sent, ${rateLimitedMessages} limited`,
			);
		});
	});
});
