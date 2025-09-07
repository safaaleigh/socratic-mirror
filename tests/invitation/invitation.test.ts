import type { Session } from "next-auth";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanupDatabase, createTestCaller, createTestUser } from "../db-setup";

describe("Invitation Router Contract Tests", () => {
	let testUser: Awaited<ReturnType<typeof createTestUser>>;
	let testSession: Session;
	let caller: Awaited<ReturnType<typeof createTestCaller>>;

	beforeEach(async () => {
		await cleanupDatabase();
		testUser = await createTestUser();
		testSession = {
			user: { id: testUser.id, email: testUser.email, name: testUser.name },
			expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		};
		caller = await createTestCaller(testSession);
	});

	afterEach(async () => {
		await cleanupDatabase();
	});

	describe("sendInvitations", () => {
		it("should send email invitations to multiple recipients", async () => {
			const input = {
				discussionId: "test-discussion-id",
				invitations: [
					{
						email: "user1@example.com",
						personalMessage: "Join our discussion!",
					},
					{
						email: "user2@example.com",
					},
				],
				expiresInDays: 7,
			};

			const result = await caller.invitation.sendInvitations(input);

			expect(result).toMatchObject({
				sent: expect.any(Array),
				totalSent: expect.any(Number),
				totalFailed: expect.any(Number),
			});

			expect(result.sent).toHaveLength(2);
			result.sent.forEach((item) => {
				expect(item).toMatchObject({
					email: expect.any(String),
					invitationId: expect.any(String),
					status: expect.stringMatching(/^(sent|failed)$/),
				});
			});
		});

		it("should validate email addresses", async () => {
			const invalidInput = {
				discussionId: "test-discussion-id",
				invitations: [
					{
						email: "invalid-email",
					},
				],
			};

			await expect(
				caller.invitation.sendInvitations(invalidInput as any),
			).rejects.toThrow();
		});

		it("should limit number of invitations", async () => {
			const tooManyInvitations = {
				discussionId: "test-discussion-id",
				invitations: Array.from({ length: 51 }, (_, i) => ({
					email: `user${i}@example.com`,
				})),
			};

			await expect(
				caller.invitation.sendInvitations(tooManyInvitations),
			).rejects.toThrow();
		});
	});

	describe("createLink", () => {
		it("should create a shareable invitation link", async () => {
			const input = {
				discussionId: "test-discussion-id",
				expiresInDays: 14,
				maxUses: 10,
			};

			const result = await caller.invitation.createLink(input);

			expect(result).toMatchObject({
				url: expect.stringMatching(/^https?:\/\//),
				token: expect.any(String),
				expiresAt: expect.any(Date),
				maxUses: input.maxUses,
				currentUses: 0,
			});
		});

		it("should create unlimited use link when maxUses not specified", async () => {
			const input = {
				discussionId: "test-discussion-id",
				expiresInDays: 7,
			};

			const result = await caller.invitation.createLink(input);

			expect(result.maxUses).toBeNull();
		});
	});

	describe("getByToken", () => {
		it("should retrieve invitation details by token", async () => {
			const input = {
				token: "test-invitation-token",
			};

			const result = await caller.invitation.getByToken(input);

			expect(result).toMatchObject({
				id: expect.any(String),
				type: expect.stringMatching(/^(DISCUSSION|GROUP)$/),
				recipientEmail: expect.any(String),
				senderId: expect.any(String),
				sender: expect.objectContaining({
					id: expect.any(String),
					email: expect.any(String),
				}),
				token: input.token,
				status: expect.any(String),
				expiresAt: expect.any(Date),
			});
		});

		it("should include discussion details when available", async () => {
			const result = await caller.invitation.getByToken({
				token: "discussion-invitation-token",
			});

			expect(result.discussion).toBeDefined();
			expect(result.discussion).toMatchObject({
				id: expect.any(String),
				name: expect.any(String),
			});
		});
	});

	describe("accept", () => {
		it("should accept invitation for existing user", async () => {
			const input = {
				token: "valid-invitation-token",
			};

			const result = await caller.invitation.accept(input);

			expect(result).toMatchObject({
				discussion: expect.objectContaining({
					id: expect.any(String),
					name: expect.any(String),
				}),
				userId: expect.any(String),
				accountCreated: false,
			});
		});

		it("should create account when needed", async () => {
			const publicCaller = await createTestCaller(null);

			const input = {
				token: "valid-invitation-token",
				createAccount: {
					name: "New User",
					email: "newuser@example.com",
				},
			};

			const result = await publicCaller.invitation.accept(input);

			expect(result).toMatchObject({
				discussion: expect.any(Object),
				userId: expect.any(String),
				accountCreated: true,
			});
		});

		it("should reject expired invitations", async () => {
			await expect(
				caller.invitation.accept({ token: "expired-token" }),
			).rejects.toThrow();
		});
	});

	describe("decline", () => {
		it("should decline an invitation", async () => {
			const input = {
				token: "valid-invitation-token",
			};

			const result = await caller.invitation.decline(input);

			expect(result).toMatchObject({
				success: true,
			});
		});
	});

	describe("cancel", () => {
		it("should allow sender to cancel pending invitation", async () => {
			const input = {
				invitationId: "pending-invitation-id",
			};

			const result = await caller.invitation.cancel(input);

			expect(result).toMatchObject({
				success: true,
			});
		});

		it("should reject cancellation from non-sender", async () => {
			const anotherUser = await createTestUser();
			const differentUserSession: Session = {
				user: {
					id: anotherUser.id,
					email: anotherUser.email,
					name: anotherUser.name,
				},
				expires: testSession.expires,
			};
			const differentUserCaller = await createTestCaller(differentUserSession);

			await expect(
				differentUserCaller.invitation.cancel({
					invitationId: "someone-elses-invitation",
				}),
			).rejects.toThrow();
		});
	});

	describe("resend", () => {
		it("should resend invitation email", async () => {
			const input = {
				invitationId: "pending-invitation-id",
			};

			const result = await caller.invitation.resend(input);

			expect(result).toMatchObject({
				success: true,
			});
		});

		it("should only resend pending invitations", async () => {
			await expect(
				caller.invitation.resend({
					invitationId: "accepted-invitation-id",
				}),
			).rejects.toThrow();
		});
	});

	describe("list", () => {
		it("should list invitations for a discussion", async () => {
			const input = {
				discussionId: "test-discussion-id",
				limit: 10,
			};

			const result = await caller.invitation.list(input);

			expect(result).toMatchObject({
				invitations: expect.any(Array),
				hasMore: expect.any(Boolean),
			});

			if (result.invitations.length > 0) {
				expect(result.invitations[0]).toMatchObject({
					id: expect.any(String),
					recipientEmail: expect.any(String),
					status: expect.any(String),
				});
			}
		});

		it("should filter by status", async () => {
			const pendingResult = await caller.invitation.list({
				status: "PENDING",
			});

			const acceptedResult = await caller.invitation.list({
				status: "ACCEPTED",
			});

			expect(pendingResult.invitations).toBeDefined();
			expect(acceptedResult.invitations).toBeDefined();
		});

		it("should support pagination", async () => {
			const firstPage = await caller.invitation.list({
				limit: 5,
			});

			if (firstPage.hasMore && firstPage.nextCursor) {
				const secondPage = await caller.invitation.list({
					limit: 5,
					cursor: firstPage.nextCursor,
				});

				expect(secondPage.invitations).toBeDefined();
			}
		});
	});

	describe("validate", () => {
		it("should validate a valid invitation", async () => {
			const input = {
				token: "valid-invitation-token",
			};

			const result = await caller.invitation.validate(input);

			expect(result).toMatchObject({
				valid: true,
				discussion: expect.objectContaining({
					id: expect.any(String),
					name: expect.any(String),
					participantCount: expect.any(Number),
					maxParticipants: expect.any(Number),
				}),
			});
		});

		it("should reject invalid invitations with reason", async () => {
			const result = await caller.invitation.validate({
				token: "expired-token",
			});

			expect(result).toMatchObject({
				valid: false,
				reason: expect.any(String),
			});
		});

		it("should reject when discussion is full", async () => {
			const result = await caller.invitation.validate({
				token: "full-discussion-token",
			});

			expect(result).toMatchObject({
				valid: false,
				reason: expect.stringContaining("full"),
			});
		});
	});
});
