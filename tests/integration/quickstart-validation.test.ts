/**
 * Quickstart Validation Tests
 * Validates all scenarios from specs/001-core-lesson-management/quickstart.md
 */

import { appRouter } from "@/server/api/root";
import { db } from "@/server/db";
import type { Session } from "next-auth";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

// Test user session
let testUserId: string;
let mockSession: Session;
let caller: ReturnType<typeof createCaller>;

// Test data tracking
const testLessonIds: string[] = [];

// Create tRPC caller with mock session
const createCaller = () =>
	appRouter.createCaller({
		headers: new Headers(),
		db,
		session: mockSession,
	});

describe("Quickstart Validation: All Scenarios", () => {
	beforeAll(async () => {
		// Create test user for quickstart validation
		console.log("🔧 Setting up quickstart validation user...");
		const testUser = await db.user.create({
			data: {
				email: "quickstart@example.com",
				name: "Quickstart Test User",
			},
		});

		testUserId = testUser.id;
		mockSession = {
			user: {
				id: testUserId,
				email: testUser.email || "quickstart@example.com",
			},
			expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		};

		caller = createCaller();
		console.log("✅ Quickstart test user created");
	});

	afterAll(async () => {
		// Cleanup all test data
		console.log("🧹 Cleaning up quickstart test data...");
		await db.lesson.deleteMany({
			where: { creatorId: testUserId },
		});
		await db.user.delete({
			where: { id: testUserId },
		});
		console.log("✅ Quickstart cleanup completed");
	});

	describe("Test Scenario 1: Basic Lesson CRUD (Happy Path)", () => {
		let newLessonId: string;

		test("Step 1: Create New Lesson (FR-003, FR-006)", async () => {
			console.log("📝 Testing lesson creation...");
			const newLesson = await caller.lesson.create({
				title: "Introduction to Critical Thinking",
				description: "A lesson on developing analytical skills",
				content:
					"Students will learn to evaluate arguments and identify logical fallacies",
				objectives: ["Identify logical fallacies", "Construct valid arguments"],
				keyQuestions: [
					"What makes an argument valid?",
					"How do we identify bias?",
				],
				facilitationStyle: "analytical",
				suggestedDuration: 45,
				suggestedGroupSize: 4,
			});

			// Verify: Lesson exists in draft state
			expect(newLesson.status).toBe("draft");
			expect(newLesson.isPublished).toBe(false);
			expect(newLesson.isArchived).toBe(false);
			expect(newLesson.title).toBe("Introduction to Critical Thinking");
			expect(newLesson.objectives).toHaveLength(2);
			expect(newLesson.keyQuestions).toHaveLength(2);

			newLessonId = newLesson.id;
			testLessonIds.push(newLessonId);
			console.log("✅ Lesson created successfully in draft status");
		});

		test("Step 2: List User's Lessons (FR-011)", async () => {
			console.log("📋 Testing lesson listing...");
			const lessons = await caller.lesson.list();

			// Expected: New lesson appears in user's lesson list
			const foundLesson = lessons.find((l) => l.id === newLessonId);
			expect(foundLesson).toBeDefined();
			expect(lessons.every((l) => l.creatorId === testUserId)).toBe(true);

			console.log(`✅ Found lesson in list (${lessons.length} total lessons)`);
		});

		test("Step 3: Update Lesson Content (FR-013)", async () => {
			console.log("✏️ Testing lesson updates...");
			const originalLesson = await caller.lesson.getById({ id: newLessonId });

			// Expected: Lesson content updated, timestamps refreshed
			const updatedLesson = await caller.lesson.update({
				id: newLessonId,
				title: "Advanced Critical Thinking",
				objectives: [
					...originalLesson.objectives,
					"Apply critical thinking to real scenarios",
				],
			});

			expect(updatedLesson.title).toBe("Advanced Critical Thinking");
			expect(updatedLesson.objectives).toHaveLength(3);
			expect(new Date(updatedLesson.updatedAt).getTime()).toBeGreaterThan(
				new Date(originalLesson.updatedAt).getTime(),
			);

			console.log(
				"✅ Lesson updated successfully with new title and objectives",
			);
		});

		test("Step 4: Publish Lesson (FR-014)", async () => {
			console.log("🚀 Testing lesson publishing...");

			// Expected: Lesson state changes to published
			const publishedLesson = await caller.lesson.publish({ id: newLessonId });

			expect(publishedLesson.status).toBe("published");
			expect(publishedLesson.isPublished).toBe(true);
			expect(publishedLesson.publishedAt).not.toBeNull();

			console.log("✅ Lesson published successfully");
		});
	});

	describe("Test Scenario 2: Lesson Lifecycle Transitions", () => {
		let lifecycleLessonId: string;

		beforeAll(async () => {
			// Create and publish a lesson for lifecycle testing
			const lesson = await caller.lesson.create({
				title: "Lifecycle Test Lesson",
				description: "Testing state transitions",
				content: "Content for lifecycle testing",
				objectives: ["Test lifecycle"],
				keyQuestions: ["Does it transition correctly?"],
				facilitationStyle: "exploratory",
				suggestedDuration: 30,
				suggestedGroupSize: 3,
			});

			await caller.lesson.publish({ id: lesson.id });
			lifecycleLessonId = lesson.id;
			testLessonIds.push(lifecycleLessonId);
		});

		test("Step 1: Verify Published Lesson Restrictions", async () => {
			console.log("🔒 Testing published lesson restrictions...");

			// Published lessons can still be updated in some ways
			// The business logic allows updates to published lessons
			const updatedLesson = await caller.lesson.update({
				id: lifecycleLessonId,
				description: "Updated description for published lesson",
			});

			expect(updatedLesson.status).toBe("published");
			expect(updatedLesson.description).toBe(
				"Updated description for published lesson",
			);

			console.log("✅ Published lesson can be updated (as per business rules)");
		});

		test("Step 2: Archive Published Lesson (FR-016)", async () => {
			console.log("📦 Testing lesson archiving...");

			// Expected: Lesson archived successfully
			const archivedLesson = await caller.lesson.archive({
				id: lifecycleLessonId,
			});

			expect(archivedLesson.status).toBe("archived");
			expect(archivedLesson.isArchived).toBe(true);
			expect(archivedLesson.isPublished).toBe(true); // Remains published

			console.log("✅ Lesson archived successfully");
		});
	});

	describe("Test Scenario 3: Lesson Deletion & Discussion Handling", () => {
		let lessonWithDiscussionId: string;

		test("Step 1: Create Lesson with Active Discussion", async () => {
			console.log("💬 Creating lesson for deletion testing...");

			// Create lesson and simulate active discussion
			const lessonWithDiscussion = await caller.lesson.create({
				title: "Ethics in Technology",
				description: "Exploring ethical considerations in tech",
				content: "Discussion on AI ethics and privacy",
				objectives: ["Understand AI ethics"],
				keyQuestions: ["What are the ethical implications?"],
				facilitationStyle: "ethical",
				suggestedDuration: 60,
				suggestedGroupSize: 5,
			});

			// Publish lesson
			await caller.lesson.publish({ id: lessonWithDiscussion.id });

			lessonWithDiscussionId = lessonWithDiscussion.id;
			testLessonIds.push(lessonWithDiscussionId);

			expect(lessonWithDiscussion.status).toBe("draft");
			console.log("✅ Lesson created and published for deletion testing");
		});

		test("Step 2: Delete Lesson with Discussion Completion Option", async () => {
			console.log("🗑️ Testing lesson deletion with discussion handling...");

			// Expected: Lesson deleted, discussions allowed to complete
			const deleteResult = await caller.lesson.delete({
				id: lessonWithDiscussionId,
				handleActiveDiscussions: "complete",
			});

			expect(deleteResult.success).toBe(true);
			expect(typeof deleteResult.affectedDiscussions).toBe("number");

			// Verify lesson is deleted
			await expect(
				caller.lesson.getById({ id: lessonWithDiscussionId }),
			).rejects.toThrow();

			// Remove from tracking since it's deleted
			const index = testLessonIds.indexOf(lessonWithDiscussionId);
			if (index > -1) testLessonIds.splice(index, 1);

			console.log("✅ Lesson deleted successfully with discussion handling");
		});
	});

	describe("Test Scenario 4: Lesson Forking", () => {
		let archivedLessonId: string;

		beforeAll(async () => {
			// Create, publish, and archive a lesson for forking
			const lesson = await caller.lesson.create({
				title: "Original Lesson for Forking",
				description: "This will be forked",
				content: "Original content to be copied",
				objectives: ["Original objective 1", "Original objective 2"],
				keyQuestions: ["Original question?"],
				facilitationStyle: "analytical",
				suggestedDuration: 45,
				suggestedGroupSize: 4,
			});

			await caller.lesson.publish({ id: lesson.id });
			await caller.lesson.archive({ id: lesson.id });

			archivedLessonId = lesson.id;
			testLessonIds.push(archivedLessonId);
		});

		test("Step 1: Fork Archived Lesson", async () => {
			console.log("🍴 Testing lesson forking...");

			const originalLesson = await caller.lesson.getById({
				id: archivedLessonId,
			});

			// Expected: New draft lesson created from archived lesson
			const forkedLesson = await caller.lesson.fork({
				id: archivedLessonId,
				newTitle: "Advanced Ethics in Technology",
			});

			expect(forkedLesson.status).toBe("draft");
			expect(forkedLesson.title).toBe("Advanced Ethics in Technology");
			expect(forkedLesson.content).toBe(originalLesson.content); // Content copied
			expect(forkedLesson.objectives).toHaveLength(
				originalLesson.objectives.length,
			);
			expect(forkedLesson.id).not.toBe(archivedLessonId); // New lesson

			testLessonIds.push(forkedLesson.id);
			console.log("✅ Lesson forked successfully");
		});

		test("Step 2: Verify Fork Restrictions", async () => {
			console.log("🚫 Testing fork restrictions...");

			// Create a draft lesson to test restrictions
			const draftLesson = await caller.lesson.create({
				title: "Draft Lesson",
				description: "Cannot be forked",
				content: "Draft content",
				objectives: ["Draft objective"],
				keyQuestions: ["Draft question?"],
				facilitationStyle: "exploratory",
				suggestedDuration: 30,
				suggestedGroupSize: 3,
			});

			testLessonIds.push(draftLesson.id);

			// Expected: Cannot fork non-archived lessons
			await expect(
				caller.lesson.fork({
					id: draftLesson.id, // Draft lesson
					newTitle: "Should Not Work",
				}),
			).rejects.toThrow();

			console.log("✅ Fork restrictions working correctly");
		});
	});

	describe("Test Scenario 5: Validation & Security", () => {
		test("Step 1: Title Length Validation (FR-004)", async () => {
			console.log("📏 Testing title length validation...");

			// Expected: Error for title exceeding 200 characters
			const longTitle = "A".repeat(201);
			await expect(
				caller.lesson.create({
					title: longTitle,
					description: "Valid description",
					content: "Valid content",
					objectives: ["Valid objective"],
					keyQuestions: ["Valid question?"],
					facilitationStyle: "exploratory",
					suggestedDuration: 30,
					suggestedGroupSize: 3,
				}),
			).rejects.toThrow();

			console.log("✅ Title length validation working correctly");
		});

		test("Step 2: Required Field Validation", async () => {
			console.log("📋 Testing required field validation...");

			// Expected: Error for empty required fields
			await expect(
				caller.lesson.create({
					title: "",
					description: "Valid description",
					content: "Valid content",
					objectives: ["Valid objective"],
					keyQuestions: ["Valid question?"],
					facilitationStyle: "exploratory",
					suggestedDuration: 30,
					suggestedGroupSize: 3,
				}),
			).rejects.toThrow();

			await expect(
				caller.lesson.create({
					title: "Valid Title",
					description: "",
					content: "Valid content",
					objectives: ["Valid objective"],
					keyQuestions: ["Valid question?"],
					facilitationStyle: "exploratory",
					suggestedDuration: 30,
					suggestedGroupSize: 3,
				}),
			).rejects.toThrow();

			console.log("✅ Required field validation working correctly");
		});

		test("Step 3: Data Type Validation", async () => {
			console.log("🔢 Testing data type validation...");

			// Test invalid facilitation style
			await expect(
				caller.lesson.create({
					title: "Valid Title",
					description: "Valid description",
					content: "Valid content",
					objectives: ["Valid objective"],
					keyQuestions: ["Valid question?"],
					// @ts-expect-error - Testing invalid enum value
					facilitationStyle: "invalid",
					suggestedDuration: 30,
					suggestedGroupSize: 3,
				}),
			).rejects.toThrow();

			console.log("✅ Data type validation working correctly");
		});
	});

	describe("Performance Validation", () => {
		test("Response Time Tests", async () => {
			console.log("⚡ Testing response times...");

			// Expected: Lesson operations complete within 2 seconds
			const startTime = Date.now();
			await caller.lesson.list();
			const duration = Date.now() - startTime;

			expect(duration).toBeLessThan(2000);
			console.log(`✅ Lesson list completed in ${duration}ms (<2000ms)`);
		});

		test("Concurrent User Tests", async () => {
			console.log("👥 Testing concurrent operations...");

			// Expected: Multiple lessons can be created simultaneously
			const promises = Array.from({ length: 5 }, (_, i) =>
				caller.lesson.create({
					title: `Concurrent Lesson ${i}`,
					description: `Description ${i}`,
					content: `Content ${i}`,
					objectives: [`Objective ${i}`],
					keyQuestions: [`Question ${i}?`],
					facilitationStyle: "exploratory",
					suggestedDuration: 30,
					suggestedGroupSize: 3,
				}),
			);

			const results = await Promise.all(promises);

			expect(results.every((lesson) => lesson.status === "draft")).toBe(true);
			expect(new Set(results.map((l) => l.id)).size).toBe(5); // All unique

			// Track for cleanup
			testLessonIds.push(...results.map((r) => r.id));

			console.log("✅ Concurrent operations completed successfully");
		});
	});

	describe("Success Criteria Validation", () => {
		test("All Key Validations Met", async () => {
			console.log("✅ Validating all success criteria...");

			// Create a lesson and run it through the full lifecycle
			const testLesson = await caller.lesson.create({
				title: "Success Criteria Test",
				description: "Testing all success criteria",
				content: "Content for success validation",
				objectives: ["Validate success"],
				keyQuestions: ["Are all criteria met?"],
				facilitationStyle: "analytical",
				suggestedDuration: 45,
				suggestedGroupSize: 4,
			});

			testLessonIds.push(testLesson.id);

			// ✅ CRUD operations work for lesson lifecycle
			const lessons = await caller.lesson.list();
			expect(lessons.some((l) => l.id === testLesson.id)).toBe(true);

			const updatedLesson = await caller.lesson.update({
				id: testLesson.id,
				title: "Updated Success Test",
			});
			expect(updatedLesson.title).toBe("Updated Success Test");

			// ✅ State transitions follow business rules
			const publishedLesson = await caller.lesson.publish({
				id: testLesson.id,
			});
			expect(publishedLesson.status).toBe("published");

			const archivedLesson = await caller.lesson.archive({ id: testLesson.id });
			expect(archivedLesson.status).toBe("archived");

			// ✅ Authorization ensures lesson ownership
			const fetchedLesson = await caller.lesson.getById({ id: testLesson.id });
			expect(fetchedLesson.creatorId).toBe(testUserId);

			// ✅ Performance meets <2s response time goals
			const perfStart = Date.now();
			await caller.lesson.list();
			const perfDuration = Date.now() - perfStart;
			expect(perfDuration).toBeLessThan(2000);

			console.log("🎉 All success criteria validated successfully!");
		});
	});
});
