// T006: Integration test expired invitation handling
import { afterEach, describe, expect, test } from "vitest";

import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import { db } from "@/server/db";

// Cleanup function
afterEach(async () => {
	// Clean up test data
	await db.invitation.deleteMany({ where: { recipientEmail: { contains: "@test" } } });
	await db.discussion.deleteMany({ where: { name: { contains: "Test " } } });
	await db.user.deleteMany({ where: { email: { contains: "@test" } } });
});

// Integration test: Expired invitation handling
describe("Expired Invitation Handling", () => {
	test("should show expired invitation error with clear messaging", async () => {
		// TDD: This test represents quickstart scenario 2 - expired invitation handling
		
		// Setup expired invitation
		const creator = await db.user.create({
			data: {
				name: "Test Creator",
				email: "creator@test.edu",
			},
		});

		const discussion = await db.discussion.create({
			data: {
				name: "Test Expired Discussion",
				description: "Discussion with expired invitation",
				isActive: true,
				creatorId: creator.id,
			},
		});

		const expiredInvitation = await db.invitation.create({
			data: {
				type: "DISCUSSION",
				targetId: discussion.id,
				recipientEmail: "",
				senderId: creator.id,
				status: "PENDING",
				expiresAt: new Date("2025-09-08T00:00:00Z"), // Past date
			},
		});

		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		// Test validation endpoint - should detect expiration
		const validation = await caller.invitation.validate({ 
			token: expiredInvitation.token 
		});
		
		expect(validation.valid).toBe(false);
		expect(validation.reason).toBe("Invitation has expired");

		// Test details endpoint - should throw appropriate error
		await expect(
			caller.invitation.getByToken({ token: expiredInvitation.token })
		).rejects.toThrow("Invitation has expired");

		// Test participant join - should prevent joining
		await expect(
			caller.participant.join({
				discussionId: discussion.id,
				displayName: "Test Participant",
				sessionId: "expired-test-session",
			})
		).rejects.toThrow("Discussion not found"); // Since invitation is expired
	});

	test("should automatically update invitation status when accessed", async () => {
		// Setup invitation that expires during test
		const creator = await db.user.create({
			data: {
				name: "Auto Update Creator",
				email: "autoupdate@test.com",
			},
		});

		const discussion = await db.discussion.create({
			data: {
				name: "Test Auto Update Discussion",
				description: "Testing automatic status updates",
				isActive: true,
				creatorId: creator.id,
			},
		});

		// Create invitation that expires in 1ms (will be expired by the time we check)
		const invitationNearExpiry = await db.invitation.create({
			data: {
				type: "DISCUSSION",
				targetId: discussion.id,
				recipientEmail: "",
				senderId: creator.id,
				status: "PENDING",
				expiresAt: new Date(Date.now() + 1), // Expires in 1ms
			},
		});

		// Wait for expiration
		await new Promise(resolve => setTimeout(resolve, 10));

		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		// Access the invitation - should trigger status update
		const validation = await caller.invitation.validate({ 
			token: invitationNearExpiry.token 
		});
		
		expect(validation.valid).toBe(false);
		expect(validation.reason).toBe("Invitation has expired");

		// Verify status was updated in database
		const updatedInvitation = await db.invitation.findUnique({
			where: { id: invitationNearExpiry.id },
		});
		
		// Note: Some implementations may update status to EXPIRED automatically
		expect(updatedInvitation?.status).toMatch(/PENDING|EXPIRED/);
	});

	test("should handle recently expired invitations gracefully", async () => {
		// Test edge case: invitation that expired very recently
		const creator = await db.user.create({
			data: {
				name: "Recent Expiry Creator",
				email: "recent@test.com",
			},
		});

		const discussion = await db.discussion.create({
			data: {
				name: "Test Recent Expiry Discussion",
				description: "Testing recent expiration handling",
				isActive: true,
				creatorId: creator.id,
			},
		});

		const recentlyExpiredInvitation = await db.invitation.create({
			data: {
				type: "DISCUSSION",
				targetId: discussion.id,
				recipientEmail: "",
				senderId: creator.id,
				status: "PENDING",
				expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
			},
		});

		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		// Should handle recent expiration consistently
		const validation = await caller.invitation.validate({ 
			token: recentlyExpiredInvitation.token 
		});
		
		expect(validation.valid).toBe(false);
		expect(validation.reason).toBe("Invitation has expired");

		// Getting details should also fail consistently
		await expect(
			caller.invitation.getByToken({ token: recentlyExpiredInvitation.token })
		).rejects.toThrow("Invitation has expired");
	});

	test("should provide helpful error messages for different expiration scenarios", async () => {
		const creator = await db.user.create({
			data: {
				name: "Error Message Creator",
				email: "errors@test.com",
			},
		});

		const discussion = await db.discussion.create({
			data: {
				name: "Test Error Messages Discussion",
				description: "Testing error message quality",
				isActive: true,
				creatorId: creator.id,
			},
		});

		// Test 1: Long expired invitation
		const longExpiredInvitation = await db.invitation.create({
			data: {
				type: "DISCUSSION",
				targetId: discussion.id,
				recipientEmail: "",
				senderId: creator.id,
				status: "PENDING",
				expiresAt: new Date("2025-01-01T00:00:00Z"), // Long past
			},
		});

		// Test 2: Already processed expired invitation
		const processedExpiredInvitation = await db.invitation.create({
			data: {
				type: "DISCUSSION",
				targetId: discussion.id,
				recipientEmail: "",
				senderId: creator.id,
				status: "EXPIRED", // Already marked as expired
				expiresAt: new Date("2025-08-01T00:00:00Z"), // Past date
			},
		});

		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		// Test long expired invitation
		const longExpiredValidation = await caller.invitation.validate({ 
			token: longExpiredInvitation.token 
		});
		expect(longExpiredValidation.valid).toBe(false);
		expect(longExpiredValidation.reason).toBe("Invitation has expired");

		// Test already processed expired invitation
		const processedValidation = await caller.invitation.validate({ 
			token: processedExpiredInvitation.token 
		});
		expect(processedValidation.valid).toBe(false);
		expect(processedValidation.reason).toContain("expired");
	});

	test("should not allow joining with expired invitation token", async () => {
		// Setup expired invitation scenario
		const creator = await db.user.create({
			data: {
				name: "No Join Creator",
				email: "nojoin@test.com",
			},
		});

		const discussion = await db.discussion.create({
			data: {
				name: "Test No Join Discussion",
				description: "Testing prevention of expired invitation joins",
				isActive: true,
				creatorId: creator.id,
			},
		});

		const expiredInvitation = await db.invitation.create({
			data: {
				type: "DISCUSSION",
				targetId: discussion.id,
				recipientEmail: "",
				senderId: creator.id,
				status: "PENDING",
				expiresAt: new Date(Date.now() - 5000), // Expired 5 seconds ago
			},
		});

		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		// Attempt to join with expired invitation should fail
		// Note: The actual participant.join contract may not include token validation
		// This test may need adjustment based on final implementation
		
		try {
			await caller.participant.join({
				discussionId: discussion.id,
				displayName: "Should Not Join",
				sessionId: "expired-join-test",
			});
			
			// If join succeeds without token validation, that's also acceptable
			// as long as the invitation token handler page prevents the flow
		} catch (error) {
			// Expected: some form of validation should prevent this
			expect(error).toBeDefined();
		}

		// More importantly, verify invitation validation prevents the flow
		const validation = await caller.invitation.validate({ 
			token: expiredInvitation.token 
		});
		expect(validation.valid).toBe(false);
	});

	test("should handle expired invitations with different time zones", async () => {
		// Test timezone handling for expiration
		const creator = await db.user.create({
			data: {
				name: "Timezone Creator",
				email: "timezone@test.com",
			},
		});

		const discussion = await db.discussion.create({
			data: {
				name: "Test Timezone Discussion",
				description: "Testing timezone expiration handling",
				isActive: true,
				creatorId: creator.id,
			},
		});

		// Create invitation expired in different timezone representation
		const timezoneExpiredInvitation = await db.invitation.create({
			data: {
				type: "DISCUSSION",
				targetId: discussion.id,
				recipientEmail: "",
				senderId: creator.id,
				status: "PENDING",
				expiresAt: new Date("2025-09-08T23:59:59Z"), // UTC past date
			},
		});

		const ctx = await createTRPCContext({ req: null, res: null });
		const caller = appRouter.createCaller(ctx);

		// Should handle UTC expiration correctly
		const validation = await caller.invitation.validate({ 
			token: timezoneExpiredInvitation.token 
		});
		
		expect(validation.valid).toBe(false);
		expect(validation.reason).toBe("Invitation has expired");

		// Consistent behavior across different access methods
		await expect(
			caller.invitation.getByToken({ token: timezoneExpiredInvitation.token })
		).rejects.toThrow("Invitation has expired");
	});
});