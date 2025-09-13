import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	cleanupDatabase,
	createTestLesson,
	createTestUser,
	testDb,
} from "../db-setup";

/**
 * Contract tests for POST /api/discussion/[id]/chat endpoint
 *
 * This endpoint is compatible with Vercel AI SDK useChat hook and implements
 * the streaming protocol for real-time participant messaging.
 *
 * These tests MUST FAIL initially since the endpoint doesn't exist yet.
 * They define the expected API contract for the participant view feature.
 */
describe("POST /api/discussion/[id]/chat - Contract Tests", () => {
	let testUser: Awaited<ReturnType<typeof createTestUser>>;
	let testLesson: Awaited<ReturnType<typeof createTestLesson>>;
	let discussion: { id: string };
	let participant: { id: string; displayName: string; sessionId: string };
	const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

	beforeEach(async () => {
		await cleanupDatabase();
		testUser = await createTestUser();
		testLesson = await createTestLesson(testUser.id);

		// Create test discussion directly with database
		discussion = await testDb.discussion.create({
			data: {
				lessonId: testLesson.id,
				creatorId: testUser.id,
				name: "Test Discussion",
				description: "Contract test discussion",
				maxParticipants: 5,
				isPublic: true,
			},
		});

		// Create test participant in database for session mismatch tests
		const participantData = {
			id: `part_${Date.now()}_${Math.random().toString(36).substring(7)}`,
			discussionId: discussion.id,
			displayName: "Test Participant",
			sessionId: `session_${Date.now()}_${Math.random().toString(36).substring(7)}`,
			joinedAt: new Date(),
		};
		
		await testDb.participant.create({
			data: participantData,
		});
		
		participant = {
			id: participantData.id,
			displayName: participantData.displayName,
			sessionId: participantData.sessionId,
		};
	});

	afterEach(async () => {
		await cleanupDatabase();
	});

	describe("Request/Response Contract", () => {
		it("should accept valid chat request with AI SDK format", async () => {
			const requestBody = {
				// AI SDK useChat format
				messages: [
					{
						id: `msg_${Date.now()}`,
						role: "user" as const,
						parts: [
							{
								type: "text" as const,
								text: "Hello everyone! This is my first message.",
							},
						],
						metadata: {
							participantId: participant.id,
							senderName: participant.displayName,
							timestamp: new Date().toISOString(),
						},
					},
				],
				// Custom fields for participant validation
				participantId: participant.id,
				discussionId: discussion.id,
				sessionId: participant.sessionId,
			};

			const response = await fetch(
				`${baseUrl}/api/discussion/${discussion.id}/chat`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(requestBody),
				},
			);

			// Contract expectation: 200 OK with streaming response
			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toContain("text/plain");
			expect(response.headers.get("transfer-encoding")).toBe("chunked");

			// Should return streaming response body
			expect(response.body).toBeTruthy();

			// Verify streaming format matches AI SDK expectations
			const reader = response.body?.getReader();
			if (reader) {
				const { value } = await reader.read();
				if (value) {
					const chunk = new TextDecoder().decode(value);
					expect(chunk).toMatch(/^0:/); // AI SDK format starts with "0:"
					expect(chunk).toContain('"type":"message"');
					expect(chunk).toContain('"role":"user"');
				}
			}
		});

		it("should reject request with invalid discussion ID", async () => {
			const requestBody = {
				messages: [
					{
						id: "test-msg",
						role: "user" as const,
						parts: [{ type: "text" as const, text: "Hello" }],
					},
				],
				participantId: participant.id,
				discussionId: "invalid-discussion-id",
				sessionId: participant.sessionId,
			};

			const response = await fetch(
				`${baseUrl}/api/discussion/invalid-discussion-id/chat`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(requestBody),
				},
			);

			// Contract expectation: 404 Not Found
			expect(response.status).toBe(404);
		});

		it("should reject request with invalid participant ID", async () => {
			const requestBody = {
				messages: [
					{
						id: "test-msg",
						role: "user" as const,
						parts: [{ type: "text" as const, text: "Hello" }],
					},
				],
				participantId: "invalid-participant-id",
				discussionId: discussion.id,
				sessionId: participant.sessionId,
			};

			const response = await fetch(
				`${baseUrl}/api/discussion/${discussion.id}/chat`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(requestBody),
				},
			);

			// Contract expectation: 400 Bad Request
			expect(response.status).toBe(400);
		});

		it("should reject request with mismatched session ID", async () => {
			const requestBody = {
				messages: [
					{
						id: "test-msg",
						role: "user" as const,
						parts: [{ type: "text" as const, text: "Hello" }],
					},
				],
				participantId: participant.id,
				discussionId: discussion.id,
				sessionId: "mismatched-session-id",
			};

			const response = await fetch(
				`${baseUrl}/api/discussion/${discussion.id}/chat`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(requestBody),
				},
			);

			// Contract expectation: 403 Forbidden
			expect(response.status).toBe(403);
		});

		it("should reject request when discussion is closed", async () => {
			// Update discussion to inactive (closed)
			await testDb.discussion.update({
				where: { id: discussion.id },
				data: { isActive: false },
			});

			const requestBody = {
				messages: [
					{
						id: "test-msg",
						role: "user" as const,
						parts: [{ type: "text" as const, text: "Hello" }],
					},
				],
				participantId: participant.id,
				discussionId: discussion.id,
				sessionId: participant.sessionId,
			};

			const response = await fetch(
				`${baseUrl}/api/discussion/${discussion.id}/chat`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(requestBody),
				},
			);

			// Contract expectation: 403 Forbidden
			expect(response.status).toBe(403);
		});
	});

	describe("Message Validation Contract", () => {
		it("should reject empty messages", async () => {
			const requestBody = {
				messages: [
					{
						id: "test-msg",
						role: "user" as const,
						parts: [{ type: "text" as const, text: "" }],
					},
				],
				participantId: participant.id,
				discussionId: discussion.id,
				sessionId: participant.sessionId,
			};

			const response = await fetch(
				`${baseUrl}/api/discussion/${discussion.id}/chat`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(requestBody),
				},
			);

			// Contract expectation: 400 Bad Request
			expect(response.status).toBe(400);
		});

		it("should reject messages over 5000 characters", async () => {
			const longMessage = "x".repeat(5001);
			const requestBody = {
				messages: [
					{
						id: "test-msg",
						role: "user" as const,
						parts: [{ type: "text" as const, text: longMessage }],
					},
				],
				participantId: participant.id,
				discussionId: discussion.id,
				sessionId: participant.sessionId,
			};

			const response = await fetch(
				`${baseUrl}/api/discussion/${discussion.id}/chat`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(requestBody),
				},
			);

			// Contract expectation: 400 Bad Request
			expect(response.status).toBe(400);
		});

		it("should accept messages exactly at 5000 character limit", async () => {
			const maxMessage = "x".repeat(5000);
			const requestBody = {
				messages: [
					{
						id: "test-msg",
						role: "user" as const,
						parts: [{ type: "text" as const, text: maxMessage }],
					},
				],
				participantId: participant.id,
				discussionId: discussion.id,
				sessionId: participant.sessionId,
			};

			const response = await fetch(
				`${baseUrl}/api/discussion/${discussion.id}/chat`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(requestBody),
				},
			);

			// Contract expectation: 200 OK
			expect(response.status).toBe(200);
		});

		it("should reject malformed message structure", async () => {
			const requestBody = {
				messages: [
					{
						// Missing required id field
						role: "user" as const,
						parts: [{ type: "text" as const, text: "Hello" }],
					},
				],
				participantId: participant.id,
				discussionId: discussion.id,
				sessionId: participant.sessionId,
			};

			const response = await fetch(
				`${baseUrl}/api/discussion/${discussion.id}/chat`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(requestBody),
				},
			);

			// Contract expectation: 400 Bad Request
			expect(response.status).toBe(400);
		});

		it("should reject missing required fields", async () => {
			const requestBody = {
				messages: [
					{
						id: "test-msg",
						role: "user" as const,
						parts: [{ type: "text" as const, text: "Hello" }],
					},
				],
				// Missing participantId field
				discussionId: discussion.id,
				sessionId: participant.sessionId,
			};

			const response = await fetch(
				`${baseUrl}/api/discussion/${discussion.id}/chat`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(requestBody),
				},
			);

			// Contract expectation: 400 Bad Request
			expect(response.status).toBe(400);
		});
	});

	describe("Streaming Response Contract", () => {
		it("should return proper streaming format for message broadcast", async () => {
			const requestBody = {
				messages: [
					{
						id: "test-msg-broadcast",
						role: "user" as const,
						parts: [
							{ type: "text" as const, text: "Broadcasting this message!" },
						],
						metadata: {
							participantId: participant.id,
							senderName: participant.displayName,
							timestamp: new Date().toISOString(),
						},
					},
				],
				participantId: participant.id,
				discussionId: discussion.id,
				sessionId: participant.sessionId,
			};

			const response = await fetch(
				`${baseUrl}/api/discussion/${discussion.id}/chat`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(requestBody),
				},
			);

			expect(response.status).toBe(200);

			// Verify streaming response contains expected data structure
			const reader = response.body?.getReader();
			if (reader) {
				const chunks: string[] = [];
				let done = false;

				while (!done) {
					const { value, done: streamDone } = await reader.read();
					done = streamDone;
					if (value) {
						chunks.push(new TextDecoder().decode(value));
					}
				}

				const fullResponse = chunks.join("");

				// Should contain AI SDK format message
				expect(fullResponse).toContain('"type":"message"');
				expect(fullResponse).toContain('"id":"test-msg-broadcast"');
				expect(fullResponse).toContain('"role":"user"');
				expect(fullResponse).toContain("Broadcasting this message!");

				// Should contain broadcast notification
				expect(fullResponse).toContain(
					'"type":"participant_message_broadcast"',
				);
				expect(fullResponse).toContain(`"discussionId":"${discussion.id}"`);
			}
		});

		it("should handle multiple messages in conversation", async () => {
			const requestBody = {
				messages: [
					{
						id: "msg-1",
						role: "user" as const,
						parts: [{ type: "text" as const, text: "First message" }],
						metadata: {
							participantId: "other-participant",
							senderName: "Other User",
							timestamp: new Date(Date.now() - 60000).toISOString(),
						},
					},
					{
						id: "msg-2",
						role: "user" as const,
						parts: [{ type: "text" as const, text: "My response message" }],
						metadata: {
							participantId: participant.id,
							senderName: participant.displayName,
							timestamp: new Date().toISOString(),
						},
					},
				],
				participantId: participant.id,
				discussionId: discussion.id,
				sessionId: participant.sessionId,
			};

			const response = await fetch(
				`${baseUrl}/api/discussion/${discussion.id}/chat`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(requestBody),
				},
			);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toContain("text/plain");
		});
	});

	describe("HTTP Methods Contract", () => {
		it("should reject GET requests", async () => {
			const response = await fetch(
				`${baseUrl}/api/discussion/${discussion.id}/chat`,
				{
					method: "GET",
				},
			);

			// Contract expectation: 405 Method Not Allowed
			expect(response.status).toBe(405);
		});

		it("should reject PUT requests", async () => {
			const response = await fetch(
				`${baseUrl}/api/discussion/${discussion.id}/chat`,
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({}),
				},
			);

			// Contract expectation: 405 Method Not Allowed
			expect(response.status).toBe(405);
		});

		it("should reject DELETE requests", async () => {
			const response = await fetch(
				`${baseUrl}/api/discussion/${discussion.id}/chat`,
				{
					method: "DELETE",
				},
			);

			// Contract expectation: 405 Method Not Allowed
			expect(response.status).toBe(405);
		});
	});

	describe("Content-Type Contract", () => {
		it("should reject requests without Content-Type header", async () => {
			const requestBody = {
				messages: [
					{
						id: "test-msg",
						role: "user" as const,
						parts: [{ type: "text" as const, text: "Hello" }],
					},
				],
				participantId: participant.id,
				discussionId: discussion.id,
				sessionId: participant.sessionId,
			};

			const response = await fetch(
				`${baseUrl}/api/discussion/${discussion.id}/chat`,
				{
					method: "POST",
					// No Content-Type header
					body: JSON.stringify(requestBody),
				},
			);

			// Contract expectation: 400 Bad Request
			expect(response.status).toBe(400);
		});

		it("should reject requests with wrong Content-Type", async () => {
			const response = await fetch(
				`${baseUrl}/api/discussion/${discussion.id}/chat`,
				{
					method: "POST",
					headers: {
						"Content-Type": "text/plain",
					},
					body: "not json",
				},
			);

			// Contract expectation: 400 Bad Request
			expect(response.status).toBe(400);
		});

		it("should reject malformed JSON", async () => {
			const response = await fetch(
				`${baseUrl}/api/discussion/${discussion.id}/chat`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: "{ invalid json }",
				},
			);

			// Contract expectation: 400 Bad Request
			expect(response.status).toBe(400);
		});
	});
});
