import type { Session } from "next-auth";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanupDatabase, createTestCaller, createTestUser } from "../db-setup";

describe("lesson.create tRPC procedure", () => {
	let testUser: Awaited<ReturnType<typeof createTestUser>>;
	let testSession: Session;

	beforeEach(async () => {
		await cleanupDatabase();
		testUser = await createTestUser();
		testSession = {
			user: { id: testUser.id, email: testUser.email, name: testUser.name },
			expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		};
	});

	afterEach(async () => {
		await cleanupDatabase();
	});

	it("should create a new lesson with valid input", async () => {
		const caller = await createTestCaller(testSession);

		const lessonInput = {
			title: "Introduction to Critical Thinking",
			description: "A lesson on developing analytical skills",
			content:
				"Students will learn to evaluate arguments and identify logical fallacies",
			objectives: ["Identify logical fallacies", "Construct valid arguments"],
			keyQuestions: [
				"What makes an argument valid?",
				"How do we identify bias?",
			],
			facilitationStyle: "analytical" as const,
			suggestedDuration: 45,
			suggestedGroupSize: 4,
		};

		const result = await caller.lesson.create(lessonInput);

		expect(result).toEqual({
			id: expect.any(String),
			title: lessonInput.title,
			description: lessonInput.description,
			content: lessonInput.content,
			objectives: lessonInput.objectives,
			keyQuestions: lessonInput.keyQuestions,
			facilitationStyle: lessonInput.facilitationStyle,
			suggestedDuration: lessonInput.suggestedDuration,
			suggestedGroupSize: lessonInput.suggestedGroupSize,
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

	it("should reject lesson creation without authentication", async () => {
		const caller = await createTestCaller(null);

		const lessonInput = {
			title: "Test Lesson",
			description: "Test description",
			content: "Test content",
		};

		await expect(caller.lesson.create(lessonInput)).rejects.toThrow(
			"UNAUTHORIZED",
		);
	});

	it("should reject lesson with title exceeding 200 characters", async () => {
		const caller = await createTestCaller(testSession);

		const lessonInput = {
			title: "A".repeat(201), // Exceeds 200 character limit
			description: "Valid description",
			content: "Valid content",
		};

		await expect(caller.lesson.create(lessonInput)).rejects.toThrow(
			"Title must not exceed 200 characters",
		);
	});

	it("should reject lesson with empty description", async () => {
		const caller = await createTestCaller(testSession);

		const lessonInput = {
			title: "Valid Title",
			description: "", // Empty description
			content: "Valid content",
		};

		await expect(caller.lesson.create(lessonInput)).rejects.toThrow(
			"Description is required",
		);
	});

	it("should create lesson with default values for optional fields", async () => {
		const caller = await createTestCaller(testSession);

		const lessonInput = {
			title: "Minimal Lesson",
			description: "Minimal description",
			content: "Minimal content",
		};

		const result = await caller.lesson.create(lessonInput);

		expect(result.objectives).toEqual([]);
		expect(result.keyQuestions).toEqual([]);
		expect(result.facilitationStyle).toBe("exploratory");
		expect(result.suggestedGroupSize).toBe(3);
		expect(result.suggestedDuration).toBeNull();
	});
});
