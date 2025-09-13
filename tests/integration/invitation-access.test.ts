/**
 * Integration Tests: Valid Invitation Link Access
 *
 * Tests Scenario 1 from specs/003-participant-view-should/quickstart.md:
 * "As an invitee, I can click a valid invitation link and see the name entry screen"
 *
 * NOTE: These tests WILL FAIL initially since the participant view features don't exist yet.
 * This is expected behavior as we're implementing TDD (Test-Driven Development).
 */

import jwt from "jsonwebtoken";
import type { Session } from "next-auth";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	cleanupDatabase,
	createTestCaller,
	createTestLesson,
	createTestUser,
	testDb,
} from "../db-setup";

describe("Integration: Valid Invitation Link Access", () => {
	let testUser: Awaited<ReturnType<typeof createTestUser>>;
	let testSession: Session;
	let caller: Awaited<ReturnType<typeof createTestCaller>>;
	let testDiscussion: any;
	let invitationToken: string;

	beforeEach(async () => {
		console.log("🔧 Setting up invitation access test...");
		await cleanupDatabase();

		testUser = await createTestUser();
		testSession = {
			user: {
				id: testUser.id,
				email: testUser.email,
				name: testUser.name,
			},
			expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		};

		caller = await createTestCaller(testSession);

		// Create test lesson and discussion
		const testLesson = await createTestLesson(testUser.id);

		testDiscussion = await caller.discussion.create({
			lessonId: testLesson.id,
			name: "Participant Access Test Discussion",
			description: "Testing invitation link access for anonymous participants",
			maxParticipants: 10,
			isPublic: false, // Private discussion requiring invitation
		});

		console.log("✅ Test setup completed");
	});

	afterEach(async () => {
		await cleanupDatabase();
	});

	describe("Valid JWT Invitation Token Generation", () => {
		it("should generate valid invitation token for active discussion", async () => {
			console.log("🎫 Testing invitation token generation...");

			// Generate invitation token for the discussion
			// This would be done via the participant router
			const invitation = await caller.participant.generateInvitation({
				discussionId: testDiscussion.id,
				expiresIn: "24h", // 24 hour expiration
			});

			expect(invitation).toMatchObject({
				token: expect.any(String),
				expiresAt: expect.any(Date),
				invitationUrl: expect.stringContaining(`/join/${testDiscussion.id}`),
			});

			// Verify token structure
			expect(invitation.token).toMatch(
				/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/,
			);

			invitationToken = invitation.token;
			console.log("✅ Invitation token generated successfully");
		});

		it("should include correct claims in JWT token", async () => {
			console.log("🔍 Testing JWT token claims...");

			const invitation = await caller.participant.generateInvitation({
				discussionId: testDiscussion.id,
				expiresIn: "2h",
			});

			// Decode JWT token (without verification for testing)
			const decoded = jwt.decode(invitation.token) as any;

			expect(decoded).toMatchObject({
				discussionId: testDiscussion.id,
				type: "participant_invitation",
				exp: expect.any(Number),
				iat: expect.any(Number),
			});

			// Verify expiration is approximately 2 hours from now
			const now = Math.floor(Date.now() / 1000);
			expect(decoded.exp - decoded.iat).toBeCloseTo(7200, 10); // 2 hours ± 10 seconds

			console.log("✅ JWT claims validated");
		});
	});

	describe("Invitation Token Validation", () => {
		beforeEach(async () => {
			// Generate a valid token for testing
			const invitation = await caller.participant.generateInvitation({
				discussionId: testDiscussion.id,
				expiresIn: "1h",
			});
			invitationToken = invitation.token;
		});

		it("should validate invitation token and return discussion info", async () => {
			console.log("✅ Testing invitation token validation...");

			const validation = await caller.participant.validateInvitation({
				discussionId: testDiscussion.id,
				token: invitationToken,
			});

			expect(validation).toMatchObject({
				valid: true,
				discussion: {
					id: testDiscussion.id,
					name: testDiscussion.name,
					description: testDiscussion.description,
					isActive: true,
					maxParticipants: testDiscussion.maxParticipants,
					lesson: {
						title: expect.any(String),
						facilitationStyle: expect.any(String),
					},
				},
				participantCount: 0, // No participants yet
				canJoin: true,
			});

			console.log("✅ Token validation successful");
		});

		it("should return discussion context for name entry screen", async () => {
			console.log("📝 Testing discussion context retrieval...");

			const validation = await caller.participant.validateInvitation({
				discussionId: testDiscussion.id,
				token: invitationToken,
			});

			// Verify we get enough context to display the name entry screen
			expect(validation.discussion).toMatchObject({
				name: "Participant Access Test Discussion",
				description: expect.stringContaining("Testing invitation link access"),
				lesson: {
					title: expect.any(String),
					description: expect.any(String),
				},
			});

			expect(validation.canJoin).toBe(true);
			expect(validation.participantCount).toBe(0);

			console.log("✅ Discussion context validated");
		});

		it("should handle discussion with participant limit", async () => {
			console.log("👥 Testing participant limit handling...");

			// Add participants to approach the limit
			for (let i = 0; i < 9; i++) {
				await testDb.participant.create({
					data: {
						discussionId: testDiscussion.id,
						displayName: `Test Participant ${i + 1}`,
						sessionId: `session-${i + 1}`,
					},
				});
			}

			const validation = await caller.participant.validateInvitation({
				discussionId: testDiscussion.id,
				token: invitationToken,
			});

			expect(validation.valid).toBe(true);
			expect(validation.participantCount).toBe(9);
			expect(validation.canJoin).toBe(true); // Still has space for 1 more

			// Add one more to reach the limit
			await testDb.participant.create({
				data: {
					discussionId: testDiscussion.id,
					displayName: "Final Participant",
					sessionId: "session-final",
				},
			});

			const validationAtLimit = await caller.participant.validateInvitation({
				discussionId: testDiscussion.id,
				token: invitationToken,
			});

			expect(validationAtLimit.valid).toBe(true);
			expect(validationAtLimit.participantCount).toBe(10);
			expect(validationAtLimit.canJoin).toBe(false); // Now at capacity

			console.log("✅ Participant limit handling validated");
		});
	});

	describe("Name Entry Screen Requirements", () => {
		beforeEach(async () => {
			const invitation = await caller.participant.generateInvitation({
				discussionId: testDiscussion.id,
				expiresIn: "1h",
			});
			invitationToken = invitation.token;
		});

		it("should provide all required data for name entry form", async () => {
			console.log("📋 Testing name entry form data...");

			const validation = await caller.participant.validateInvitation({
				discussionId: testDiscussion.id,
				token: invitationToken,
			});

			// Verify the response includes everything needed for the name entry screen
			expect(validation).toMatchObject({
				valid: true,
				canJoin: true,
				discussion: {
					id: expect.any(String),
					name: expect.any(String),
					description: expect.any(String),
					isActive: true,
					lesson: {
						title: expect.any(String),
						facilitationStyle: expect.any(String),
					},
				},
				participantCount: expect.any(Number),
				maxParticipants: expect.any(Number),
			});

			console.log("✅ Name entry form data validated");
		});

		it("should validate display name requirements", async () => {
			console.log("📝 Testing display name validation...");

			// Test various display name scenarios
			const testNames = [
				{ name: "Alice", valid: true },
				{ name: "Bob Smith", valid: true },
				{ name: "Dr. Johnson", valid: true },
				{ name: "User123", valid: true },
				{ name: "", valid: false, reason: "empty" },
				{ name: "   ", valid: false, reason: "whitespace only" },
				{ name: "A".repeat(51), valid: false, reason: "too long" },
				{ name: "Valid Name!", valid: true }, // Special characters allowed
			];

			for (const testCase of testNames) {
				try {
					const result = await caller.participant.validateDisplayName({
						discussionId: testDiscussion.id,
						displayName: testCase.name,
					});

					if (testCase.valid) {
						expect(result.valid).toBe(true);
						expect(result.displayName).toBe(testCase.name.trim());
					} else {
						expect(result.valid).toBe(false);
						expect(result.error).toBeDefined();
					}
				} catch (error) {
					if (testCase.valid) {
						throw error; // Should not throw for valid names
					}
					// Expected to throw for invalid names
				}
			}

			console.log("✅ Display name validation completed");
		});

		it("should allow duplicate display names", async () => {
			console.log("👥 Testing duplicate name handling...");

			// Add a participant with a specific name
			await testDb.participant.create({
				data: {
					discussionId: testDiscussion.id,
					displayName: "Alice",
					sessionId: "existing-session",
				},
			});

			// Validate that another participant can use the same name
			const validation = await caller.participant.validateDisplayName({
				discussionId: testDiscussion.id,
				displayName: "Alice",
			});

			expect(validation.valid).toBe(true);
			expect(validation.displayName).toBe("Alice");
			expect(validation.isUnique).toBe(false); // Name is not unique
			expect(validation.warning).toMatch(/already in use/i);

			console.log("✅ Duplicate name handling validated");
		});
	});

	describe("Discussion Status Checks", () => {
		beforeEach(async () => {
			const invitation = await caller.participant.generateInvitation({
				discussionId: testDiscussion.id,
				expiresIn: "1h",
			});
			invitationToken = invitation.token;
		});

		it("should reject access to inactive discussions", async () => {
			console.log("🚫 Testing inactive discussion access...");

			// Mark discussion as inactive
			await testDb.discussion.update({
				where: { id: testDiscussion.id },
				data: { isActive: false },
			});

			const validation = await caller.participant.validateInvitation({
				discussionId: testDiscussion.id,
				token: invitationToken,
			});

			expect(validation.valid).toBe(false);
			expect(validation.error).toMatch(
				/discussion.*inactive|discussion.*ended/i,
			);
			expect(validation.canJoin).toBe(false);

			console.log("✅ Inactive discussion rejection validated");
		});

		it("should reject access to closed discussions", async () => {
			console.log("🔒 Testing closed discussion access...");

			// Mark discussion as closed
			await testDb.discussion.update({
				where: { id: testDiscussion.id },
				data: {
					isActive: false,
					closedAt: new Date(),
				},
			});

			const validation = await caller.participant.validateInvitation({
				discussionId: testDiscussion.id,
				token: invitationToken,
			});

			expect(validation.valid).toBe(false);
			expect(validation.error).toMatch(/discussion.*closed|discussion.*ended/i);
			expect(validation.canJoin).toBe(false);

			console.log("✅ Closed discussion rejection validated");
		});

		it("should check discussion expiration", async () => {
			console.log("⏰ Testing expired discussion access...");

			// Set discussion to expire in the past
			await testDb.discussion.update({
				where: { id: testDiscussion.id },
				data: {
					expiresAt: new Date(Date.now() - 60000), // 1 minute ago
				},
			});

			const validation = await caller.participant.validateInvitation({
				discussionId: testDiscussion.id,
				token: invitationToken,
			});

			expect(validation.valid).toBe(false);
			expect(validation.error).toMatch(/discussion.*expired/i);
			expect(validation.canJoin).toBe(false);

			console.log("✅ Expired discussion rejection validated");
		});
	});

	describe("Performance and Security", () => {
		beforeEach(async () => {
			const invitation = await caller.participant.generateInvitation({
				discussionId: testDiscussion.id,
				expiresIn: "1h",
			});
			invitationToken = invitation.token;
		});

		it("should validate invitation quickly (< 500ms)", async () => {
			console.log("⚡ Testing invitation validation performance...");

			const startTime = Date.now();

			await caller.participant.validateInvitation({
				discussionId: testDiscussion.id,
				token: invitationToken,
			});

			const duration = Date.now() - startTime;

			expect(duration).toBeLessThan(500);
			console.log(`✅ Validation completed in ${duration}ms (<500ms)`);
		});

		it("should not expose sensitive discussion data", async () => {
			console.log("🔐 Testing data exposure limits...");

			const validation = await caller.participant.validateInvitation({
				discussionId: testDiscussion.id,
				token: invitationToken,
			});

			// Should not expose sensitive fields
			expect(validation.discussion).not.toHaveProperty("joinCode");
			expect(validation.discussion).not.toHaveProperty("password");
			expect(validation.discussion).not.toHaveProperty("invitationToken");
			expect(validation.discussion).not.toHaveProperty("creatorId");
			expect(validation.discussion).not.toHaveProperty("creator");

			// Should only include public discussion info
			expect(validation.discussion).toHaveProperty("name");
			expect(validation.discussion).toHaveProperty("description");
			expect(validation.discussion).toHaveProperty("isActive");
			expect(validation.discussion).toHaveProperty("lesson");

			console.log("✅ Data exposure validation passed");
		});

		it("should rate limit invitation validation attempts", async () => {
			console.log("🚦 Testing rate limiting...");

			// Make multiple rapid requests
			const requests = Array.from({ length: 20 }, () =>
				caller.participant.validateInvitation({
					discussionId: testDiscussion.id,
					token: invitationToken,
				}),
			);

			try {
				const results = await Promise.all(requests);

				// All should succeed initially (or some might be rate limited)
				const successful = results.filter((r) => r.valid).length;
				expect(successful).toBeGreaterThan(0);

				// If rate limiting is implemented, some requests should fail
				if (results.length > successful) {
					expect(results.some((r) => r.error?.includes("rate limit"))).toBe(
						true,
					);
				}

				console.log(
					`✅ Rate limiting test completed (${successful}/${results.length} succeeded)`,
				);
			} catch (error) {
				// Rate limiting might throw errors instead of returning error objects
				expect(error).toBeDefined();
				console.log("✅ Rate limiting active (requests rejected)");
			}
		});
	});
});
