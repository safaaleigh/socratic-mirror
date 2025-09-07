import type { Session } from "next-auth";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	cleanupDatabase,
	createTestCaller,
	createTestUser,
	testDb,
} from "../db-setup";

describe("Discussion Creation Flow Integration Test", () => {
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

	it("should complete full discussion creation flow", async () => {
		// Step 1: Create a lesson first (prerequisite)
		const lesson = await testDb.lesson.create({
			data: {
				title: "Critical Thinking 101",
				description: "Learn to think critically",
				content: "Lesson content here",
				objectives: ["Think critically", "Analyze arguments"],
				keyQuestions: ["What is the main argument?"],
				facilitationStyle: "socratic",
				suggestedDuration: 45,
				suggestedGroupSize: 6,
				creatorId: testUser.id,
				isPublished: true,
			},
		});

		// Step 2: Create a discussion from the lesson
		const discussion = await caller.discussion.create({
			lessonId: lesson.id,
			name: "Evening Critical Thinking Session",
			description: "Join us for an engaging discussion",
			maxParticipants: 10,
			isPublic: false,
			scheduledFor: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
			aiConfig: {
				model: "gpt-4",
				temperature: 0.7,
				maxTokens: 500,
			},
		});

		expect(discussion).toMatchObject({
			id: expect.any(String),
			name: "Evening Critical Thinking Session",
			lessonId: lesson.id,
			creatorId: testUser.id,
			isActive: true,
			maxParticipants: 10,
		});

		// Step 3: Verify discussion is in the list
		const list = await caller.discussion.list({ role: "creator" });
		expect(list.discussions).toHaveLength(1);
		expect(list.discussions[0]?.id).toBe(discussion.id);

		// Step 4: Generate a join code
		const joinCodeResult = await caller.discussion.generateJoinCode({
			discussionId: discussion.id,
		});

		expect(joinCodeResult).toMatchObject({
			joinCode: expect.stringMatching(/^[A-Z0-9]{8}$/),
			expiresAt: expect.any(Date),
		});

		// Step 5: Verify discussion details include the join code
		const discussionWithCode = await caller.discussion.getById({
			id: discussion.id,
		});

		expect(discussionWithCode.joinCode).toBe(joinCodeResult.joinCode);

		// Step 6: Test another user joining with the code
		const participant = await createTestUser();
		const participantSession: Session = {
			user: {
				id: participant.id,
				email: participant.email,
				name: participant.name,
			},
			expires: testSession.expires,
		};
		const participantCaller = await createTestCaller(participantSession);

		const joinResult = await participantCaller.discussion.join({
			joinCode: joinCodeResult.joinCode,
		});

		expect(joinResult).toMatchObject({
			discussion: expect.objectContaining({
				id: discussion.id,
			}),
			participant: expect.objectContaining({
				userId: participant.id,
				role: "PARTICIPANT",
				status: "ACTIVE",
			}),
		});

		// Step 7: Verify participant count increased
		const updatedDiscussion = await caller.discussion.getById({
			id: discussion.id,
		});

		expect(updatedDiscussion.participantCount).toBe(2); // Creator + 1 participant

		// Step 8: Get participants list
		const participants = await caller.discussion.getParticipants({
			id: discussion.id,
		});

		expect(participants.participants).toHaveLength(2);
		const participantIds = participants.participants.map((p) => p.userId);
		expect(participantIds).toContain(testUser.id);
		expect(participantIds).toContain(participant.id);

		// Step 9: Update discussion details
		const updated = await caller.discussion.update({
			id: discussion.id,
			name: "Updated Discussion Name",
			maxParticipants: 15,
		});

		expect(updated.name).toBe("Updated Discussion Name");
		expect(updated.maxParticipants).toBe(15);

		// Step 10: Close the discussion
		const closed = await caller.discussion.close({
			id: discussion.id,
		});

		expect(closed).toMatchObject({
			id: discussion.id,
			isActive: false,
			closedAt: expect.any(Date),
		});
	});

	it("should enforce discussion permissions", async () => {
		// Create a lesson
		const lesson = await testDb.lesson.create({
			data: {
				title: "Test Lesson",
				content: "Content",
				objectives: ["Learn"],
				keyQuestions: ["Why?"],
				facilitationStyle: "socratic",
				creatorId: testUser.id,
				isPublished: true,
			},
		});

		// Create a discussion
		const discussion = await caller.discussion.create({
			lessonId: lesson.id,
			name: "Private Discussion",
			maxParticipants: 5,
			isPublic: false,
		});

		// Try to update as non-creator
		const otherUser = await createTestUser();
		const otherSession: Session = {
			user: { id: otherUser.id, email: otherUser.email, name: otherUser.name },
			expires: testSession.expires,
		};
		const otherCaller = await createTestCaller(otherSession);

		// Should fail to update
		await expect(
			otherCaller.discussion.update({
				id: discussion.id,
				name: "Hacked Name",
			}),
		).rejects.toThrow();

		// Should fail to close
		await expect(
			otherCaller.discussion.close({
				id: discussion.id,
			}),
		).rejects.toThrow();

		// But should be able to join with code
		const { joinCode } = await caller.discussion.generateJoinCode({
			discussionId: discussion.id,
		});

		const joinResult = await otherCaller.discussion.join({
			joinCode,
		});

		expect(joinResult.participant.userId).toBe(otherUser.id);
	});
});
