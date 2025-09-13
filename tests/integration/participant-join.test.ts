/**
 * Integration Tests: Participant Join and Message History Flow
 *
 * Tests Scenario 2 & 4 from specs/003-participant-view-should/quickstart.md:
 * - "As an invitee, I can enter my name and join the live discussion"
 * - "As a new participant, I can see discussion history for context"
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

describe("Integration: Participant Join and Message History Flow", () => {
	let testUser: Awaited<ReturnType<typeof createTestUser>>;
	let testSession: Session;
	let caller: Awaited<ReturnType<typeof createTestCaller>>;
	let testDiscussion: any;
	let invitationToken: string;

	beforeEach(async () => {
		console.log("🔧 Setting up participant join test...");
		await cleanupDatabase();

		testUser = await createTestUser();
		testSession = {
			user: {
				id: testUser.id,
				email: testUser.email,
				name: testUser.name,
			},
			expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		};

		caller = await createTestCaller(testSession);

		// Create test lesson and discussion
		const testLesson = await createTestLesson(testUser.id);

		testDiscussion = await caller.discussion.create({
			lessonId: testLesson.id,
			name: "Participant Join Test Discussion",
			description: "Testing participant join flow and message history",
			maxParticipants: 10,
			isPublic: false,
		});

		// Generate invitation token
		const invitation = await caller.participant.generateInvitation({
			discussionId: testDiscussion.id,
			expiresIn: "1h",
		});
		invitationToken = invitation.token;

		console.log("✅ Test setup completed");
	});

	afterEach(async () => {
		await cleanupDatabase();
	});

	describe("Participant Join Process", () => {
		it("should successfully join discussion with valid name and token", async () => {
			console.log("👋 Testing participant join process...");

			const joinResult = await caller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Alice",
				sessionId: "test-session-alice",
			});

			expect(joinResult).toMatchObject({
				success: true,
				participant: {
					id: expect.any(String),
					displayName: "Alice",
					discussionId: testDiscussion.id,
					sessionId: "test-session-alice",
					joinedAt: expect.any(Date),
					leftAt: null,
				},
				discussion: {
					id: testDiscussion.id,
					name: testDiscussion.name,
					participantCount: 1,
				},
				redirectUrl: `/discussion/${testDiscussion.id}/participant`,
			});

			// Verify participant was created in database
			const participant = await testDb.participant.findUnique({
				where: {
					discussionId_sessionId: {
						discussionId: testDiscussion.id,
						sessionId: "test-session-alice",
					},
				},
			});

			expect(participant).toMatchObject({
				displayName: "Alice",
				sessionId: "test-session-alice",
				leftAt: null,
			});

			console.log("✅ Participant join successful");
		});

		it("should update participant count after join", async () => {
			console.log("📊 Testing participant count updates...");

			// Join first participant
			await caller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Alice",
				sessionId: "session-alice",
			});

			// Join second participant
			await caller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Bob",
				sessionId: "session-bob",
			});

			// Check participant count
			const discussionInfo = await caller.participant.getDiscussionInfo({
				discussionId: testDiscussion.id,
				sessionId: "session-alice", // Request from Alice's perspective
			});

			expect(discussionInfo.participantCount).toBe(2);
			expect(discussionInfo.participants).toHaveLength(2);

			const participantNames = discussionInfo.participants.map(
				(p) => p.displayName,
			);
			expect(participantNames).toContain("Alice");
			expect(participantNames).toContain("Bob");

			console.log("✅ Participant count validation successful");
		});

		it("should handle duplicate session ID gracefully", async () => {
			console.log("🔄 Testing duplicate session handling...");

			// Join first time
			const firstJoin = await caller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Alice",
				sessionId: "duplicate-session",
			});

			expect(firstJoin.success).toBe(true);

			// Join again with same session ID but different name
			const secondJoin = await caller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Alice Updated",
				sessionId: "duplicate-session", // Same session ID
			});

			// Should update existing participant instead of creating new one
			expect(secondJoin.success).toBe(true);
			expect(secondJoin.participant.displayName).toBe("Alice Updated");

			// Verify only one participant exists with this session
			const participants = await testDb.participant.findMany({
				where: {
					discussionId: testDiscussion.id,
					sessionId: "duplicate-session",
				},
			});

			expect(participants).toHaveLength(1);
			expect(participants[0]?.displayName).toBe("Alice Updated");

			console.log("✅ Duplicate session handling validated");
		});

		it("should enforce participant limit", async () => {
			console.log("🚫 Testing participant limit enforcement...");

			// Update discussion to have lower participant limit
			await testDb.discussion.update({
				where: { id: testDiscussion.id },
				data: { maxParticipants: 2 },
			});

			// Join two participants (at limit)
			await caller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Alice",
				sessionId: "session-1",
			});

			await caller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Bob",
				sessionId: "session-2",
			});

			// Try to join third participant (should fail)
			await expect(
				caller.participant.join({
					discussionId: testDiscussion.id,
					token: invitationToken,
					displayName: "Charlie",
					sessionId: "session-3",
				}),
			).rejects.toThrow(
				/discussion.*full|participant.*limit|maximum.*participants/i,
			);

			console.log("✅ Participant limit enforcement validated");
		});
	});

	describe("Message History on Join", () => {
		beforeEach(async () => {
			// Create some existing messages in the discussion
			console.log("📝 Creating test message history...");

			// Join facilitator (authenticated user) to send messages
			const { joinCode } = await caller.discussion.generateJoinCode({
				discussionId: testDiscussion.id,
			});
			await caller.discussion.join({ joinCode });

			// Send various types of messages
			await caller.message.send({
				discussionId: testDiscussion.id,
				content: "Welcome to our discussion on critical thinking!",
				type: "USER",
			});

			// Add a participant to create participant messages
			await testDb.participant.create({
				data: {
					discussionId: testDiscussion.id,
					displayName: "Early Participant",
					sessionId: "early-session",
				},
			});

			// Create messages from participant
			const participantMessages = [
				"Hello everyone! Excited to be here.",
				"What does critical thinking mean to you?",
				"I think it involves questioning assumptions.",
			];

			for (const content of participantMessages) {
				await testDb.message.create({
					data: {
						discussionId: testDiscussion.id,
						participantId: await testDb.participant
							.findFirst({
								where: { sessionId: "early-session" },
								select: { id: true },
							})
							.then((p) => p?.id),
						content,
						senderName: "Early Participant",
						senderType: "PARTICIPANT",
						type: "USER",
					},
				});
			}

			console.log("✅ Test message history created");
		});

		it("should provide message history on successful join", async () => {
			console.log("📜 Testing message history retrieval on join...");

			const joinResult = await caller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Alice",
				sessionId: "alice-session",
			});

			expect(joinResult.success).toBe(true);
			expect(joinResult.messageHistory).toBeDefined();
			expect(joinResult.messageHistory.messages).toBeInstanceOf(Array);
			expect(joinResult.messageHistory.messages.length).toBeGreaterThan(0);

			// Check message structure
			const firstMessage = joinResult.messageHistory.messages[0];
			expect(firstMessage).toMatchObject({
				id: expect.any(String),
				content: expect.any(String),
				senderName: expect.any(String),
				senderType: expect.stringMatching(/USER|PARTICIPANT/),
				createdAt: expect.any(Date),
				isEdited: expect.any(Boolean),
			});

			console.log(
				`✅ Message history retrieved: ${joinResult.messageHistory.messages.length} messages`,
			);
		});

		it("should limit initial message history to last 20 messages", async () => {
			console.log("📊 Testing message history pagination...");

			// Create many messages to test pagination
			const manyMessages = Array.from({ length: 30 }, (_, i) => ({
				discussionId: testDiscussion.id,
				authorId: testUser.id,
				content: `Message ${i + 1} from facilitator`,
				senderName: testUser.name || "Facilitator",
				senderType: "USER" as const,
				type: "USER" as const,
			}));

			await testDb.message.createMany({
				data: manyMessages,
			});

			const joinResult = await caller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Alice",
				sessionId: "alice-session",
			});

			// Should only get last 20 messages
			expect(joinResult.messageHistory.messages).toHaveLength(20);
			expect(joinResult.messageHistory.hasMore).toBe(true);
			expect(joinResult.messageHistory.totalCount).toBeGreaterThan(20);

			// Messages should be in chronological order (newest first for display)
			const messages = joinResult.messageHistory.messages;
			for (let i = 0; i < messages.length - 1; i++) {
				const current = new Date(messages[i]?.createdAt);
				const next = new Date(messages[i + 1]?.createdAt);
				expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
			}

			console.log("✅ Message history pagination validated");
		});

		it("should include sender information for all message types", async () => {
			console.log("👤 Testing sender information in message history...");

			const joinResult = await caller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Alice",
				sessionId: "alice-session",
			});

			const messages = joinResult.messageHistory.messages;
			expect(messages.length).toBeGreaterThan(0);

			// Check that all messages have sender information
			for (const message of messages) {
				expect(message.senderName).toBeTruthy();
				expect(message.senderType).toMatch(/^(USER|PARTICIPANT|SYSTEM)$/);

				if (message.senderType === "USER") {
					expect(message.authorId).toBeTruthy();
					expect(message.participantId).toBeNull();
				} else if (message.senderType === "PARTICIPANT") {
					expect(message.participantId).toBeTruthy();
					expect(message.authorId).toBeNull();
				}
			}

			console.log("✅ Sender information validation passed");
		});

		it("should handle empty message history gracefully", async () => {
			console.log("🗂️ Testing empty message history handling...");

			// Clear all messages
			await testDb.message.deleteMany({
				where: { discussionId: testDiscussion.id },
			});

			const joinResult = await caller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Alice",
				sessionId: "alice-session",
			});

			expect(joinResult.success).toBe(true);
			expect(joinResult.messageHistory).toMatchObject({
				messages: [],
				hasMore: false,
				totalCount: 0,
			});

			console.log("✅ Empty message history handling validated");
		});
	});

	describe("Participant Information and Context", () => {
		beforeEach(async () => {
			// Join a participant for context testing
			await caller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Alice",
				sessionId: "alice-session",
			});
		});

		it("should provide participant with discussion context", async () => {
			console.log("🎯 Testing discussion context for participants...");

			const discussionInfo = await caller.participant.getDiscussionInfo({
				discussionId: testDiscussion.id,
				sessionId: "alice-session",
			});

			expect(discussionInfo).toMatchObject({
				discussion: {
					id: testDiscussion.id,
					name: testDiscussion.name,
					description: testDiscussion.description,
					isActive: true,
					lesson: {
						title: expect.any(String),
						description: expect.any(String),
						objectives: expect.any(Array),
						keyQuestions: expect.any(Array),
						facilitationStyle: expect.any(String),
					},
				},
				participantCount: 1,
				maxParticipants: 10,
				canSendMessages: true,
			});

			console.log("✅ Discussion context validation passed");
		});

		it("should track participant session information", async () => {
			console.log("🔍 Testing participant session tracking...");

			const participantInfo = await caller.participant.getParticipantInfo({
				discussionId: testDiscussion.id,
				sessionId: "alice-session",
			});

			expect(participantInfo).toMatchObject({
				participant: {
					id: expect.any(String),
					displayName: "Alice",
					sessionId: "alice-session",
					joinedAt: expect.any(Date),
					leftAt: null,
				},
				permissions: {
					canSendMessages: true,
					canViewHistory: true,
					canLeaveDiscussion: true,
				},
				statistics: {
					messagesSent: 0,
					timeInDiscussion: expect.any(Number), // milliseconds
				},
			});

			console.log("✅ Participant session tracking validated");
		});

		it("should list other participants in discussion", async () => {
			console.log("👥 Testing participant listing...");

			// Add more participants
			await caller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Bob",
				sessionId: "bob-session",
			});

			await caller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Charlie",
				sessionId: "charlie-session",
			});

			const discussionInfo = await caller.participant.getDiscussionInfo({
				discussionId: testDiscussion.id,
				sessionId: "alice-session",
			});

			expect(discussionInfo.participantCount).toBe(3);
			expect(discussionInfo.participants).toHaveLength(3);

			const participantNames = discussionInfo.participants.map(
				(p) => p.displayName,
			);
			expect(participantNames).toEqual(
				expect.arrayContaining(["Alice", "Bob", "Charlie"]),
			);

			// Check participant info structure
			const aliceInfo = discussionInfo.participants.find(
				(p) => p.displayName === "Alice",
			);
			expect(aliceInfo).toMatchObject({
				displayName: "Alice",
				joinedAt: expect.any(Date),
				isActive: true,
			});

			console.log("✅ Participant listing validated");
		});
	});

	describe("Join Validation and Security", () => {
		it("should reject join with invalid token", async () => {
			console.log("🚫 Testing invalid token rejection...");

			await expect(
				caller.participant.join({
					discussionId: testDiscussion.id,
					token: "invalid-token",
					displayName: "Alice",
					sessionId: "test-session",
				}),
			).rejects.toThrow(/invalid.*token|token.*invalid/i);

			console.log("✅ Invalid token rejection validated");
		});

		it("should reject join with expired token", async () => {
			console.log("⏰ Testing expired token rejection...");

			// Generate token with very short expiry
			const expiredInvitation = await caller.participant.generateInvitation({
				discussionId: testDiscussion.id,
				expiresIn: "1ms", // Expires immediately
			});

			// Wait a moment to ensure expiry
			await new Promise((resolve) => setTimeout(resolve, 10));

			await expect(
				caller.participant.join({
					discussionId: testDiscussion.id,
					token: expiredInvitation.token,
					displayName: "Alice",
					sessionId: "test-session",
				}),
			).rejects.toThrow(/expired.*token|token.*expired/i);

			console.log("✅ Expired token rejection validated");
		});

		it("should validate display name format", async () => {
			console.log("📝 Testing display name validation...");

			const invalidNames = [
				{ name: "", error: /empty|required/ },
				{ name: "   ", error: /empty|required/ },
				{ name: "A".repeat(51), error: /too long|length/ },
			];

			for (const testCase of invalidNames) {
				await expect(
					caller.participant.join({
						discussionId: testDiscussion.id,
						token: invitationToken,
						displayName: testCase.name,
						sessionId: `test-session-${Date.now()}`,
					}),
				).rejects.toThrow(testCase.error);
			}

			console.log("✅ Display name validation passed");
		});

		it("should complete join process quickly (< 1 second)", async () => {
			console.log("⚡ Testing join process performance...");

			const startTime = Date.now();

			await caller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Alice",
				sessionId: "performance-test-session",
			});

			const duration = Date.now() - startTime;

			expect(duration).toBeLessThan(1000);
			console.log(`✅ Join process completed in ${duration}ms (<1000ms)`);
		});
	});
});
