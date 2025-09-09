import type { Session } from "next-auth";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	cleanupDatabase,
	createTestCaller,
	createTestUser,
	testDb,
} from "../db-setup";

describe("lesson.list tRPC procedure", () => {
	let testUser: Awaited<ReturnType<typeof createTestUser>>;
	let otherUser: Awaited<ReturnType<typeof createTestUser>>;
	let testSession: Session;

	beforeEach(async () => {
		await cleanupDatabase();
		testUser = await createTestUser();
		otherUser = await createTestUser();
		testSession = {
			user: { id: testUser.id, email: testUser.email, name: testUser.name },
			expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		};
	});

	afterEach(async () => {
		await cleanupDatabase();
	});

	it("should return empty array when user has no lessons", async () => {
		const caller = await createTestCaller(testSession);

		const result = await caller.lesson.list();

		expect(result).toEqual([]);
	});

	it("should return user's lessons with correct status computation", async () => {
		// Create test lessons directly in database
		const draftLesson = await testDb.lesson.create({
			data: {
				title: "Draft Lesson",
				description: "Draft description",
				content: "Draft content",
				creatorId: testUser.id,
				isPublished: false,
				isArchived: false,
			},
		});

		const publishedLesson = await testDb.lesson.create({
			data: {
				title: "Published Lesson",
				description: "Published description",
				content: "Published content",
				creatorId: testUser.id,
				isPublished: true,
				isArchived: false,
				publishedAt: new Date(),
			},
		});

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

		const result = await caller.lesson.list();

		expect(result).toHaveLength(3);

		const draft = result.find((l) => l.id === draftLesson.id);
		expect(draft?.status).toBe("draft");
		expect(draft?.canEdit).toBe(true);
		expect(draft?.canPublish).toBe(true);
		expect(draft?.canArchive).toBe(false);

		const published = result.find((l) => l.id === publishedLesson.id);
		expect(published?.status).toBe("published");
		expect(published?.canEdit).toBe(true);
		expect(published?.canPublish).toBe(false);
		expect(published?.canArchive).toBe(true);

		const archived = result.find((l) => l.id === archivedLesson.id);
		expect(archived?.status).toBe("archived");
		expect(archived?.canEdit).toBe(false);
		expect(archived?.canPublish).toBe(false);
		expect(archived?.canArchive).toBe(false);
	});

	it("should only return lessons owned by the authenticated user", async () => {
		// Create lesson for test user
		await testDb.lesson.create({
			data: {
				title: "User Lesson",
				description: "User description",
				content: "User content",
				creatorId: testUser.id,
			},
		});

		// Create lesson for other user
		await testDb.lesson.create({
			data: {
				title: "Other User Lesson",
				description: "Other description",
				content: "Other content",
				creatorId: otherUser.id,
			},
		});

		const caller = await createTestCaller(testSession);

		const result = await caller.lesson.list();

		expect(result).toHaveLength(1);
		expect(result[0]?.title).toBe("User Lesson");
		expect(result[0]?.creatorId).toBe(testUser.id);
	});

	it("should reject unauthenticated requests", async () => {
		const caller = await createTestCaller(null);

		await expect(caller.lesson.list()).rejects.toThrow("UNAUTHORIZED");
	});

	it("should return lessons ordered by updatedAt descending", async () => {
		const now = new Date();

		// Create lessons with different update times
		const oldLesson = await testDb.lesson.create({
			data: {
				title: "Old Lesson",
				description: "Old description",
				content: "Old content",
				creatorId: testUser.id,
				updatedAt: new Date(now.getTime() - 60000), // 1 minute ago
			},
		});

		const newLesson = await testDb.lesson.create({
			data: {
				title: "New Lesson",
				description: "New description",
				content: "New content",
				creatorId: testUser.id,
				updatedAt: now, // Now
			},
		});

		const caller = await createTestCaller(testSession);

		const result = await caller.lesson.list();

		expect(result).toHaveLength(2);
		expect(result[0]?.id).toBe(newLesson.id); // Most recent first
		expect(result[1]?.id).toBe(oldLesson.id);
	});
});
