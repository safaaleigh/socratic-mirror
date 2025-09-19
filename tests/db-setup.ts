import { PrismaClient } from "@prisma/client";
import type { Session } from "next-auth";
import { afterAll, beforeAll } from "vitest";

export const testDb = new PrismaClient({
	datasourceUrl: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
});

beforeAll(async () => {
	// Connect to test database
	await testDb.$connect();
});

afterAll(async () => {
	// Clean up test database connection
	await testDb.$disconnect();
});

export async function cleanupDatabase() {
	// Clean up test data in reverse dependency order
	// Start with dependent tables first
	await testDb.message.deleteMany();
	await testDb.discussionParticipant.deleteMany();
	await testDb.discussion.deleteMany();
	await testDb.groupMember.deleteMany();
	await testDb.group.deleteMany();

	// Delete lessons before users (foreign key constraint)
	await testDb.lesson.deleteMany();

	// Clean up auth-related tables
	await testDb.invitation.deleteMany();
	await testDb.session.deleteMany();
	await testDb.account.deleteMany();
	await testDb.authenticator.deleteMany();

	// Finally delete users
	await testDb.user.deleteMany();
}

export async function createTestUser() {
	const randomId = Math.random().toString(36).substring(7);
	return await testDb.user.create({
		data: {
			email: `test-${Date.now()}-${randomId}@example.com`,
			name: `Test User ${randomId}`,
		},
	});
}

// Create test context that matches production tRPC context
function createTestContext(session?: Session | null) {
	return {
		db: testDb,
		session: session || null,
		headers: new Headers(),
	};
}

// Helper to create tRPC caller with test context
export async function createTestCaller(session?: Session | null) {
	// Use dynamic imports to avoid circular imports
	const { createCallerFactory } = await import("@/server/api/trpc");
	const { appRouter } = await import("@/server/api/root");

	const ctx = createTestContext(session);
	return createCallerFactory(appRouter)(ctx);
}

// Helper to create a test lesson
export async function createTestLesson(userId: string) {
	return await testDb.lesson.create({
		data: {
			title: "Test Lesson",
			description: "Test lesson description",
			content: "Test lesson content",
			objectives: ["Test objective 1", "Test objective 2"],
			keyQuestions: ["Test question 1", "Test question 2"],
			facilitationStyle: "analytical",
			suggestedDuration: 45,
			suggestedGroupSize: 4,
			isPublished: true,
			isArchived: false,
			creatorId: userId,
		},
	});
}
