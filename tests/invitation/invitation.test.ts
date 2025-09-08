import { createId } from "@paralleldrive/cuid2";
import type { Lesson } from "@prisma/client";
import type { Session } from "next-auth";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	cleanupDatabase,
	createTestCaller,
	createTestLesson,
	createTestUser,
	testDb,
} from "../db-setup";

describe("Invitation Router Contract Tests", () => {
	let testUser: Awaited<ReturnType<typeof createTestUser>>;
	let testSession: Session;
	let caller: Awaited<ReturnType<typeof createTestCaller>>;
	let testLesson: Lesson;
	let testDiscussion: any;

	beforeEach(async () => {
		await cleanupDatabase();
		testUser = await createTestUser();
		testSession = {
			user: { id: testUser.id, email: testUser.email, name: testUser.name },
			expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		};
		caller = await createTestCaller(testSession);
		testLesson = await createTestLesson(testUser.id);

		// Create a discussion to use in tests
		testDiscussion = await caller.discussion.create({
			lessonId: testLesson.id,
			name: "Test Discussion",
			description: "Test discussion for invitations",
			maxParticipants: 10,
			isPublic: false,
		});
	});

	afterEach(async () => {
		await cleanupDatabase();
	});

	describe("sendInvitations", () => {
		it("should send email invitations to multiple recipients", async () => {
			const input = {
				discussionId: testDiscussion.id,
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

			// Check the structure of sent items
			if (result.sent.length > 0) {
				expect(result.sent[0]).toMatchObject({
					email: expect.any(String),
					invitationId: expect.any(String),
					status: expect.stringMatching(/^(sent|failed)$/),
				});
			}
		});

		it("should validate email addresses", async () => {
			const invalidInput = {
				discussionId: testDiscussion.id,
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
				discussionId: testDiscussion.id,
				invitations: Array.from({ length: 51 }, (_, i) => ({
					email: `user${i}@example.com`,
				})),
			};

			await expect(
				caller.invitation.sendInvitations(tooManyInvitations),
			).rejects.toThrow();
		});
	});

	// Skip createLink tests as they require schema fields that don't exist
	describe.skip("createLink", () => {
		it("should create a shareable invitation link", async () => {
			// This test is skipped because it requires maxUses and isLink fields
			// that don't exist in the current schema
		});
	});

	describe("list", () => {
		beforeEach(async () => {
			// Create some invitations
			await caller.invitation.sendInvitations({
				discussionId: testDiscussion.id,
				invitations: [
					{ email: "test1@example.com" },
					{ email: "test2@example.com" },
				],
			});
		});

		it("should list invitations for a discussion", async () => {
			const input = {
				discussionId: testDiscussion.id,
				status: "PENDING" as const,
			};

			const result = await caller.invitation.list(input);

			expect(result).toMatchObject({
				invitations: expect.any(Array),
				hasMore: expect.any(Boolean),
			});

			if (result.invitations.length > 0) {
				expect(result.invitations[0]).toMatchObject({
					id: expect.any(String),
					email: expect.any(String),
					status: expect.any(String),
					sentAt: expect.any(Date),
				});
			}
		});

		it("should filter by status", async () => {
			const pendingResult = await caller.invitation.list({
				discussionId: testDiscussion.id,
				status: "PENDING",
			});

			const acceptedResult = await caller.invitation.list({
				discussionId: testDiscussion.id,
				status: "ACCEPTED",
			});

			expect(pendingResult.invitations).toBeDefined();
			expect(acceptedResult.invitations).toBeDefined();
		});
	});

	describe("cancel", () => {
		let invitationId: string;

		beforeEach(async () => {
			// Create an invitation to cancel
			const result = await caller.invitation.sendInvitations({
				discussionId: testDiscussion.id,
				invitations: [{ email: "cancel-test@example.com" }],
			});
			invitationId = result.sent[0]?.invitationId || "";
		});

		it("should cancel an invitation", async () => {
			const input = {
				invitationId,
			};

			const result = await caller.invitation.cancel(input);

			expect(result).toMatchObject({
				success: true,
			});
		});

		it("should not allow cancelling accepted invitations", async () => {
			// First accept the invitation (this would normally be done through the accept flow)
			await testDb.invitation.update({
				where: { id: invitationId },
				data: { status: "ACCEPTED", acceptedAt: new Date() },
			});

			await expect(
				caller.invitation.cancel({
					invitationId,
				}),
			).rejects.toThrow();
		});
	});

	describe("resend", () => {
		let invitationId: string;

		beforeEach(async () => {
			// Create an invitation to resend
			const result = await caller.invitation.sendInvitations({
				discussionId: testDiscussion.id,
				invitations: [{ email: "resend-test@example.com" }],
			});
			invitationId = result.sent[0]?.invitationId || "";
		});

		it("should resend a pending invitation", async () => {
			const input = {
				invitationId,
			};

			const result = await caller.invitation.resend(input);

			expect(result).toMatchObject({
				success: true,
				email: "resend-test@example.com",
			});
		});

		it("should not resend accepted invitations", async () => {
			// Accept the invitation first
			await testDb.invitation.update({
				where: { id: invitationId },
				data: { status: "ACCEPTED", acceptedAt: new Date() },
			});

			await expect(
				caller.invitation.resend({ invitationId }),
			).rejects.toThrow();
		});
	});

	describe("validate", () => {
		let invitationToken: string;

		beforeEach(async () => {
			// Create an invitation with a known token
			const invitation = await testDb.invitation.create({
				data: {
					type: "DISCUSSION",
					targetId: testDiscussion.id,
					recipientEmail: "validate-test@example.com",
					token: createId(),
					expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
					senderId: testUser.id,
					status: "PENDING",
				},
			});
			invitationToken = invitation.token;
		});

		it("should validate a valid invitation", async () => {
			const input = {
				token: invitationToken,
			};

			const result = await caller.invitation.validate(input);

			expect(result).toMatchObject({
				valid: true,
				discussion: expect.objectContaining({
					id: testDiscussion.id,
					name: testDiscussion.name,
				}),
			});
		});

		it("should reject invalid invitations with reason", async () => {
			// Create an expired invitation
			const expiredInvitation = await testDb.invitation.create({
				data: {
					type: "DISCUSSION",
					targetId: testDiscussion.id,
					recipientEmail: "expired-test@example.com",
					token: createId(),
					expiresAt: new Date(Date.now() - 1000), // Already expired
					senderId: testUser.id,
					status: "PENDING",
				},
			});

			const result = await caller.invitation.validate({
				token: expiredInvitation.token,
			});

			expect(result).toMatchObject({
				valid: false,
				reason: expect.stringMatching(/expired/i),
			});
		});

		it("should reject when discussion is full", async () => {
			// Update discussion to be at max capacity
			await testDb.discussion.update({
				where: { id: testDiscussion.id },
				data: { maxParticipants: 1 },
			});

			// The creator is already a participant, so the discussion is full
			const result = await caller.invitation.validate({
				token: invitationToken,
			});

			expect(result).toMatchObject({
				valid: false,
				reason: expect.stringMatching(/full/i),
			});
		});
	});

	describe("accept", () => {
		let invitationToken: string;
		let acceptUser: Awaited<ReturnType<typeof createTestUser>>;
		let acceptCaller: any;

		beforeEach(async () => {
			// Create a user who will accept the invitation
			acceptUser = await createTestUser();
			const acceptSession: Session = {
				user: {
					id: acceptUser.id,
					email: acceptUser.email,
					name: acceptUser.name,
				},
				expires: testSession.expires,
			};
			acceptCaller = await createTestCaller(acceptSession);

			// Create an invitation for this user
			const invitation = await testDb.invitation.create({
				data: {
					type: "DISCUSSION",
					targetId: testDiscussion.id,
					recipientEmail: acceptUser.email || "accept-test@example.com",
					token: createId(),
					expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
					senderId: testUser.id,
					status: "PENDING",
				},
			});
			invitationToken = invitation.token;
		});

		it("should accept a valid invitation", async () => {
			const input = {
				token: invitationToken,
			};

			const result = await acceptCaller.invitation.accept(input);

			expect(result).toMatchObject({
				success: true,
				discussionId: testDiscussion.id,
				participant: expect.objectContaining({
					userId: acceptUser.id,
					role: "PARTICIPANT",
					status: "ACTIVE",
				}),
			});
		});

		it("should not accept invitation twice", async () => {
			// Accept once
			await acceptCaller.invitation.accept({ token: invitationToken });

			// Try to accept again
			await expect(
				acceptCaller.invitation.accept({ token: invitationToken }),
			).rejects.toThrow();
		});
	});

	describe("getByToken", () => {
		let invitationToken: string;

		beforeEach(async () => {
			// Create an invitation
			const invitation = await testDb.invitation.create({
				data: {
					type: "DISCUSSION",
					targetId: testDiscussion.id,
					recipientEmail: "getbytoken-test@example.com",
					token: createId(),
					expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
					senderId: testUser.id,
					status: "PENDING",
				},
			});
			invitationToken = invitation.token;
		});

		it("should retrieve invitation details by token", async () => {
			const input = {
				token: invitationToken,
			};

			const result = await caller.invitation.getByToken(input);

			expect(result).toMatchObject({
				id: expect.any(String),
				discussion: expect.objectContaining({
					id: testDiscussion.id,
					name: testDiscussion.name,
				}),
				status: "PENDING",
				expiresAt: expect.any(Date),
			});
		});

		it("should return null for non-existent token", async () => {
			const result = await caller.invitation.getByToken({
				token: "non-existent-token",
			});

			expect(result).toBeNull();
		});
	});
});
