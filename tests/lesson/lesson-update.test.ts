import type { Session } from "next-auth";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	cleanupDatabase,
	createTestCaller,
	createTestUser,
	testDb,
} from "../db-setup";

describe("lesson.update tRPC procedure", () => {
	let testUser: Awaited<ReturnType<typeof createTestUser>>;
	let otherUser: Awaited<ReturnType<typeof createTestUser>>;
	let testSession: Session;
	let draftLesson: any;
	let publishedLesson: any;
	let archivedLesson: any;

	beforeEach(async () => {
		await cleanupDatabase();
		testUser = await createTestUser();
		otherUser = await createTestUser();
		testSession = {
			user: { id: testUser.id, email: testUser.email, name: testUser.name },
			expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		};

		// Create test lessons
		draftLesson = await testDb.lesson.create({
			data: {
				title: "Draft Lesson",
				description: "Draft description",
				content: "Draft content",
				objectives: ["Original objective"],
				creatorId: testUser.id,
				isPublished: false,
				isArchived: false,
			},
		});

		publishedLesson = await testDb.lesson.create({
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

		archivedLesson = await testDb.lesson.create({
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
	});

	afterEach(async () => {
		await cleanupDatabase();
	});

	it("should update draft lesson with valid data", async () => {
		const caller = await createTestCaller(testSession);

		const updateData = {
			id: draftLesson.id,
			title: "Updated Draft Lesson",
			description: "Updated description",
			objectives: ["Updated objective 1", "Updated objective 2"],
			facilitationStyle: "ethical" as const,
		};

		const result = await caller.lesson.update(updateData);

		expect(result.title).toBe("Updated Draft Lesson");
		expect(result.description).toBe("Updated description");
		expect(result.objectives).toEqual([
			"Updated objective 1",
			"Updated objective 2",
		]);
		expect(result.facilitationStyle).toBe("ethical");
		expect(result.updatedAt.getTime()).toBeGreaterThan(
			draftLesson.updatedAt.getTime(),
		);
	});

	it("should update published lesson (allowing content changes)", async () => {
		const caller = await createTestCaller(testSession);

		const updateData = {
			id: publishedLesson.id,
			title: "Updated Published Lesson",
			content: "Updated published content",
		};

		const result = await caller.lesson.update(updateData);

		expect(result.title).toBe("Updated Published Lesson");
		expect(result.content).toBe("Updated published content");
		expect(result.isPublished).toBe(true); // Should remain published
		expect(result.status).toBe("published");
	});

	it("should reject updates to archived lessons", async () => {
		const caller = await createTestCaller(testSession);

		const updateData = {
			id: archivedLesson.id,
			title: "Attempt to update archived",
		};

		await expect(caller.lesson.update(updateData)).rejects.toThrow(
			"Archived lessons cannot be edited",
		);
	});

	it("should reject update with invalid title length", async () => {
		const caller = await createTestCaller(testSession);

		const updateData = {
			id: draftLesson.id,
			title: "A".repeat(201), // Exceeds 200 character limit
		};

		await expect(caller.lesson.update(updateData)).rejects.toThrow(
			"String must contain at most 200 character(s)",
		);
	});

	it("should reject update with empty description", async () => {
		const caller = await createTestCaller(testSession);

		const updateData = {
			id: draftLesson.id,
			description: "", // Empty description
		};

		await expect(caller.lesson.update(updateData)).rejects.toThrow(
			"String must contain at least 1 character(s)",
		);
	});

	it("should throw FORBIDDEN when updating other user's lesson", async () => {
		const otherSession: Session = {
			user: { id: otherUser.id, email: otherUser.email, name: otherUser.name },
			expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		};

		const caller = await createTestCaller(otherSession);

		const updateData = {
			id: draftLesson.id,
			title: "Unauthorized update",
		};

		await expect(caller.lesson.update(updateData)).rejects.toThrow(
			"Access denied",
		);
	});

	it("should throw NOT_FOUND for non-existent lesson", async () => {
		const caller = await createTestCaller(testSession);

		const updateData = {
			id: "clnon9existent123456789012345", // Valid CUID format but non-existent
			title: "Update non-existent",
		};

		await expect(caller.lesson.update(updateData)).rejects.toThrow(
			"Lesson not found",
		);
	});

	it("should throw UNAUTHORIZED for unauthenticated requests", async () => {
		const caller = await createTestCaller(null);

		const updateData = {
			id: draftLesson.id,
			title: "Unauthenticated update",
		};

		await expect(caller.lesson.update(updateData)).rejects.toThrow(
			"UNAUTHORIZED",
		);
	});

	it("should handle partial updates correctly", async () => {
		const caller = await createTestCaller(testSession);

		// Update only the title
		const updateData = {
			id: draftLesson.id,
			title: "Only Title Updated",
		};

		const result = await caller.lesson.update(updateData);

		expect(result.title).toBe("Only Title Updated");
		expect(result.description).toBe("Draft description"); // Should remain unchanged
		expect(result.content).toBe("Draft content"); // Should remain unchanged
	});

	it("should validate facilitation style enum values", async () => {
		const caller = await createTestCaller(testSession);

		const updateData = {
			id: draftLesson.id,
			facilitationStyle: "invalid-style" as any,
		};

		await expect(caller.lesson.update(updateData)).rejects.toThrow(
			"Invalid enum value",
		);
	});
});
