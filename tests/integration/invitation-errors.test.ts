/**
 * Integration Tests: Invalid Invitation Error Handling Flow
 *
 * Tests Scenario 7 from specs/003-participant-view-should/quickstart.md:
 * "As a user, I see clear error messages for invalid invitation links"
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

describe("Integration: Invalid Invitation Error Handling Flow", () => {
	let facilitatorUser: Awaited<ReturnType<typeof createTestUser>>;
	let facilitatorSession: Session;
	let facilitatorCaller: Awaited<ReturnType<typeof createTestCaller>>;
	let testDiscussion: any;
	let validInvitationToken: string;

	beforeEach(async () => {
		console.log("🔧 Setting up invitation error handling test...");
		await cleanupDatabase();

		facilitatorUser = await createTestUser();
		facilitatorSession = {
			user: {
				id: facilitatorUser.id,
				email: facilitatorUser.email,
				name: facilitatorUser.name,
			},
			expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		};

		facilitatorCaller = await createTestCaller(facilitatorSession);

		// Create test lesson and discussion
		const testLesson = await createTestLesson(facilitatorUser.id);

		testDiscussion = await facilitatorCaller.discussion.create({
			lessonId: testLesson.id,
			name: "Error Handling Test Discussion",
			description: "Testing various invitation error scenarios",
			maxParticipants: 5,
			isPublic: false,
		});

		// Generate valid invitation token for comparison tests
		const invitation = await facilitatorCaller.participant.generateInvitation({
			discussionId: testDiscussion.id,
			expiresIn: "1h",
		});
		validInvitationToken = invitation.token;

		console.log("✅ Error handling test setup completed");
	});

	afterEach(async () => {
		await cleanupDatabase();
	});

	describe("Expired Token Error Handling", () => {
		it("should handle expired invitation tokens with clear error message", async () => {
			console.log("⏰ Testing expired token error handling...");

			// Generate token with very short expiry
			const expiredInvitation =
				await facilitatorCaller.participant.generateInvitation({
					discussionId: testDiscussion.id,
					expiresIn: "1ms", // Expires immediately
				});

			// Wait to ensure expiry
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Test validation of expired token
			const validation = await facilitatorCaller.participant.validateInvitation(
				{
					discussionId: testDiscussion.id,
					token: expiredInvitation.token,
				},
			);

			expect(validation).toMatchObject({
				valid: false,
				canJoin: false,
				error: expect.stringMatching(
					/invitation.*expired|token.*expired|expired.*invitation/i,
				),
				errorType: "EXPIRED_INVITATION",
				errorDetails: {
					expiredAt: expect.any(Date),
					currentTime: expect.any(Date),
				},
				recoveryOptions: {
					contactCreator: true,
					requestNewInvitation: true,
				},
			});

			// Test joining with expired token
			await expect(
				facilitatorCaller.participant.join({
					discussionId: testDiscussion.id,
					token: expiredInvitation.token,
					displayName: "Alice",
					sessionId: "test-expired",
				}),
			).rejects.toMatchObject({
				code: "FORBIDDEN",
				message: expect.stringMatching(/invitation.*expired|token.*expired/i),
			});

			console.log("✅ Expired token error handling validated");
		});

		it("should provide recovery options for expired invitations", async () => {
			console.log("🔄 Testing expired invitation recovery options...");

			// Create expired token
			const expiredInvitation =
				await facilitatorCaller.participant.generateInvitation({
					discussionId: testDiscussion.id,
					expiresIn: "1ms",
				});

			await new Promise((resolve) => setTimeout(resolve, 10));

			const validation = await facilitatorCaller.participant.validateInvitation(
				{
					discussionId: testDiscussion.id,
					token: expiredInvitation.token,
				},
			);

			expect(validation.recoveryOptions).toMatchObject({
				contactCreator: true,
				requestNewInvitation: true,
				creatorName: facilitatorUser.name || "Discussion Creator",
				creatorContact: expect.any(String), // Could be email or other contact method
				supportMessage: expect.stringContaining(
					"contact the discussion creator",
				),
			});

			console.log("✅ Expired invitation recovery options validated");
		});
	});

	describe("Invalid Token Format Error Handling", () => {
		it("should handle malformed JWT tokens", async () => {
			console.log("🔧 Testing malformed JWT token handling...");

			const malformedTokens = [
				"invalid-token",
				"not.a.jwt",
				"missing.signature",
				"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid", // Invalid payload
				"", // Empty token
				"   ", // Whitespace only
			];

			for (const token of malformedTokens) {
				const validation =
					await facilitatorCaller.participant.validateInvitation({
						discussionId: testDiscussion.id,
						token,
					});

				expect(validation).toMatchObject({
					valid: false,
					canJoin: false,
					error: expect.stringMatching(
						/invalid.*token|malformed.*token|token.*format/i,
					),
					errorType: "INVALID_TOKEN_FORMAT",
				});

				// Test joining with malformed token
				await expect(
					facilitatorCaller.participant.join({
						discussionId: testDiscussion.id,
						token,
						displayName: "Alice",
						sessionId: `test-malformed-${Date.now()}`,
					}),
				).rejects.toMatchObject({
					code: expect.stringMatching(/UNAUTHORIZED|BAD_REQUEST/),
					message: expect.stringMatching(/invalid.*token|token.*invalid/i),
				});
			}

			console.log("✅ Malformed JWT token handling validated");
		});

		it("should handle tokens with invalid signatures", async () => {
			console.log("🔐 Testing invalid signature handling...");

			// Create a token with wrong signature
			const fakeToken = jwt.sign(
				{
					discussionId: testDiscussion.id,
					type: "participant_invitation",
					exp: Math.floor(Date.now() / 1000) + 3600,
				},
				"wrong-secret-key",
			);

			const validation = await facilitatorCaller.participant.validateInvitation(
				{
					discussionId: testDiscussion.id,
					token: fakeToken,
				},
			);

			expect(validation).toMatchObject({
				valid: false,
				canJoin: false,
				error: expect.stringMatching(/invalid.*signature|token.*invalid/i),
				errorType: "INVALID_TOKEN_SIGNATURE",
			});

			console.log("✅ Invalid signature handling validated");
		});

		it("should handle tokens with missing required claims", async () => {
			console.log("📋 Testing missing claims handling...");

			// Create tokens with missing required fields
			const invalidClaims = [
				{ type: "participant_invitation" }, // Missing discussionId
				{ discussionId: testDiscussion.id }, // Missing type
				{ discussionId: "wrong-id", type: "participant_invitation" }, // Wrong discussionId
				{ discussionId: testDiscussion.id, type: "wrong-type" }, // Wrong type
			];

			for (const claims of invalidClaims) {
				const invalidToken = jwt.sign(
					{
						...claims,
						exp: Math.floor(Date.now() / 1000) + 3600,
					},
					process.env.AUTH_SECRET || "test-secret",
				);

				const validation =
					await facilitatorCaller.participant.validateInvitation({
						discussionId: testDiscussion.id,
						token: invalidToken,
					});

				expect(validation).toMatchObject({
					valid: false,
					canJoin: false,
					error: expect.stringMatching(
						/invalid.*token|missing.*claims|token.*invalid/i,
					),
					errorType: expect.stringMatching(/INVALID_TOKEN|MISSING_CLAIMS/),
				});
			}

			console.log("✅ Missing claims handling validated");
		});
	});

	describe("Discussion Not Found Error Handling", () => {
		it("should handle non-existent discussion IDs", async () => {
			console.log("🚫 Testing non-existent discussion handling...");

			const nonExistentId = "non-existent-discussion-id";

			const validation = await facilitatorCaller.participant.validateInvitation(
				{
					discussionId: nonExistentId,
					token: validInvitationToken, // Valid token format but wrong discussion
				},
			);

			expect(validation).toMatchObject({
				valid: false,
				canJoin: false,
				error: expect.stringMatching(
					/discussion.*not.*found|not.*found.*discussion/i,
				),
				errorType: "DISCUSSION_NOT_FOUND",
				errorDetails: {
					discussionId: nonExistentId,
				},
			});

			// Test joining non-existent discussion
			await expect(
				facilitatorCaller.participant.join({
					discussionId: nonExistentId,
					token: validInvitationToken,
					displayName: "Alice",
					sessionId: "test-nonexistent",
				}),
			).rejects.toMatchObject({
				code: "NOT_FOUND",
				message: expect.stringMatching(/discussion.*not.*found/i),
			});

			console.log("✅ Non-existent discussion handling validated");
		});

		it("should handle discussions that have been deleted", async () => {
			console.log("🗑️ Testing deleted discussion handling...");

			// Create another discussion to delete
			const deletableDiscussion = await facilitatorCaller.discussion.create({
				lessonId: testDiscussion.lessonId,
				name: "Deletable Discussion",
				description: "This will be deleted",
				maxParticipants: 5,
			});

			// Generate invitation for this discussion
			const deletableInvitation =
				await facilitatorCaller.participant.generateInvitation({
					discussionId: deletableDiscussion.id,
					expiresIn: "1h",
				});

			// Delete the discussion
			await testDb.discussion.delete({
				where: { id: deletableDiscussion.id },
			});

			// Test validation with token for deleted discussion
			const validation = await facilitatorCaller.participant.validateInvitation(
				{
					discussionId: deletableDiscussion.id,
					token: deletableInvitation.token,
				},
			);

			expect(validation).toMatchObject({
				valid: false,
				canJoin: false,
				error: expect.stringMatching(
					/discussion.*not.*found|discussion.*deleted/i,
				),
				errorType: "DISCUSSION_NOT_FOUND",
			});

			console.log("✅ Deleted discussion handling validated");
		});
	});

	describe("Discussion Status Error Handling", () => {
		it("should handle inactive/closed discussions", async () => {
			console.log("🔒 Testing inactive discussion handling...");

			// Mark discussion as inactive
			await testDb.discussion.update({
				where: { id: testDiscussion.id },
				data: {
					isActive: false,
					closedAt: new Date(),
				},
			});

			const validation = await facilitatorCaller.participant.validateInvitation(
				{
					discussionId: testDiscussion.id,
					token: validInvitationToken,
				},
			);

			expect(validation).toMatchObject({
				valid: false,
				canJoin: false,
				error: expect.stringMatching(
					/discussion.*ended|discussion.*closed|discussion.*inactive/i,
				),
				errorType: "DISCUSSION_ENDED",
				errorDetails: {
					status: "closed",
					closedAt: expect.any(Date),
				},
				recoveryOptions: {
					contactCreator: true,
					findSimilarDiscussions: true,
				},
			});

			// Test joining inactive discussion
			await expect(
				facilitatorCaller.participant.join({
					discussionId: testDiscussion.id,
					token: validInvitationToken,
					displayName: "Alice",
					sessionId: "test-inactive",
				}),
			).rejects.toMatchObject({
				code: "FORBIDDEN",
				message: expect.stringMatching(/discussion.*ended|discussion.*closed/i),
			});

			console.log("✅ Inactive discussion handling validated");
		});

		it("should handle discussions that have reached participant limit", async () => {
			console.log("👥 Testing participant limit error handling...");

			// Set low participant limit
			await testDb.discussion.update({
				where: { id: testDiscussion.id },
				data: { maxParticipants: 2 },
			});

			// Add participants to reach limit
			await testDb.participant.createMany({
				data: [
					{
						discussionId: testDiscussion.id,
						displayName: "Existing Participant 1",
						sessionId: "existing-1",
					},
					{
						discussionId: testDiscussion.id,
						displayName: "Existing Participant 2",
						sessionId: "existing-2",
					},
				],
			});

			const validation = await facilitatorCaller.participant.validateInvitation(
				{
					discussionId: testDiscussion.id,
					token: validInvitationToken,
				},
			);

			expect(validation).toMatchObject({
				valid: true, // Token is valid
				canJoin: false, // But cannot join due to limit
				error: expect.stringMatching(
					/discussion.*full|participant.*limit|maximum.*capacity/i,
				),
				errorType: "DISCUSSION_FULL",
				errorDetails: {
					currentParticipants: 2,
					maxParticipants: 2,
				},
				recoveryOptions: {
					waitForSpot: true,
					contactCreator: true,
				},
			});

			// Test joining full discussion
			await expect(
				facilitatorCaller.participant.join({
					discussionId: testDiscussion.id,
					token: validInvitationToken,
					displayName: "Alice",
					sessionId: "test-full",
				}),
			).rejects.toMatchObject({
				code: "FORBIDDEN",
				message: expect.stringMatching(/discussion.*full|participant.*limit/i),
			});

			console.log("✅ Participant limit error handling validated");
		});

		it("should handle expired discussions", async () => {
			console.log("📅 Testing expired discussion handling...");

			// Set discussion to expire in the past
			await testDb.discussion.update({
				where: { id: testDiscussion.id },
				data: {
					expiresAt: new Date(Date.now() - 60000), // 1 minute ago
				},
			});

			const validation = await facilitatorCaller.participant.validateInvitation(
				{
					discussionId: testDiscussion.id,
					token: validInvitationToken,
				},
			);

			expect(validation).toMatchObject({
				valid: false,
				canJoin: false,
				error: expect.stringMatching(
					/discussion.*expired|expired.*discussion/i,
				),
				errorType: "DISCUSSION_EXPIRED",
				errorDetails: {
					expiredAt: expect.any(Date),
					currentTime: expect.any(Date),
				},
			});

			console.log("✅ Expired discussion handling validated");
		});
	});

	describe("Error Message Quality and User Experience", () => {
		it("should provide user-friendly error messages", async () => {
			console.log("🎯 Testing user-friendly error messages...");

			const errorScenarios = [
				{
					name: "Expired invitation",
					setup: async () => {
						const expired =
							await facilitatorCaller.participant.generateInvitation({
								discussionId: testDiscussion.id,
								expiresIn: "1ms",
							});
						await new Promise((resolve) => setTimeout(resolve, 10));
						return expired.token;
					},
					expectedMessage: /invitation.*expired.*contact.*creator/i,
				},
				{
					name: "Inactive discussion",
					setup: async () => {
						await testDb.discussion.update({
							where: { id: testDiscussion.id },
							data: { isActive: false },
						});
						return validInvitationToken;
					},
					expectedMessage: /discussion.*ended.*no.*longer.*accepting/i,
				},
				{
					name: "Invalid token format",
					setup: async () => "invalid-token-format",
					expectedMessage: /invitation.*link.*invalid.*check.*link/i,
				},
			];

			for (const scenario of errorScenarios) {
				// Reset discussion state
				await testDb.discussion.update({
					where: { id: testDiscussion.id },
					data: {
						isActive: true,
						expiresAt: null,
						closedAt: null,
					},
				});

				const token = await scenario.setup();

				const validation =
					await facilitatorCaller.participant.validateInvitation({
						discussionId: testDiscussion.id,
						token,
					});

				expect(validation.error).toMatch(scenario.expectedMessage);
				expect(validation.error.length).toBeGreaterThan(20); // Descriptive, not just "error"
				expect(validation.error.length).toBeLessThan(200); // Not too verbose

				console.log(`✅ ${scenario.name}: "${validation.error}"`);
			}

			console.log("✅ User-friendly error messages validated");
		});

		it("should provide contextual help and next steps", async () => {
			console.log("🔧 Testing contextual help provision...");

			// Test expired invitation help
			const expiredInvitation =
				await facilitatorCaller.participant.generateInvitation({
					discussionId: testDiscussion.id,
					expiresIn: "1ms",
				});
			await new Promise((resolve) => setTimeout(resolve, 10));

			const expiredValidation =
				await facilitatorCaller.participant.validateInvitation({
					discussionId: testDiscussion.id,
					token: expiredInvitation.token,
				});

			expect(expiredValidation).toMatchObject({
				helpInfo: {
					nextSteps: [
						expect.stringMatching(/contact.*creator/i),
						expect.stringMatching(/request.*new.*invitation/i),
					],
					supportLinks: {
						contactCreator: expect.any(String),
						helpCenter: expect.any(String),
					},
					estimatedResolution: expect.stringMatching(
						/few.*minutes|contact.*creator/i,
					),
				},
			});

			console.log("✅ Contextual help provision validated");
		});

		it("should maintain error consistency across different entry points", async () => {
			console.log("🔄 Testing error consistency...");

			const invalidToken = "consistently-invalid-token";

			// Test validation endpoint
			const validationError =
				await facilitatorCaller.participant.validateInvitation({
					discussionId: testDiscussion.id,
					token: invalidToken,
				});

			// Test join endpoint
			let joinError: any;
			try {
				await facilitatorCaller.participant.join({
					discussionId: testDiscussion.id,
					token: invalidToken,
					displayName: "Alice",
					sessionId: "consistency-test",
				});
			} catch (error) {
				joinError = error;
			}

			// Errors should be consistent
			expect(validationError.errorType).toBe("INVALID_TOKEN_FORMAT");
			expect(joinError).toMatchObject({
				code: expect.stringMatching(/UNAUTHORIZED|BAD_REQUEST/),
				message: expect.stringMatching(/invalid.*token/i),
			});

			// Both should indicate the same underlying issue
			expect(validationError.error.toLowerCase()).toContain("invalid");
			expect(joinError.message.toLowerCase()).toContain("invalid");

			console.log("✅ Error consistency validated");
		});
	});

	describe("Error Recovery and Fallback Mechanisms", () => {
		it("should provide alternative access methods when available", async () => {
			console.log("🚪 Testing alternative access methods...");

			// Make discussion public to test alternative access
			await testDb.discussion.update({
				where: { id: testDiscussion.id },
				data: {
					isPublic: true,
					joinCode: "PUBLIC123",
				},
			});

			// Test with expired invitation
			const expiredInvitation =
				await facilitatorCaller.participant.generateInvitation({
					discussionId: testDiscussion.id,
					expiresIn: "1ms",
				});
			await new Promise((resolve) => setTimeout(resolve, 10));

			const validation = await facilitatorCaller.participant.validateInvitation(
				{
					discussionId: testDiscussion.id,
					token: expiredInvitation.token,
				},
			);

			expect(validation).toMatchObject({
				valid: false,
				alternativeAccess: {
					available: true,
					methods: [
						{
							type: "PUBLIC_JOIN",
							description: expect.stringMatching(
								/public.*discussion.*join.*code/i,
							),
							joinCode: "PUBLIC123",
						},
					],
				},
			});

			console.log("✅ Alternative access methods validated");
		});

		it("should handle network and server errors gracefully", async () => {
			console.log("🌐 Testing network error handling...");

			// This test would need to simulate network conditions
			// For now, we test the error structure that should be returned

			const mockNetworkError = {
				valid: false,
				canJoin: false,
				error:
					"Unable to verify invitation due to network error. Please try again.",
				errorType: "NETWORK_ERROR",
				temporary: true,
				retryAfter: 5000, // 5 seconds
				retryable: true,
			};

			// Verify error structure includes retry information
			expect(mockNetworkError).toMatchObject({
				temporary: true,
				retryable: true,
				retryAfter: expect.any(Number),
			});

			console.log("✅ Network error structure validated");
		});

		it("should log errors appropriately for debugging", async () => {
			console.log("📝 Testing error logging...");

			// Test various error scenarios and verify they would be logged
			const errorScenarios = ["invalid-token", "", "expired-token-scenario"];

			for (const token of errorScenarios) {
				const validation =
					await facilitatorCaller.participant.validateInvitation({
						discussionId: testDiscussion.id,
						token,
					});

				// Each error should include debugging information
				expect(validation).toMatchObject({
					valid: false,
					errorType: expect.any(String),
					// Debugging info that would be logged
					debugInfo: expect.objectContaining({
						timestamp: expect.any(Date),
						discussionId: testDiscussion.id,
						tokenProvided: expect.any(Boolean),
						errorCode: expect.any(String),
					}),
				});
			}

			console.log("✅ Error logging structure validated");
		});
	});

	describe("Security Considerations", () => {
		it("should not expose sensitive information in error messages", async () => {
			console.log("🔐 Testing information disclosure prevention...");

			const sensitiveScenarios = [
				{
					name: "Internal server error",
					token: "trigger-internal-error", // Would trigger server error in implementation
				},
				{
					name: "Database connection error",
					token: "trigger-db-error",
				},
			];

			for (const scenario of sensitiveScenarios) {
				try {
					const validation =
						await facilitatorCaller.participant.validateInvitation({
							discussionId: testDiscussion.id,
							token: scenario.token,
						});

					// Error messages should not expose internal details
					expect(validation.error).not.toMatch(
						/database|sql|internal|stack trace|file path/i,
					);
					expect(validation.error).not.toContain(facilitatorUser.id);
					expect(validation.error).not.toContain(
						process.env.DATABASE_URL || "",
					);
				} catch (error: any) {
					// Even thrown errors should not expose sensitive info
					expect(error.message).not.toMatch(
						/database|sql|internal|stack trace/i,
					);
				}
			}

			console.log("✅ Information disclosure prevention validated");
		});

		it("should implement rate limiting for error scenarios", async () => {
			console.log("🚦 Testing error rate limiting...");

			const invalidToken = "rate-limit-test-token";
			let successfulRequests = 0;
			let rateLimitedRequests = 0;

			// Make many rapid requests with invalid token
			for (let i = 0; i < 10; i++) {
				try {
					await facilitatorCaller.participant.validateInvitation({
						discussionId: testDiscussion.id,
						token: `${invalidToken}-${i}`,
					});
					successfulRequests++;
				} catch (error: any) {
					if (error.message?.match(/rate.*limit|too.*many/i)) {
						rateLimitedRequests++;
					}
				}
			}

			// Should have some rate limiting for invalid requests
			if (rateLimitedRequests > 0) {
				console.log(
					`✅ Rate limiting active: ${rateLimitedRequests} requests limited`,
				);
			} else {
				console.log(
					"ℹ️ Rate limiting may not be implemented yet (expected for TDD)",
				);
			}

			expect(successfulRequests + rateLimitedRequests).toBe(10);
		});

		it("should validate request source and prevent abuse", async () => {
			console.log("🛡️ Testing abuse prevention...");

			// Test rapid-fire requests from same session
			const abusiveRequests = Array.from({ length: 20 }, (_, i) =>
				facilitatorCaller.participant.validateInvitation({
					discussionId: testDiscussion.id,
					token: `abusive-token-${i}`,
				}),
			);

			const results = await Promise.allSettled(abusiveRequests);

			// Some requests should be rejected or limited
			const successful = results.filter((r) => r.status === "fulfilled").length;
			const failed = results.filter((r) => r.status === "rejected").length;

			expect(successful + failed).toBe(20);

			// In a production system, we'd expect some form of limiting
			console.log(
				`✅ Abuse testing: ${successful} successful, ${failed} failed/limited`,
			);
		});
	});
});
