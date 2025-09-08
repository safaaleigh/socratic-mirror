import type { Lesson } from "@prisma/client";
import type { Session } from "next-auth";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	cleanupDatabase,
	createTestCaller,
	createTestLesson,
	createTestUser,
	testDb,
} from "../db-setup";

describe("Discussion Router Contract Tests", () => {
	let testUser: Awaited<ReturnType<typeof createTestUser>>;
	let testSession: Session;
	let caller: Awaited<ReturnType<typeof createTestCaller>>;
	let testLesson: Lesson;

	beforeEach(async () => {
		await cleanupDatabase();
		testUser = await createTestUser();
		testSession = {
			user: { id: testUser.id, email: testUser.email, name: testUser.name },
			expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		};
		caller = await createTestCaller(testSession);
		testLesson = await createTestLesson(testUser.id);
	});

	afterEach(async () => {
		await cleanupDatabase();
	});

	describe("create", () => {
		it("should create a new discussion from a lesson", async () => {
			const input = {
				lessonId: testLesson.id,
				name: "Test Discussion",
				description: "Test discussion description",
				maxParticipants: 10,
				isPublic: false,
			};

			const result = await caller.discussion.create(input);

			expect(result).toMatchObject({
				id: expect.any(String),
				name: input.name,
				description: input.description,
				creatorId: testUser.id,
				maxParticipants: input.maxParticipants,
				isPublic: input.isPublic,
			});
		});

		it("should validate input parameters", async () => {
			const invalidInput = {
				lessonId: "",
				name: "",
				maxParticipants: -1,
			};

			await expect(
				caller.discussion.create(invalidInput as any),
			).rejects.toThrow();
		});
	});

	describe("update", () => {
		let testDiscussion: any;

		beforeEach(async () => {
			// Create discussion via tRPC to ensure proper setup
			testDiscussion = await caller.discussion.create({
				lessonId: testLesson.id,
				name: "Test Discussion",
				description: "Test description",
				maxParticipants: 10,
				isPublic: false,
			});
		});

		it("should update discussion details for creator", async () => {
			const input = {
				id: testDiscussion.id,
				name: "Updated Discussion Name",
				description: "Updated description",
			};

			const result = await caller.discussion.update(input);

			expect(result).toMatchObject({
				id: testDiscussion.id,
				name: input.name,
				description: input.description,
			});
		});

		it("should reject updates from non-creator", async () => {
			const anotherUser = await createTestUser();
			const nonCreatorSession: Session = {
				user: {
					id: anotherUser.id,
					email: anotherUser.email,
					name: anotherUser.name,
				},
				expires: testSession.expires,
			};
			const nonCreatorCaller = await createTestCaller(nonCreatorSession);

			await expect(
				nonCreatorCaller.discussion.update({
					id: testDiscussion.id,
					name: "Should Fail",
				}),
			).rejects.toThrow();
		});
	});

	describe("close", () => {
		let testDiscussion: any;

		beforeEach(async () => {
			// Create discussion via tRPC to ensure proper setup
			testDiscussion = await caller.discussion.create({
				lessonId: testLesson.id,
				name: "Test Discussion",
				description: "Test description",
				maxParticipants: 10,
				isPublic: false,
			});
		});

		it("should close an active discussion", async () => {
			const input = {
				id: testDiscussion.id,
			};

			const result = await caller.discussion.close(input);

			expect(result).toMatchObject({
				id: input.id,
				isActive: false,
				closedAt: expect.any(Date),
			});
		});
	});

	describe("getById", () => {
		let testDiscussion: any;

		beforeEach(async () => {
			// Create discussion via tRPC to ensure proper setup
			testDiscussion = await caller.discussion.create({
				lessonId: testLesson.id,
				name: "Test Discussion",
				description: "Test description",
				maxParticipants: 10,
				isPublic: false,
			});
		});

		it("should retrieve discussion details with computed fields", async () => {
			const input = {
				id: testDiscussion.id,
			};

			const result = await caller.discussion.getById(input);

			expect(result).toMatchObject({
				id: input.id,
				name: expect.any(String),
				creatorId: expect.any(String),
				creator: expect.objectContaining({
					id: expect.any(String),
					email: expect.any(String),
				}),
				participantCount: expect.any(Number),
				userRole: expect.any(String),
			});
		});
	});

	describe("list", () => {
		beforeEach(async () => {
			// Create some test discussions
			await testDb.discussion.create({
				data: {
					lessonId: testLesson.id,
					name: "Test Discussion 1",
					description: "Test description 1",
					creatorId: testUser.id,
					maxParticipants: 10,
					isPublic: false,
					isActive: true,
				},
			});

			await testDb.discussion.create({
				data: {
					lessonId: testLesson.id,
					name: "Test Discussion 2",
					description: "Test description 2",
					creatorId: testUser.id,
					maxParticipants: 10,
					isPublic: false,
					isActive: true,
				},
			});
		});

		it("should list discussions with pagination", async () => {
			const input = {
				role: "all" as const,
				limit: 10,
			};

			const result = await caller.discussion.list(input);

			expect(result).toMatchObject({
				discussions: expect.any(Array),
				hasMore: expect.any(Boolean),
			});

			if (result.discussions.length > 0) {
				expect(result.discussions[0]).toMatchObject({
					id: expect.any(String),
					name: expect.any(String),
					isActive: expect.any(Boolean),
				});
			}
		});

		it("should filter by role", async () => {
			const creatorResult = await caller.discussion.list({
				role: "creator",
			});
			const participantResult = await caller.discussion.list({
				role: "participant",
			});

			expect(creatorResult.discussions).toBeDefined();
			expect(participantResult.discussions).toBeDefined();
		});
	});

	describe("generateJoinCode", () => {
		let testDiscussion: any;

		beforeEach(async () => {
			// Create discussion via tRPC to ensure proper setup
			testDiscussion = await caller.discussion.create({
				lessonId: testLesson.id,
				name: "Test Discussion",
				description: "Test description",
				maxParticipants: 10,
				isPublic: false,
			});
		});

		it("should generate a unique join code", async () => {
			const input = {
				discussionId: testDiscussion.id,
			};

			const result = await caller.discussion.generateJoinCode(input);

			expect(result).toMatchObject({
				joinCode: expect.stringMatching(/^[A-Z0-9]{8}$/),
				expiresAt: expect.any(Date),
			});
		});
	});

	describe("join", () => {
		let testDiscussion: any;
		let joinCode: string;

		beforeEach(async () => {
			// Create discussion via tRPC to ensure proper setup
			testDiscussion = await caller.discussion.create({
				lessonId: testLesson.id,
				name: "Test Discussion",
				description: "Test description",
				maxParticipants: 10,
				isPublic: false,
			});

			// Generate a join code
			const result = await caller.discussion.generateJoinCode({
				discussionId: testDiscussion.id,
			});
			joinCode = result.joinCode;
		});

		it("should allow joining with valid join code", async () => {
			// Create a different user to join
			const newUser = await createTestUser();
			const newSession: Session = {
				user: { id: newUser.id, email: newUser.email, name: newUser.name },
				expires: testSession.expires,
			};
			const newCaller = await createTestCaller(newSession);

			const result = await newCaller.discussion.join({ joinCode });

			expect(result).toMatchObject({
				discussion: expect.objectContaining({
					id: testDiscussion.id,
					name: testDiscussion.name,
				}),
				participant: expect.objectContaining({
					userId: newUser.id,
					role: expect.any(String),
					status: "ACTIVE",
				}),
			});
		});

		it("should reject invalid join codes", async () => {
			await expect(
				caller.discussion.join({ joinCode: "INVALID" }),
			).rejects.toThrow();
		});
	});

	describe("leave", () => {
		let testDiscussion: any;
		let participantUser: Awaited<ReturnType<typeof createTestUser>>;
		let participantCaller: any;

		beforeEach(async () => {
			// Create discussion via tRPC to ensure proper setup
			testDiscussion = await caller.discussion.create({
				lessonId: testLesson.id,
				name: "Test Discussion",
				description: "Test description",
				maxParticipants: 10,
				isPublic: false,
			});

			// Generate a join code
			const { joinCode } = await caller.discussion.generateJoinCode({
				discussionId: testDiscussion.id,
			});

			// Create a new user and have them join
			participantUser = await createTestUser();
			const participantSession: Session = {
				user: {
					id: participantUser.id,
					email: participantUser.email,
					name: participantUser.name,
				},
				expires: testSession.expires,
			};
			participantCaller = await createTestCaller(participantSession);
			await participantCaller.discussion.join({ joinCode });
		});

		it("should allow participants to leave discussion", async () => {
			const input = {
				discussionId: testDiscussion.id,
			};

			const result = await participantCaller.discussion.leave(input);

			expect(result).toMatchObject({
				success: true,
			});
		});
	});

	describe("getParticipants", () => {
		let testDiscussion: any;

		beforeEach(async () => {
			// Create discussion via tRPC to ensure proper setup
			testDiscussion = await caller.discussion.create({
				lessonId: testLesson.id,
				name: "Test Discussion",
				description: "Test description",
				maxParticipants: 10,
				isPublic: false,
			});
		});

		it("should retrieve list of participants", async () => {
			const input = {
				id: testDiscussion.id,
			};

			const result = await caller.discussion.getParticipants(input);

			expect(result).toMatchObject({
				participants: expect.any(Array),
			});

			if (result.participants.length > 0) {
				expect(result.participants[0]).toMatchObject({
					userId: expect.any(String),
					user: expect.objectContaining({
						id: expect.any(String),
						email: expect.any(String),
					}),
					role: expect.any(String),
					status: expect.any(String),
					joinedAt: expect.any(Date),
				});
			}
		});
	});

	describe("removeParticipant", () => {
		let testDiscussion: any;
		let participantUser: Awaited<ReturnType<typeof createTestUser>>;
		let participantRecord: any;

		beforeEach(async () => {
			// Create discussion via tRPC to ensure proper setup
			testDiscussion = await caller.discussion.create({
				lessonId: testLesson.id,
				name: "Test Discussion",
				description: "Test description",
				maxParticipants: 10,
				isPublic: false,
			});

			// Add another participant to remove
			participantUser = await createTestUser();
			participantRecord = await testDb.discussionParticipant.create({
				data: {
					discussionId: testDiscussion.id,
					userId: participantUser.id,
					role: "PARTICIPANT",
					status: "ACTIVE",
				},
			});
		});

		it("should allow moderators to remove participants", async () => {
			const input = {
				discussionId: testDiscussion.id,
				participantId: participantRecord.id, // Use the DiscussionParticipant.id, not userId
				reason: "Violation of discussion rules",
			};

			const result = await caller.discussion.removeParticipant(input);

			expect(result).toMatchObject({
				success: true,
			});
		});
	});

	describe("updateParticipantRole", () => {
		let testDiscussion: any;
		let participantUser: Awaited<ReturnType<typeof createTestUser>>;
		let participantRecord: any;

		beforeEach(async () => {
			// Create discussion via tRPC to ensure proper setup
			testDiscussion = await caller.discussion.create({
				lessonId: testLesson.id,
				name: "Test Discussion",
				description: "Test description",
				maxParticipants: 10,
				isPublic: false,
			});

			// Add another participant to update
			participantUser = await createTestUser();
			participantRecord = await testDb.discussionParticipant.create({
				data: {
					discussionId: testDiscussion.id,
					userId: participantUser.id,
					role: "PARTICIPANT",
					status: "ACTIVE",
				},
			});
		});

		it("should allow creator to update participant roles", async () => {
			const input = {
				discussionId: testDiscussion.id,
				participantId: participantRecord.id, // Use the DiscussionParticipant.id, not userId
				role: "MODERATOR" as const,
			};

			const result = await caller.discussion.updateParticipantRole(input);

			expect(result).toMatchObject({
				userId: participantUser.id, // Check the actual userId
				role: input.role,
			});
		});
	});
});
