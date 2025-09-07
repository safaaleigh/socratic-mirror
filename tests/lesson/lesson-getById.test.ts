import type { Session } from "next-auth";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	cleanupDatabase,
	createTestCaller,
	createTestUser,
	testDb,
} from "../db-setup";

describe("lesson.getById tRPC procedure", () => {
	let testUser: Awaited<ReturnType<typeof createTestUser>>;
	let otherUser: Awaited<ReturnType<typeof createTestUser>>;
	let testSession: Session;
	let testLesson: any;

	beforeEach(async () => {
		await cleanupDatabase();
		testUser = await createTestUser();
		otherUser = await createTestUser();
		testSession = {
			user: { id: testUser.id, email: testUser.email, name: testUser.name },
			expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		};

		// Create a test lesson
		testLesson = await testDb.lesson.create({
			data: {
				title: "Test Lesson",
				description: "Test description",
				content: "Test content",
				objectives: ["Objective 1", "Objective 2"],
				keyQuestions: ["Question 1", "Question 2"],
				facilitationStyle: "analytical",
				suggestedDuration: 45,
				suggestedGroupSize: 4,
				creatorId: testUser.id,
			},
		});
	});

	afterEach(async () => {
		await cleanupDatabase();
	});

	it("should return lesson by id with correct data and computed fields", async () => {
		const caller = await createTestCaller(testSession);

		const result = await caller.lesson.getById({ id: testLesson.id });

		expect(result).toEqual({
			id: testLesson.id,
			title: "Test Lesson",
			description: "Test description",
			content: "Test content",
			objectives: ["Objective 1", "Objective 2"],
			keyQuestions: ["Question 1", "Question 2"],
			facilitationStyle: "analytical",
			suggestedDuration: 45,
			suggestedGroupSize: 4,
			creatorId: testUser.id,
			isPublished: false,
			isArchived: false,
			status: "draft",
			canEdit: true,
			canPublish: true,
			canArchive: false,
			canDelete: true,
			createdAt: expect.any(Date),
			updatedAt: expect.any(Date),
			publishedAt: null,
		});
	});

	it("should return published lesson with correct status", async () => {
		const publishedLesson = await testDb.lesson.create({
			data: {
				title: "Published Lesson",
				description: "Published description",
				content: "Published content",
				creatorId: testUser.id,
				isPublished: true,
				publishedAt: new Date(),
			},
		});

		const caller = await createTestCaller(testSession);

		const result = await caller.lesson.getById({ id: publishedLesson.id });

		expect(result.status).toBe("published");
		expect(result.canEdit).toBe(true);
		expect(result.canPublish).toBe(false);
		expect(result.canArchive).toBe(true);
		expect(result.publishedAt).toBeInstanceOf(Date);
	});

	it("should return archived lesson with correct status", async () => {
		const archivedLesson = await testDb.lesson.create({
			data: {
				title: "Archived Lesson",
				description: "Archived description",
				content: "Archived content",
				creatorId: testUser.id,
				isPublished: true,
				isArchived: true,
				publishedAt: new Date(),
			},
		});

		const caller = await createTestCaller(testSession);

		const result = await caller.lesson.getById({ id: archivedLesson.id });

		expect(result.status).toBe("archived");
		expect(result.canEdit).toBe(false);
		expect(result.canPublish).toBe(false);
		expect(result.canArchive).toBe(false);
		expect(result.canDelete).toBe(true);
	});

	it("should throw NOT_FOUND for non-existent lesson", async () => {
		const caller = await createTestCaller(testSession);

		await expect(
			caller.lesson.getById({ id: "clnon9existent123456789012345" }), // Valid CUID format but non-existent
		).rejects.toThrow("Lesson not found");
	});

	it("should throw FORBIDDEN when accessing other user's lesson", async () => {
		const otherSession: Session = {
			user: { id: otherUser.id, email: otherUser.email, name: otherUser.name },
			expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		};

		const caller = await createTestCaller(otherSession);

		await expect(caller.lesson.getById({ id: testLesson.id })).rejects.toThrow(
			"Access denied",
		);
	});

	it("should throw UNAUTHORIZED for unauthenticated requests", async () => {
		const caller = await createTestCaller(null);

		await expect(caller.lesson.getById({ id: testLesson.id })).rejects.toThrow(
			"UNAUTHORIZED",
		);
	});

	it("should validate lesson ID format", async () => {
		const caller = await createTestCaller(testSession);

		await expect(
			caller.lesson.getById({ id: "invalid-id-format" }),
		).rejects.toThrow("Invalid cuid");
	});
});
