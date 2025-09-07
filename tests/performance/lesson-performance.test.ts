/**
 * Performance tests for lesson management endpoints
 * Requirement: All lesson operations must complete in <2s
 */

import { appRouter } from "@/server/api/root";
import { db } from "@/server/db";
import type { Session } from "next-auth";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

// Test user that will be created for performance testing
let testUserId: string;
let mockSession: Session;

// Create tRPC caller with mock session
const createCaller = () =>
	appRouter.createCaller({
		headers: new Headers(),
		db,
		session: mockSession,
	});

describe("Lesson Performance Tests", () => {
	let caller: ReturnType<typeof createCaller>;
	let testLessonIds: string[] = [];

	beforeAll(async () => {
		// Create a test user for performance testing
		console.log("🔧 Setting up performance test user...");
		const testUser = await db.user.create({
			data: {
				email: "perf-test@example.com",
				name: "Performance Test User",
			},
		});

		testUserId = testUser.id;
		mockSession = {
			user: { id: testUserId, email: testUser.email || "test@example.com" },
			expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		};

		caller = createCaller();

		// Create test data for performance testing
		console.log("🔧 Setting up performance test data...");

		// Create 50 lessons for realistic performance testing
		const promises = Array.from({ length: 50 }, (_, i) =>
			caller.lesson.create({
				title: `Performance Test Lesson ${i + 1}`,
				description: `Description for performance test lesson ${i + 1}`,
				content: `This is test content for lesson ${i + 1}. `.repeat(10), // ~500 chars
				objectives: [
					`Objective 1 for lesson ${i + 1}`,
					`Objective 2 for lesson ${i + 1}`,
				],
				keyQuestions: [
					`Question 1 for lesson ${i + 1}?`,
					`Question 2 for lesson ${i + 1}?`,
				],
				facilitationStyle:
					i % 3 === 0 ? "exploratory" : i % 3 === 1 ? "analytical" : "ethical",
				suggestedDuration: 45 + (i % 4) * 15, // 45, 60, 75, 90 minutes
				suggestedGroupSize: 3 + (i % 5), // 3-7 people
			}),
		);

		const lessons = await Promise.all(promises);
		testLessonIds = lessons.map((lesson) => lesson.id);
		console.log(`✅ Created ${testLessonIds.length} test lessons`);
	});

	afterAll(async () => {
		// Cleanup test data
		console.log("🧹 Cleaning up performance test data...");
		await db.lesson.deleteMany({
			where: {
				creatorId: testUserId,
			},
		});

		// Clean up test user
		await db.user.delete({
			where: {
				id: testUserId,
			},
		});
		console.log("✅ Cleanup completed");
	});

	describe("CREATE Performance", () => {
		test("lesson.create should complete in <2s", async () => {
			const startTime = performance.now();

			const lesson = await caller.lesson.create({
				title: "Performance Test Create Lesson",
				description: "Testing create performance",
				content: "Content for performance testing".repeat(20),
				objectives: ["Learn performance testing", "Optimize database queries"],
				keyQuestions: ["How fast is our API?", "What can we optimize?"],
				facilitationStyle: "analytical",
				suggestedDuration: 60,
				suggestedGroupSize: 4,
			});

			const endTime = performance.now();
			const duration = endTime - startTime;

			console.log(`📊 lesson.create took ${duration.toFixed(2)}ms`);

			expect(lesson).toBeDefined();
			expect(lesson.title).toBe("Performance Test Create Lesson");
			expect(duration).toBeLessThan(2000); // <2s requirement

			// Cleanup
			await caller.lesson.delete({
				id: lesson.id,
				handleActiveDiscussions: "complete",
			});
		});
	});

	describe("READ Performance", () => {
		test("lesson.list should complete in <2s with 50+ lessons", async () => {
			const startTime = performance.now();

			const lessons = await caller.lesson.list();

			const endTime = performance.now();
			const duration = endTime - startTime;

			console.log(
				`📊 lesson.list (${lessons.length} lessons) took ${duration.toFixed(2)}ms`,
			);

			expect(lessons).toBeDefined();
			expect(lessons.length).toBeGreaterThanOrEqual(50);
			expect(duration).toBeLessThan(2000); // <2s requirement
		});

		test("lesson.getById should complete in <2s", async () => {
			const testLessonId = testLessonIds[0]!;
			const startTime = performance.now();

			const lesson = await caller.lesson.getById({ id: testLessonId });

			const endTime = performance.now();
			const duration = endTime - startTime;

			console.log(`📊 lesson.getById took ${duration.toFixed(2)}ms`);

			expect(lesson).toBeDefined();
			expect(lesson.id).toBe(testLessonId);
			expect(duration).toBeLessThan(2000); // <2s requirement
		});
	});

	describe("UPDATE Performance", () => {
		test("lesson.update should complete in <2s", async () => {
			const testLessonId = testLessonIds[1]!;
			const startTime = performance.now();

			const updatedLesson = await caller.lesson.update({
				id: testLessonId,
				title: "Updated Performance Test Lesson",
				description: "Updated description for performance testing",
			});

			const endTime = performance.now();
			const duration = endTime - startTime;

			console.log(`📊 lesson.update took ${duration.toFixed(2)}ms`);

			expect(updatedLesson).toBeDefined();
			expect(updatedLesson.title).toBe("Updated Performance Test Lesson");
			expect(duration).toBeLessThan(2000); // <2s requirement
		});
	});

	describe("LIFECYCLE Performance", () => {
		test("lesson.publish should complete in <2s", async () => {
			const testLessonId = testLessonIds[2]!;
			const startTime = performance.now();

			const publishedLesson = await caller.lesson.publish({ id: testLessonId });

			const endTime = performance.now();
			const duration = endTime - startTime;

			console.log(`📊 lesson.publish took ${duration.toFixed(2)}ms`);

			expect(publishedLesson).toBeDefined();
			expect(publishedLesson.status).toBe("published");
			expect(duration).toBeLessThan(2000); // <2s requirement
		});

		test("lesson.archive should complete in <2s", async () => {
			const testLessonId = testLessonIds[2]!; // Use the published lesson
			const startTime = performance.now();

			const archivedLesson = await caller.lesson.archive({ id: testLessonId });

			const endTime = performance.now();
			const duration = endTime - startTime;

			console.log(`📊 lesson.archive took ${duration.toFixed(2)}ms`);

			expect(archivedLesson).toBeDefined();
			expect(archivedLesson.status).toBe("archived");
			expect(duration).toBeLessThan(2000); // <2s requirement
		});

		test("lesson.fork should complete in <2s", async () => {
			const testLessonId = testLessonIds[2]!; // Use the archived lesson
			const startTime = performance.now();

			const forkedLesson = await caller.lesson.fork({
				id: testLessonId,
				newTitle: "Forked Performance Test Lesson",
			});

			const endTime = performance.now();
			const duration = endTime - startTime;

			console.log(`📊 lesson.fork took ${duration.toFixed(2)}ms`);

			expect(forkedLesson).toBeDefined();
			expect(forkedLesson.title).toContain("Performance Test Lesson");
			expect(forkedLesson.status).toBe("draft");
			expect(duration).toBeLessThan(2000); // <2s requirement

			// Cleanup
			await caller.lesson.delete({
				id: forkedLesson.id,
				handleActiveDiscussions: "complete",
			});
		});
	});

	describe("DELETE Performance", () => {
		test("lesson.delete should complete in <2s", async () => {
			// Create a lesson specifically for deletion test
			const lessonToDelete = await caller.lesson.create({
				title: "Lesson to Delete",
				description: "This lesson will be deleted",
				content: "Delete test content",
				objectives: ["Test deletion"],
				keyQuestions: ["Will this be deleted quickly?"],
				facilitationStyle: "exploratory",
				suggestedDuration: 30,
				suggestedGroupSize: 3,
			});

			const startTime = performance.now();

			await caller.lesson.delete({
				id: lessonToDelete.id,
				handleActiveDiscussions: "complete",
			});

			const endTime = performance.now();
			const duration = endTime - startTime;

			console.log(`📊 lesson.delete took ${duration.toFixed(2)}ms`);

			expect(duration).toBeLessThan(2000); // <2s requirement

			// Verify deletion
			await expect(
				caller.lesson.getById({ id: lessonToDelete.id }),
			).rejects.toThrow();
		});
	});

	describe("Bulk Operations Performance", () => {
		test("Multiple concurrent lesson.getById should complete in <2s each", async () => {
			const concurrentRequests = testLessonIds
				.slice(0, 5)
				.map(async (id, index) => {
					const startTime = performance.now();
					const lesson = await caller.lesson.getById({ id });
					const endTime = performance.now();
					const duration = endTime - startTime;

					console.log(
						`📊 Concurrent lesson.getById #${index + 1} took ${duration.toFixed(2)}ms`,
					);

					expect(lesson).toBeDefined();
					expect(duration).toBeLessThan(2000);

					return { lesson, duration };
				});

			const results = await Promise.all(concurrentRequests);

			// Check that all concurrent requests completed successfully
			expect(results).toHaveLength(5);
			results.forEach((result) => {
				expect(result.duration).toBeLessThan(2000);
			});
		});

		test("lesson.list performance with different scenarios", async () => {
			// Test list performance multiple times to check consistency
			const iterations = 5;
			const durations: number[] = [];

			for (let i = 0; i < iterations; i++) {
				const startTime = performance.now();
				const lessons = await caller.lesson.list();
				const endTime = performance.now();
				const duration = endTime - startTime;

				durations.push(duration);
				console.log(
					`📊 lesson.list iteration ${i + 1} took ${duration.toFixed(2)}ms (${lessons.length} lessons)`,
				);

				expect(duration).toBeLessThan(2000);
			}

			const avgDuration =
				durations.reduce((a, b) => a + b, 0) / durations.length;
			const maxDuration = Math.max(...durations);

			console.log(
				`📊 lesson.list average: ${avgDuration.toFixed(2)}ms, max: ${maxDuration.toFixed(2)}ms`,
			);

			expect(avgDuration).toBeLessThan(1000); // Average should be well under 2s
			expect(maxDuration).toBeLessThan(2000); // Max should meet requirement
		});
	});

	describe("Performance Summary", () => {
		test("Generate performance report", async () => {
			console.log("\n🎯 LESSON MANAGEMENT PERFORMANCE REPORT");
			console.log("=====================================");

			// Test all major operations once more for final report
			const operations = [
				{
					name: "CREATE",
					test: () =>
						caller.lesson.create({
							title: "Final Performance Test",
							description: "Final test",
							content: "Final content",
							objectives: ["Final objective"],
							keyQuestions: ["Final question?"],
							facilitationStyle: "analytical" as const,
							suggestedDuration: 45,
							suggestedGroupSize: 3,
						}),
				},
				{
					name: "LIST",
					test: () => caller.lesson.list(),
				},
				{
					name: "GET_BY_ID",
					test: () => caller.lesson.getById({ id: testLessonIds[0]! }),
				},
				{
					name: "UPDATE",
					test: () =>
						caller.lesson.update({
							id: testLessonIds[3]!,
							title: "Performance Report Update",
						}),
				},
			];

			const results: Array<{
				name: string;
				duration: number;
				success: boolean;
			}> = [];

			for (const operation of operations) {
				try {
					const startTime = performance.now();
					await operation.test();
					const endTime = performance.now();
					const duration = endTime - startTime;

					results.push({
						name: operation.name,
						duration,
						success: duration < 2000,
					});

					console.log(
						`✅ ${operation.name}: ${duration.toFixed(2)}ms ${duration < 2000 ? "(PASS)" : "(FAIL)"}`,
					);
				} catch (error) {
					console.log(`❌ ${operation.name}: FAILED - ${error}`);
					results.push({ name: operation.name, duration: 0, success: false });
				}
			}

			const allPassed = results.every((r) => r.success);
			const avgDuration =
				results.reduce((sum, r) => sum + r.duration, 0) / results.length;

			console.log(`\n📊 Average Response Time: ${avgDuration.toFixed(2)}ms`);
			console.log(
				`🎯 Performance Goal (<2000ms): ${allPassed ? "ACHIEVED ✅" : "NOT MET ❌"}`,
			);
			console.log("=====================================\n");

			// Assert that all operations meet performance requirements
			expect(allPassed).toBe(true);
			expect(avgDuration).toBeLessThan(1000); // Average should be well under the limit
		});
	});
});
