import type { Session } from "next-auth";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	cleanupDatabase,
	createTestCaller,
	createTestUser,
	testDb,
} from "../db-setup";

describe("lesson lifecycle procedures", () => {
	let testUser: Awaited<ReturnType<typeof createTestUser>>;
	let otherUser: Awaited<ReturnType<typeof createTestUser>>;
	let testSession: Session;
	let draftLesson: { id: string };
	let publishedLesson: { id: string };
	let archivedLesson: { id: string };

	beforeEach(async () => {
		await cleanupDatabase();
		testUser = await createTestUser();
		otherUser = await createTestUser();
		testSession = {
			user: { id: testUser.id, email: testUser.email, name: testUser.name },
			expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		};

		// Create test lessons in different states
		draftLesson = await testDb.lesson.create({
			data: {
				title: "Draft Lesson",
				description: "Draft description",
				content: "Draft content",
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

	describe("lesson.publish", () => {
		it("should publish draft lesson successfully", async () => {
			const caller = await createTestCaller(testSession);

			const result = await caller.lesson.publish({ id: draftLesson.id });

			expect(result.isPublished).toBe(true);
			expect(result.isArchived).toBe(false);
			expect(result.status).toBe("published");
			expect(result.publishedAt).toBeInstanceOf(Date);
			expect(result.canPublish).toBe(false);
			expect(result.canArchive).toBe(true);
		});

		it("should reject publishing already published lesson", async () => {
			const caller = await createTestCaller(testSession);

			await expect(
				caller.lesson.publish({ id: publishedLesson.id }),
			).rejects.toThrow("Only draft lessons can be published");
		});

		it("should reject publishing archived lesson", async () => {
			const caller = await createTestCaller(testSession);

			await expect(
				caller.lesson.publish({ id: archivedLesson.id }),
			).rejects.toThrow("Only draft lessons can be published");
		});
	});

	describe("lesson.archive", () => {
		it("should archive published lesson successfully", async () => {
			const caller = await createTestCaller(testSession);

			const result = await caller.lesson.archive({ id: publishedLesson.id });

			expect(result.isPublished).toBe(true); // Remains published
			expect(result.isArchived).toBe(true);
			expect(result.status).toBe("archived");
			expect(result.canEdit).toBe(false);
			expect(result.canArchive).toBe(false);
		});

		it("should reject archiving draft lesson", async () => {
			const caller = await createTestCaller(testSession);

			await expect(
				caller.lesson.archive({ id: draftLesson.id }),
			).rejects.toThrow("Only published lessons can be archived");
		});

		it("should reject archiving already archived lesson", async () => {
			const caller = await createTestCaller(testSession);

			await expect(
				caller.lesson.archive({ id: archivedLesson.id }),
			).rejects.toThrow("Only published lessons can be archived");
		});
	});

	describe("lesson.delete", () => {
		it("should delete lesson with complete discussions option", async () => {
			const caller = await createTestCaller(testSession);

			const result = await caller.lesson.delete({
				id: draftLesson.id,
				handleActiveDiscussions: "complete",
			});

			expect(result.success).toBe(true);
			expect(result.affectedDiscussions).toBe(0); // No discussions in test

			// Verify lesson is deleted
			const deletedLesson = await testDb.lesson.findUnique({
				where: { id: draftLesson.id },
			});
			expect(deletedLesson).toBeNull();
		});

		it("should delete lesson with end discussions option", async () => {
			const caller = await createTestCaller(testSession);

			const result = await caller.lesson.delete({
				id: publishedLesson.id,
				handleActiveDiscussions: "end",
			});

			expect(result.success).toBe(true);
			expect(result.affectedDiscussions).toBe(0);
		});

		it("should throw FORBIDDEN when deleting other user's lesson", async () => {
			const otherSession: Session = {
				user: {
					id: otherUser.id,
					email: otherUser.email,
					name: otherUser.name,
				},
				expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
			};

			const caller = await createTestCaller(otherSession);

			await expect(
				caller.lesson.delete({
					id: draftLesson.id,
					handleActiveDiscussions: "complete",
				}),
			).rejects.toThrow("Access denied");
		});
	});

	describe("lesson.fork", () => {
		it("should fork archived lesson successfully", async () => {
			const caller = await createTestCaller(testSession);

			const result = await caller.lesson.fork({
				id: archivedLesson.id,
				newTitle: "Forked Lesson Title",
			});

			expect(result.title).toBe("Forked Lesson Title");
			expect(result.description).toBe("Archived description"); // Copied
			expect(result.content).toBe("Archived content"); // Copied
			expect(result.isPublished).toBe(false); // New lesson is draft
			expect(result.isArchived).toBe(false);
			expect(result.status).toBe("draft");
			expect(result.creatorId).toBe(testUser.id);
			expect(result.id).not.toBe(archivedLesson.id); // Different ID
		});

		it("should fork archived lesson with default title", async () => {
			const caller = await createTestCaller(testSession);

			const result = await caller.lesson.fork({
				id: archivedLesson.id,
			});

			expect(result.title).toContain("Archived Lesson"); // Should include original title
			expect(result.status).toBe("draft");
		});

		it("should reject forking non-archived lesson", async () => {
			const caller = await createTestCaller(testSession);

			await expect(caller.lesson.fork({ id: draftLesson.id })).rejects.toThrow(
				"Only archived lessons can be forked",
			);

			await expect(
				caller.lesson.fork({ id: publishedLesson.id }),
			).rejects.toThrow("Only archived lessons can be forked");
		});

		it("should reject forking other user's lesson", async () => {
			const otherSession: Session = {
				user: {
					id: otherUser.id,
					email: otherUser.email,
					name: otherUser.name,
				},
				expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
			};

			const caller = await createTestCaller(otherSession);

			await expect(
				caller.lesson.fork({ id: archivedLesson.id }),
			).rejects.toThrow("Access denied");
		});
	});

	describe("authentication and authorization", () => {
		it("should reject all lifecycle operations without authentication", async () => {
			const caller = await createTestCaller(null);

			await expect(
				caller.lesson.publish({ id: draftLesson.id }),
			).rejects.toThrow("UNAUTHORIZED");

			await expect(
				caller.lesson.archive({ id: publishedLesson.id }),
			).rejects.toThrow("UNAUTHORIZED");

			await expect(
				caller.lesson.delete({
					id: draftLesson.id,
					handleActiveDiscussions: "complete",
				}),
			).rejects.toThrow("UNAUTHORIZED");

			await expect(
				caller.lesson.fork({ id: archivedLesson.id }),
			).rejects.toThrow("UNAUTHORIZED");
		});

		it("should reject operations on non-existent lessons", async () => {
			const caller = await createTestCaller(testSession);

			const nonExistentId = "clnon9existent123456789012345"; // Valid CUID format but non-existent

			await expect(
				caller.lesson.publish({ id: nonExistentId }),
			).rejects.toThrow("Lesson not found");

			await expect(
				caller.lesson.archive({ id: nonExistentId }),
			).rejects.toThrow("Lesson not found");

			await expect(
				caller.lesson.delete({
					id: nonExistentId,
					handleActiveDiscussions: "complete",
				}),
			).rejects.toThrow("Lesson not found");

			await expect(caller.lesson.fork({ id: nonExistentId })).rejects.toThrow(
				"Lesson not found",
			);
		});
	});
});
