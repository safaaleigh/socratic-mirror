/**
 * Integration Tests: Message History Lazy Loading Flow
 *
 * Tests Scenario 4 from specs/003-participant-view-should/quickstart.md:
 * "As a new participant, I can see discussion history for context"
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

describe("Integration: Message History Lazy Loading Flow", () => {
	let facilitatorUser: Awaited<ReturnType<typeof createTestUser>>;
	let facilitatorSession: Session;
	let facilitatorCaller: Awaited<ReturnType<typeof createTestCaller>>;
	let testDiscussion: any;
	let invitationToken: string;

	beforeEach(async () => {
		console.log("🔧 Setting up message history test...");
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
			name: "Message History Test Discussion",
			description:
				"Testing message history lazy loading with large conversation",
			maxParticipants: 15,
			isPublic: false,
		});

		// Generate invitation token
		const invitation = await facilitatorCaller.participant.generateInvitation({
			discussionId: testDiscussion.id,
			expiresIn: "2h",
		});
		invitationToken = invitation.token;

		console.log("✅ Message history test setup completed");
	});

	afterEach(async () => {
		await cleanupDatabase();
	});

	describe("Large Message History Creation", () => {
		it("should create extensive message history for testing", async () => {
			console.log("📚 Creating extensive message history...");

			// Join facilitator to discussion
			const { joinCode } = await facilitatorCaller.discussion.generateJoinCode({
				discussionId: testDiscussion.id,
			});
			await facilitatorCaller.discussion.join({ joinCode });

			// Create several participants
			const participants = ["Alice", "Bob", "Charlie", "Diana", "Eve"];
			const participantData = [];

			for (const name of participants) {
				const sessionId = `${name.toLowerCase()}-session-${Date.now()}`;
				await facilitatorCaller.participant.join({
					discussionId: testDiscussion.id,
					token: invitationToken,
					displayName: name,
					sessionId,
				});

				const participant = await testDb.participant.findFirst({
					where: { sessionId },
				});
				participantData.push({ name, sessionId, id: participant?.id });
			}

			// Create 50+ messages from various sources
			const messages = [];

			// Facilitator welcome message
			messages.push({
				authorId: facilitatorUser.id,
				participantId: null,
				senderName: facilitatorUser.name || "Facilitator",
				senderType: "USER",
				content: "Welcome everyone to our discussion on critical thinking!",
			});

			// Mixed messages from participants and facilitator
			for (let i = 1; i <= 49; i++) {
				const isFromFacilitator = i % 7 === 0; // Every 7th message from facilitator
				const participant = participantData[i % participants.length];

				if (isFromFacilitator) {
					messages.push({
						authorId: facilitatorUser.id,
						participantId: null,
						senderName: facilitatorUser.name || "Facilitator",
						senderType: "USER",
						content: `Facilitator insight ${Math.floor(i / 7)}: Let's explore this deeper...`,
					});
				} else {
					messages.push({
						authorId: null,
						participantId: participant?.id,
						senderName: participant?.name,
						senderType: "PARTICIPANT",
						content: `${participant?.name} says: This is message ${i} about critical thinking.`,
					});
				}
			}

			// Create messages in database with staggered timestamps
			const baseTime = Date.now() - 50 * 60000; // Start 50 minutes ago

			for (const [index, msgData] of messages.entries()) {
				await testDb.message.create({
					data: {
						discussionId: testDiscussion.id,
						...msgData,
						type: "USER",
						createdAt: new Date(baseTime + index * 60000), // 1 minute intervals
					},
				});
			}

			// Verify message count
			const totalMessages = await testDb.message.count({
				where: { discussionId: testDiscussion.id },
			});

			expect(totalMessages).toBe(50);
			console.log(`✅ Created ${totalMessages} messages for history testing`);
		});
	});

	describe("Initial Message History Load", () => {
		beforeEach(async () => {
			// Create extensive message history
			const { joinCode } = await facilitatorCaller.discussion.generateJoinCode({
				discussionId: testDiscussion.id,
			});
			await facilitatorCaller.discussion.join({ joinCode });

			// Create 30 test messages
			const baseTime = Date.now() - 30 * 60000;
			const messages = Array.from({ length: 30 }, (_, i) => ({
				discussionId: testDiscussion.id,
				authorId: facilitatorUser.id,
				senderName: facilitatorUser.name || "Facilitator",
				senderType: "USER",
				content: `Test message ${i + 1} for history testing`,
				type: "USER",
				createdAt: new Date(baseTime + i * 60000),
			}));

			await testDb.message.createMany({ data: messages });
		});

		it("should load last 20 messages on participant join", async () => {
			console.log("📥 Testing initial message history load...");

			const joinResult = await facilitatorCaller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Alice",
				sessionId: "alice-history-test",
			});

			expect(joinResult.success).toBe(true);
			expect(joinResult.messageHistory).toBeDefined();
			expect(joinResult.messageHistory.messages).toHaveLength(20);
			expect(joinResult.messageHistory.hasMore).toBe(true);
			expect(joinResult.messageHistory.totalCount).toBe(30);

			// Messages should be in chronological order (newest first)
			const messages = joinResult.messageHistory.messages;
			for (let i = 0; i < messages.length - 1; i++) {
				const current = new Date(messages[i]?.createdAt);
				const next = new Date(messages[i + 1]?.createdAt);
				expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
			}

			// Should show the most recent 20 messages
			expect(messages[0]?.content).toContain("Test message 30");
			expect(messages[19]?.content).toContain("Test message 11");

			console.log("✅ Initial message history load validated");
		});

		it("should provide pagination metadata", async () => {
			console.log("📊 Testing pagination metadata...");

			const joinResult = await facilitatorCaller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Bob",
				sessionId: "bob-pagination-test",
			});

			const history = joinResult.messageHistory;

			expect(history).toMatchObject({
				messages: expect.any(Array),
				totalCount: 30,
				hasMore: true,
				limit: 20,
				offset: 0,
				nextCursor: expect.any(String), // Cursor for next page
			});

			// Verify cursor points to correct position
			expect(history.messages).toHaveLength(20);
			expect(history.nextCursor).toBeDefined();

			console.log("✅ Pagination metadata validated");
		});

		it("should handle empty message history gracefully", async () => {
			console.log("🗂️ Testing empty history handling...");

			// Clear all messages
			await testDb.message.deleteMany({
				where: { discussionId: testDiscussion.id },
			});

			const joinResult = await facilitatorCaller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Charlie",
				sessionId: "charlie-empty-test",
			});

			expect(joinResult.messageHistory).toMatchObject({
				messages: [],
				totalCount: 0,
				hasMore: false,
				limit: 20,
				offset: 0,
				nextCursor: null,
			});

			console.log("✅ Empty history handling validated");
		});
	});

	describe("Lazy Loading Implementation", () => {
		beforeEach(async () => {
			// Create 100 messages for comprehensive lazy loading tests
			const { joinCode } = await facilitatorCaller.discussion.generateJoinCode({
				discussionId: testDiscussion.id,
			});
			await facilitatorCaller.discussion.join({ joinCode });

			const baseTime = Date.now() - 100 * 60000;
			const messages = Array.from({ length: 100 }, (_, i) => ({
				discussionId: testDiscussion.id,
				authorId: facilitatorUser.id,
				senderName: facilitatorUser.name || "Facilitator",
				senderType: "USER",
				content: `Lazy loading test message ${i + 1}`,
				type: "USER",
				createdAt: new Date(baseTime + i * 60000),
			}));

			await testDb.message.createMany({ data: messages });
		});

		it("should load earlier messages with cursor-based pagination", async () => {
			console.log("🔄 Testing cursor-based pagination...");

			// Join participant and get initial history
			await facilitatorCaller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Alice",
				sessionId: "alice-lazy-test",
			});

			const firstPage = await facilitatorCaller.participant.getMessages({
				discussionId: testDiscussion.id,
				sessionId: "alice-lazy-test",
				limit: 20,
			});

			expect(firstPage.messages).toHaveLength(20);
			expect(firstPage.hasMore).toBe(true);
			expect(firstPage.nextCursor).toBeDefined();

			// Load next page using cursor
			const secondPage = await facilitatorCaller.participant.getMessages({
				discussionId: testDiscussion.id,
				sessionId: "alice-lazy-test",
				limit: 20,
				cursor: firstPage.nextCursor,
			});

			expect(secondPage.messages).toHaveLength(20);
			expect(secondPage.hasMore).toBe(true);

			// Verify no overlap between pages
			const firstPageIds = new Set(firstPage.messages.map((m) => m.id));
			const secondPageIds = new Set(secondPage.messages.map((m) => m.id));
			const intersection = [...firstPageIds].filter((id) =>
				secondPageIds.has(id),
			);
			expect(intersection).toHaveLength(0);

			// Verify chronological order across pages
			const lastMessageFirstPage =
				firstPage.messages[firstPage.messages.length - 1];
			const firstMessageSecondPage = secondPage.messages[0];

			expect(
				new Date(lastMessageFirstPage?.createdAt).getTime(),
			).toBeGreaterThan(new Date(firstMessageSecondPage?.createdAt).getTime());

			console.log("✅ Cursor-based pagination validated");
		});

		it("should provide loading indicators and performance", async () => {
			console.log("⏳ Testing loading performance and indicators...");

			await facilitatorCaller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Bob",
				sessionId: "bob-performance-test",
			});

			// Test pagination performance
			const startTime = Date.now();

			const page1 = await facilitatorCaller.participant.getMessages({
				discussionId: testDiscussion.id,
				sessionId: "bob-performance-test",
				limit: 20,
			});

			const page2 = await facilitatorCaller.participant.getMessages({
				discussionId: testDiscussion.id,
				sessionId: "bob-performance-test",
				limit: 20,
				cursor: page1.nextCursor,
			});

			const totalTime = Date.now() - startTime;

			// Both requests should complete quickly
			expect(totalTime).toBeLessThan(1000);

			// Verify loading state information is provided
			expect(page1).toMatchObject({
				messages: expect.any(Array),
				loading: false, // Should be false when completed
				hasMore: true,
				totalCount: 100,
			});

			expect(page2).toMatchObject({
				messages: expect.any(Array),
				loading: false,
				hasMore: true,
			});

			console.log(`✅ Lazy loading performance: ${totalTime}ms for 2 pages`);
		});

		it("should handle deep pagination (multiple pages)", async () => {
			console.log("📖 Testing deep pagination...");

			await facilitatorCaller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Charlie",
				sessionId: "charlie-deep-test",
			});

			let currentCursor: string | null = null;
			let totalMessagesLoaded = 0;
			let pageCount = 0;

			// Load multiple pages
			do {
				const page = await facilitatorCaller.participant.getMessages({
					discussionId: testDiscussion.id,
					sessionId: "charlie-deep-test",
					limit: 15, // Smaller page size
					cursor: currentCursor,
				});

				totalMessagesLoaded += page.messages.length;
				pageCount++;
				currentCursor = page.nextCursor;

				// Verify page structure
				expect(page.messages.length).toBeLessThanOrEqual(15);

				if (page.hasMore) {
					expect(page.nextCursor).toBeDefined();
				} else {
					expect(page.nextCursor).toBeNull();
				}

				// Don't infinite loop
				if (pageCount > 10) break;
			} while (currentCursor);

			// Should have loaded all 100 messages across multiple pages
			expect(totalMessagesLoaded).toBe(100);
			expect(pageCount).toBeGreaterThan(6); // 100/15 ≈ 7 pages

			console.log(
				`✅ Deep pagination: ${totalMessagesLoaded} messages in ${pageCount} pages`,
			);
		});
	});

	describe("Message History Context and Display", () => {
		beforeEach(async () => {
			// Create diverse message history with different types and senders
			const { joinCode } = await facilitatorCaller.discussion.generateJoinCode({
				discussionId: testDiscussion.id,
			});
			await facilitatorCaller.discussion.join({ joinCode });

			// Create participants
			const participants = ["Alice", "Bob", "Charlie"];
			const participantIds = [];

			for (const name of participants) {
				const sessionId = `${name.toLowerCase()}-context-${Date.now()}`;
				await facilitatorCaller.participant.join({
					discussionId: testDiscussion.id,
					token: invitationToken,
					displayName: name,
					sessionId,
				});

				const participant = await testDb.participant.findFirst({
					where: { sessionId },
				});
				participantIds.push({ name, id: participant?.id });
			}

			// Create mixed message history
			const baseTime = Date.now() - 25 * 60000;
			const messages = [
				// Facilitator messages
				{
					authorId: facilitatorUser.id,
					participantId: null,
					senderName: facilitatorUser.name || "Facilitator",
					senderType: "USER",
					content: "Welcome! Today we'll discuss ethical decision making.",
				},
				// Participant messages
				{
					authorId: null,
					participantId: participantIds[0]?.id,
					senderName: "Alice",
					senderType: "PARTICIPANT",
					content: "I'm excited to explore this topic!",
				},
				{
					authorId: null,
					participantId: participantIds[1]?.id,
					senderName: "Bob",
					senderType: "PARTICIPANT",
					content: "What framework should we use for ethical analysis?",
				},
				// More facilitator guidance
				{
					authorId: facilitatorUser.id,
					participantId: null,
					senderName: facilitatorUser.name || "Facilitator",
					senderType: "USER",
					content: "Great question Bob! Let's start with consequentialism...",
				},
			];

			for (const [index, msgData] of messages.entries()) {
				await testDb.message.create({
					data: {
						discussionId: testDiscussion.id,
						...msgData,
						type: "USER",
						createdAt: new Date(baseTime + index * 300000), // 5 minute intervals
					},
				});
			}
		});

		it("should display rich message context with sender information", async () => {
			console.log("🎭 Testing rich message context display...");

			const joinResult = await facilitatorCaller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Diana",
				sessionId: "diana-context-test",
			});

			const messages = joinResult.messageHistory.messages;
			expect(messages.length).toBeGreaterThan(0);

			// Check facilitator message context
			const facilitatorMessage = messages.find((m) => m.senderType === "USER");
			expect(facilitatorMessage).toMatchObject({
				senderName: facilitatorUser.name || "Facilitator",
				senderType: "USER",
				authorId: facilitatorUser.id,
				participantId: null,
				content: expect.any(String),
				createdAt: expect.any(Date),
			});

			// Check participant message context
			const participantMessage = messages.find(
				(m) => m.senderType === "PARTICIPANT",
			);
			expect(participantMessage).toMatchObject({
				senderName: expect.stringMatching(/Alice|Bob|Charlie/),
				senderType: "PARTICIPANT",
				authorId: null,
				participantId: expect.any(String),
				content: expect.any(String),
				createdAt: expect.any(Date),
			});

			console.log("✅ Rich message context validated");
		});

		it("should show proper timestamps and message formatting", async () => {
			console.log("⏰ Testing timestamp and formatting...");

			await facilitatorCaller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Eve",
				sessionId: "eve-format-test",
			});

			const messages = await facilitatorCaller.participant.getMessages({
				discussionId: testDiscussion.id,
				sessionId: "eve-format-test",
				limit: 10,
			});

			for (const message of messages.messages) {
				// Check timestamp format
				expect(message.createdAt).toBeInstanceOf(Date);
				expect(new Date(message.createdAt).getTime()).toBeLessThan(Date.now());

				// Check message structure
				expect(message).toMatchObject({
					id: expect.any(String),
					content: expect.any(String),
					senderName: expect.any(String),
					senderType: expect.stringMatching(/USER|PARTICIPANT/),
					isEdited: expect.any(Boolean),
					editedAt: message.isEdited ? expect.any(Date) : null,
				});

				// Check content is properly formatted (no empty or null content)
				expect(message.content.trim().length).toBeGreaterThan(0);
			}

			console.log("✅ Timestamp and formatting validated");
		});

		it("should provide thread context for replied messages", async () => {
			console.log("🧵 Testing threaded message context...");

			// Create a threaded conversation
			const rootMessage = await testDb.message.create({
				data: {
					discussionId: testDiscussion.id,
					authorId: facilitatorUser.id,
					senderName: facilitatorUser.name || "Facilitator",
					senderType: "USER",
					content: "What are your thoughts on utilitarian ethics?",
					type: "USER",
				},
			});

			// Get a participant to reply to
			const participant = await testDb.participant.findFirst({
				where: { discussionId: testDiscussion.id },
			});

			await testDb.message.create({
				data: {
					discussionId: testDiscussion.id,
					participantId: participant?.id,
					senderName: participant?.displayName,
					senderType: "PARTICIPANT",
					content:
						"I think it focuses too much on outcomes and ignores intentions.",
					type: "USER",
					parentId: rootMessage.id,
				},
			});

			// Join new participant and check thread context
			await facilitatorCaller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Frank",
				sessionId: "frank-thread-test",
			});

			const messages = await facilitatorCaller.participant.getMessages({
				discussionId: testDiscussion.id,
				sessionId: "frank-thread-test",
				limit: 20,
			});

			// Find the threaded reply
			const threadedReply = messages.messages.find(
				(m) => m.parentId === rootMessage.id,
			);
			expect(threadedReply).toMatchObject({
				parentId: rootMessage.id,
				parent: {
					id: rootMessage.id,
					content: "What are your thoughts on utilitarian ethics?",
					senderName: facilitatorUser.name || "Facilitator",
					senderType: "USER",
				},
			});

			console.log("✅ Threaded message context validated");
		});
	});

	describe("History Performance and Optimization", () => {
		beforeEach(async () => {
			// Create large message dataset for performance testing
			const { joinCode } = await facilitatorCaller.discussion.generateJoinCode({
				discussionId: testDiscussion.id,
			});
			await facilitatorCaller.discussion.join({ joinCode });

			// Create 500 messages for performance testing
			const baseTime = Date.now() - 500 * 60000;
			const largeMessageSet = Array.from({ length: 500 }, (_, i) => ({
				discussionId: testDiscussion.id,
				authorId: facilitatorUser.id,
				senderName: facilitatorUser.name || "Facilitator",
				senderType: "USER",
				content: `Performance test message ${i + 1}: This is a longer message to test performance with various content lengths and to ensure that the lazy loading system can handle realistic message sizes efficiently.`,
				type: "USER",
				createdAt: new Date(baseTime + i * 60000),
			}));

			await testDb.message.createMany({ data: largeMessageSet });
		});

		it("should maintain performance with large message history", async () => {
			console.log("🚀 Testing large history performance...");

			// Join and measure initial load time
			const joinStartTime = Date.now();
			const joinResult = await facilitatorCaller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Alice",
				sessionId: "alice-performance",
			});
			const joinTime = Date.now() - joinStartTime;

			// Initial load should complete within 2 seconds
			expect(joinTime).toBeLessThan(2000);
			expect(joinResult.messageHistory.messages).toHaveLength(20);
			expect(joinResult.messageHistory.totalCount).toBe(500);

			// Test pagination performance
			const paginationStartTime = Date.now();
			await facilitatorCaller.participant.getMessages({
				discussionId: testDiscussion.id,
				sessionId: "alice-performance",
				limit: 20,
				cursor: joinResult.messageHistory.nextCursor,
			});
			const paginationTime = Date.now() - paginationStartTime;

			// Pagination should complete within 1 second
			expect(paginationTime).toBeLessThan(1000);

			console.log(
				`✅ Performance: Join ${joinTime}ms, Pagination ${paginationTime}ms`,
			);
		});

		it("should handle concurrent history requests efficiently", async () => {
			console.log("⚡ Testing concurrent history requests...");

			// Join multiple participants simultaneously
			const participants = ["Alice", "Bob", "Charlie", "Diana"];
			const joinPromises = participants.map((name) =>
				facilitatorCaller.participant.join({
					discussionId: testDiscussion.id,
					token: invitationToken,
					displayName: name,
					sessionId: `${name.toLowerCase()}-concurrent`,
				}),
			);

			const startTime = Date.now();
			const joinResults = await Promise.all(joinPromises);
			const concurrentTime = Date.now() - startTime;

			// All joins should complete within 3 seconds
			expect(concurrentTime).toBeLessThan(3000);

			// All should receive the same message history
			for (const result of joinResults) {
				expect(result.success).toBe(true);
				expect(result.messageHistory.messages).toHaveLength(20);
				expect(result.messageHistory.totalCount).toBe(500);
			}

			console.log(
				`✅ Concurrent joins: ${participants.length} participants in ${concurrentTime}ms`,
			);
		});

		it("should optimize memory usage during history loading", async () => {
			console.log("🧠 Testing memory optimization...");

			await facilitatorCaller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Alice",
				sessionId: "alice-memory-test",
			});

			// Load multiple pages and verify data structure efficiency
			let cursor: string | null = null;
			let totalMessages = 0;
			const pageSize = 25;

			// Load 10 pages (250 messages)
			for (let i = 0; i < 10; i++) {
				const page = await facilitatorCaller.participant.getMessages({
					discussionId: testDiscussion.id,
					sessionId: "alice-memory-test",
					limit: pageSize,
					cursor,
				});

				totalMessages += page.messages.length;
				cursor = page.nextCursor;

				// Verify each page has efficient data structure
				for (const message of page.messages) {
					// Check for unnecessary nested data
					expect(Object.keys(message).length).toBeLessThan(15); // Reasonable field count

					// Verify no circular references or excessive nesting
					expect(typeof message.content).toBe("string");
					expect(message.content.length).toBeGreaterThan(0);
				}

				if (!page.hasMore) break;
			}

			expect(totalMessages).toBeGreaterThan(200);
			console.log(
				`✅ Memory optimization: Loaded ${totalMessages} messages efficiently`,
			);
		});

		it("should implement proper database indexing for history queries", async () => {
			console.log("🔍 Testing database query optimization...");

			await facilitatorCaller.participant.join({
				discussionId: testDiscussion.id,
				token: invitationToken,
				displayName: "Bob",
				sessionId: "bob-db-test",
			});

			// Test various query patterns that should be optimized
			const queryTests = [
				// Basic pagination
				{
					name: "Basic pagination",
					query: () =>
						facilitatorCaller.participant.getMessages({
							discussionId: testDiscussion.id,
							sessionId: "bob-db-test",
							limit: 20,
						}),
				},
				// Cursor-based pagination
				{
					name: "Cursor pagination",
					query: async () => {
						const firstPage = await facilitatorCaller.participant.getMessages({
							discussionId: testDiscussion.id,
							sessionId: "bob-db-test",
							limit: 20,
						});
						return facilitatorCaller.participant.getMessages({
							discussionId: testDiscussion.id,
							sessionId: "bob-db-test",
							limit: 20,
							cursor: firstPage.nextCursor,
						});
					},
				},
				// Thread-specific queries
				{
					name: "Thread queries",
					query: () =>
						facilitatorCaller.participant.getMessages({
							discussionId: testDiscussion.id,
							sessionId: "bob-db-test",
							parentId: null, // Root messages only
							limit: 20,
						}),
				},
			];

			for (const test of queryTests) {
				const startTime = Date.now();
				const result = await test.query();
				const queryTime = Date.now() - startTime;

				// Each query should complete quickly (indicating good indexing)
				expect(queryTime).toBeLessThan(500);
				expect(result.messages).toBeDefined();

				console.log(`✅ ${test.name}: ${queryTime}ms`);
			}

			console.log("✅ Database optimization validated");
		});
	});
});
