import type { Session } from "next-auth";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	cleanupDatabase,
	createTestCaller,
	createTestUser,
	testDb,
} from "../db-setup";

describe("Invitation Acceptance Flow Integration Test", () => {
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

	it("should complete full invitation flow with email", async () => {
		// Step 1: Create a lesson and discussion
		const lesson = await testDb.lesson.create({
			data: {
				title: "Philosophy 101",
				content: "Content",
				objectives: ["Learn philosophy"],
				keyQuestions: ["What is truth?"],
				facilitationStyle: "socratic",
				creatorId: testUser.id,
				isPublished: true,
			},
		});

		const discussion = await caller.discussion.create({
			lessonId: lesson.id,
			name: "Philosophy Discussion Group",
			description: "Deep philosophical discussions",
			maxParticipants: 8,
			isPublic: false,
		});

		// Step 2: Send invitations to multiple recipients
		const invitations = await caller.invitation.sendInvitations({
			discussionId: discussion.id,
			invitations: [
				{
					email: "alice@example.com",
					personalMessage:
						"Would love to have you join our philosophy discussion!",
				},
				{
					email: "bob@example.com",
					personalMessage: "Your insights would be valuable.",
				},
				{
					email: "charlie@example.com",
				},
			],
			expiresInDays: 7,
		});

		expect(invitations).toMatchObject({
			totalSent: expect.any(Number),
			totalFailed: expect.any(Number),
			sent: expect.arrayContaining([
				expect.objectContaining({
					email: "alice@example.com",
					invitationId: expect.any(String),
				}),
			]),
		});

		// Step 3: Get invitation by token
		const firstInvitationId = invitations.sent[0]?.invitationId;
		const dbInvitation = await testDb.invitation.findUnique({
			where: { id: firstInvitationId },
		});

		expect(dbInvitation).toBeDefined();
		const token = dbInvitation?.token || "";

		const invitationDetails = await caller.invitation.getByToken({
			token,
		});

		expect(invitationDetails).toMatchObject({
			recipientEmail: "alice@example.com",
			senderId: testUser.id,
			status: "PENDING",
			message: "Would love to have you join our philosophy discussion!",
			discussion: expect.objectContaining({
				id: discussion.id,
				name: "Philosophy Discussion Group",
			}),
		});

		// Step 4: Validate invitation before accepting
		const validation = await caller.invitation.validate({ token });

		expect(validation).toMatchObject({
			valid: true,
			discussion: expect.objectContaining({
				id: discussion.id,
				participantCount: 1, // Just the creator
				maxParticipants: 8,
			}),
		});

		// Step 5: Accept invitation as existing user
		const alice = await createTestUser();
		const aliceSession: Session = {
			user: { id: alice.id, email: alice.email, name: alice.name },
			expires: testSession.expires,
		};
		const aliceCaller = await createTestCaller(aliceSession);

		const acceptResult = await aliceCaller.invitation.accept({ token });

		expect(acceptResult).toMatchObject({
			discussion: expect.objectContaining({
				id: discussion.id,
			}),
			userId: alice.id,
			accountCreated: false,
		});

		// Step 6: Verify invitation status changed
		const updatedInvitation = await caller.invitation.getByToken({ token });
		expect(updatedInvitation.status).toBe("ACCEPTED");
		expect(updatedInvitation.acceptedAt).toBeDefined();

		// Step 7: Verify participant was added to discussion
		const participants = await caller.discussion.getParticipants({
			id: discussion.id,
		});

		expect(participants.participants).toHaveLength(2);
		const participantUserIds = participants.participants.map((p) => p.userId);
		expect(participantUserIds).toContain(alice.id);

		// Step 8: List invitations for the discussion
		const invitationList = await caller.invitation.list({
			discussionId: discussion.id,
		});

		expect(invitationList.invitations).toHaveLength(3);
		const acceptedInvites = invitationList.invitations.filter(
			(inv) => inv.status === "ACCEPTED",
		);
		expect(acceptedInvites).toHaveLength(1);
	});

	it("should handle invitation link creation and multi-use", async () => {
		// Create discussion
		const lesson = await testDb.lesson.create({
			data: {
				title: "Group Study",
				content: "Content",
				objectives: ["Study together"],
				keyQuestions: ["How to learn?"],
				facilitationStyle: "collaborative",
				creatorId: testUser.id,
				isPublished: true,
			},
		});

		const discussion = await caller.discussion.create({
			lessonId: lesson.id,
			name: "Study Group",
			maxParticipants: 10,
			isPublic: false,
		});

		// Create shareable link with max uses
		const link = await caller.invitation.createLink({
			discussionId: discussion.id,
			expiresInDays: 14,
			maxUses: 3,
		});

		expect(link).toMatchObject({
			url: expect.stringMatching(/^https?:\/\//),
			token: expect.any(String),
			maxUses: 3,
			currentUses: 0,
		});

		// Multiple users can join with the same link
		for (let i = 0; i < 2; i++) {
			const user = await createTestUser();
			const userSession: Session = {
				user: { id: user.id, email: user.email, name: user.name },
				expires: testSession.expires,
			};
			const userCaller = await createTestCaller(userSession);

			// Validate link is still valid
			const validation = await userCaller.invitation.validate({
				token: link.token,
			});
			expect(validation.valid).toBe(true);

			// Accept invitation
			const result = await userCaller.invitation.accept({
				token: link.token,
			});
			expect(result.userId).toBe(user.id);
		}

		// Check current uses
		const updatedLink = await caller.invitation.getByToken({
			token: link.token,
		});
		expect(updatedLink).toBeDefined();
	});

	it("should handle invitation decline and cancellation", async () => {
		// Setup
		const lesson = await testDb.lesson.create({
			data: {
				title: "Test",
				content: "Content",
				objectives: ["Test"],
				keyQuestions: ["Test?"],
				facilitationStyle: "socratic",
				creatorId: testUser.id,
				isPublished: true,
			},
		});

		const discussion = await caller.discussion.create({
			lessonId: lesson.id,
			name: "Test Discussion",
			maxParticipants: 5,
		});

		// Send invitation
		const result = await caller.invitation.sendInvitations({
			discussionId: discussion.id,
			invitations: [{ email: "declining@example.com" }],
		});

		const invitationId = result.sent[0]?.invitationId || "";
		const dbInvite = await testDb.invitation.findUnique({
			where: { id: invitationId },
		});
		const token = dbInvite?.token || "";

		// User declines invitation
		const decliningUser = await createTestUser();
		const decliningSession: Session = {
			user: {
				id: decliningUser.id,
				email: decliningUser.email,
				name: decliningUser.name,
			},
			expires: testSession.expires,
		};
		const decliningCaller = await createTestCaller(decliningSession);

		const declineResult = await decliningCaller.invitation.decline({ token });
		expect(declineResult.success).toBe(true);

		// Verify status
		const declined = await caller.invitation.getByToken({ token });
		expect(declined.status).toBe("DECLINED");
		expect(declined.declinedAt).toBeDefined();

		// Send another invitation
		const result2 = await caller.invitation.sendInvitations({
			discussionId: discussion.id,
			invitations: [{ email: "cancel@example.com" }],
		});

		const cancelId = result2.sent[0]?.invitationId || "";

		// Creator cancels invitation
		const cancelResult = await caller.invitation.cancel({
			invitationId: cancelId,
		});
		expect(cancelResult.success).toBe(true);

		// Verify cancelled
		const cancelled = await testDb.invitation.findUnique({
			where: { id: cancelId },
		});
		expect(cancelled?.status).toBe("CANCELLED");
	});

	it("should handle resending invitations", async () => {
		// Setup
		const lesson = await testDb.lesson.create({
			data: {
				title: "Test",
				content: "Content",
				objectives: ["Test"],
				keyQuestions: ["Test?"],
				facilitationStyle: "socratic",
				creatorId: testUser.id,
				isPublished: true,
			},
		});

		const discussion = await caller.discussion.create({
			lessonId: lesson.id,
			name: "Test Discussion",
			maxParticipants: 5,
		});

		// Send initial invitation
		const result = await caller.invitation.sendInvitations({
			discussionId: discussion.id,
			invitations: [{ email: "resend@example.com" }],
		});

		const invitationId = result.sent[0]?.invitationId || "";

		// Resend invitation
		const resendResult = await caller.invitation.resend({
			invitationId,
		});

		expect(resendResult.success).toBe(true);

		// Verify invitation is still pending
		const dbInvite = await testDb.invitation.findUnique({
			where: { id: invitationId },
		});
		expect(dbInvite?.status).toBe("PENDING");
	});
});
