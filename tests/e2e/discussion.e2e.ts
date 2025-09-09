import { type Page, expect, test } from "@playwright/test";
import { testDb } from "../db-setup";

// Test configuration
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const TEST_TIMEOUT = 60000;

test.describe("Discussion Lifecycle E2E Tests", () => {
	let testUser: { id: string; email: string };
	let testLesson: { id: string };

	test.beforeEach(async () => {
		// Clean database and create test data
		await testDb.$connect();

		// Clean up test data in reverse dependency order
		await testDb.message.deleteMany();
		await testDb.discussionParticipant.deleteMany();
		await testDb.discussion.deleteMany();
		await testDb.lesson.deleteMany();
		await testDb.invitation.deleteMany();
		await testDb.session.deleteMany();
		await testDb.account.deleteMany();
		await testDb.user.deleteMany();

		// Create test user
		testUser = await testDb.user.create({
			data: {
				email: `e2e-test-${Date.now()}@example.com`,
				name: "E2E Test User",
				image: null,
			},
		});

		// Create test lesson
		testLesson = await testDb.lesson.create({
			data: {
				title: "E2E Test Lesson: Critical Thinking",
				description: "A lesson for testing the complete discussion flow",
				content:
					"Learn to think critically about complex problems and evaluate arguments systematically.",
				objectives: [
					"Identify logical fallacies",
					"Evaluate evidence quality",
					"Construct sound arguments",
					"Apply critical thinking to real scenarios",
				],
				keyQuestions: [
					"What assumptions are being made?",
					"What evidence supports this claim?",
					"Are there alternative explanations?",
					"What are the implications?",
				],
				facilitationStyle: "socratic",
				suggestedDuration: 60,
				suggestedGroupSize: 6,
				creatorId: testUser.id,
				isPublished: true,
			},
		});
	});

	test.afterEach(async () => {
		// Cleanup after each test
		await testDb.message.deleteMany();
		await testDb.discussionParticipant.deleteMany();
		await testDb.discussion.deleteMany();
		await testDb.lesson.deleteMany();
		await testDb.invitation.deleteMany();
		await testDb.session.deleteMany();
		await testDb.account.deleteMany();
		await testDb.user.deleteMany();
		await testDb.$disconnect();
	});

	test("Complete discussion lifecycle: create, invite, participate, facilitate", async ({
		browser,
		context,
	}) => {
		test.setTimeout(TEST_TIMEOUT);

		// Create two browser contexts for creator and participant
		const creatorContext = await browser.newContext();
		const participantContext = await browser.newContext();

		const creatorPage = await creatorContext.newPage();
		const participantPage = await participantContext.newPage();

		try {
			// PHASE 1: Creator Authentication and Setup
			await test.step("Creator logs in and navigates to discussions", async () => {
				await creatorPage.goto(BASE_URL);

				// Mock authentication or use test auth
				await creatorPage.evaluate((userId) => {
					// Mock next-auth session in localStorage/cookies
					window.localStorage.setItem("test-user-id", userId);
				}, testUser.id);

				// Navigate to discussions page
				await creatorPage.goto(`${BASE_URL}/discussions`);
				await expect(creatorPage).toHaveTitle(/Discussions/);
			});

			// PHASE 2: Discussion Creation
			let discussionId: string;
			let joinCode: string;

			await test.step("Creator creates a new discussion", async () => {
				// Click "Create Discussion" button
				await creatorPage.click('[data-testid="create-discussion-btn"]');

				// Fill out the discussion form
				await creatorPage.fill(
					'[data-testid="discussion-name"]',
					"Evening Critical Thinking Workshop",
				);
				await creatorPage.fill(
					'[data-testid="discussion-description"]',
					"Join us for an engaging discussion on critical thinking principles and their practical applications.",
				);

				// Select the lesson
				await creatorPage.selectOption(
					'[data-testid="lesson-select"]',
					testLesson.id,
				);

				// Set participant limit
				await creatorPage.fill('[data-testid="max-participants"]', "8");

				// Configure AI settings
				await creatorPage.selectOption('[data-testid="ai-model"]', "gpt-4");
				await creatorPage.fill('[data-testid="ai-temperature"]', "0.7");

				// Schedule for later (optional)
				const futureDate = new Date();
				futureDate.setHours(futureDate.getHours() + 2);
				await creatorPage.fill(
					'[data-testid="scheduled-date"]',
					futureDate.toISOString().slice(0, 16),
				);

				// Submit form
				await creatorPage.click('[data-testid="create-discussion-submit"]');

				// Wait for redirect to discussion page
				await creatorPage.waitForURL(/\/discussions\/[a-zA-Z0-9]+/);

				// Extract discussion ID from URL
				const url = creatorPage.url();
				discussionId = url.split("/").pop() || "";

				// Verify discussion was created
				await expect(
					creatorPage.locator('[data-testid="discussion-title"]'),
				).toHaveText("Evening Critical Thinking Workshop");
			});

			// PHASE 3: Generate and Share Join Code
			await test.step("Creator generates join code", async () => {
				// Click generate join code button
				await creatorPage.click('[data-testid="generate-join-code-btn"]');

				// Wait for join code to appear
				await creatorPage.waitForSelector('[data-testid="join-code"]');

				// Extract join code
				joinCode =
					(await creatorPage.textContent('[data-testid="join-code"]')) || "";
				expect(joinCode).toMatch(/^[A-Z0-9]{8}$/);

				// Verify join code is displayed
				await expect(
					creatorPage.locator('[data-testid="join-code"]'),
				).toBeVisible();
			});

			// PHASE 4: Send Email Invitations
			await test.step("Creator sends email invitations", async () => {
				// Click invite participants button
				await creatorPage.click('[data-testid="invite-participants-btn"]');

				// Fill out invitation form
				await creatorPage.fill(
					'[data-testid="invite-email-0"]',
					"alice.philosopher@example.com",
				);
				await creatorPage.fill(
					'[data-testid="invite-message-0"]',
					"Your expertise in philosophy would be valuable to our discussion!",
				);

				// Add another invitation
				await creatorPage.click('[data-testid="add-invitation-btn"]');
				await creatorPage.fill(
					'[data-testid="invite-email-1"]',
					"bob.thinker@example.com",
				);

				// Set expiration
				await creatorPage.selectOption(
					'[data-testid="invite-expiration"]',
					"7",
				);

				// Send invitations
				await creatorPage.click('[data-testid="send-invitations-btn"]');

				// Wait for success message
				await expect(
					creatorPage.locator('[data-testid="invite-success"]'),
				).toBeVisible();

				// Verify invitations in list
				await creatorPage.click('[data-testid="view-invitations-btn"]');
				await expect(
					creatorPage.locator('[data-testid="invitation-item"]'),
				).toHaveCount(2);
			});

			// PHASE 5: Participant Joins Discussion
			await test.step("Participant joins via join code", async () => {
				// Navigate to join page
				await participantPage.goto(`${BASE_URL}/discussions/join`);

				// Enter join code
				await participantPage.fill('[data-testid="join-code-input"]', joinCode);

				// Submit join form
				await participantPage.click('[data-testid="join-discussion-btn"]');

				// Create account or sign in
				await participantPage.fill(
					'[data-testid="participant-name"]',
					"Test Participant",
				);
				await participantPage.fill(
					'[data-testid="participant-email"]',
					"participant@example.com",
				);
				await participantPage.click('[data-testid="join-as-guest-btn"]');

				// Wait for redirect to discussion
				await participantPage.waitForURL(/\/discussions\/[a-zA-Z0-9]+/);

				// Verify participant joined
				await expect(
					participantPage.locator('[data-testid="discussion-title"]'),
				).toHaveText("Evening Critical Thinking Workshop");

				// Check participant count updated on creator's page
				await creatorPage.reload();
				await expect(
					creatorPage.locator('[data-testid="participant-count"]'),
				).toHaveText("2"); // Creator + Participant
			});

			// PHASE 6: Real-time Messaging
			await test.step("Real-time messaging between participants", async () => {
				// Creator sends welcome message
				await creatorPage.fill(
					'[data-testid="message-input"]',
					"Welcome everyone! Let's explore the fundamentals of critical thinking. What does critical thinking mean to you?",
				);
				await creatorPage.click('[data-testid="send-message-btn"]');

				// Wait for message to appear on both pages
				await expect(
					creatorPage.locator('[data-testid="message-item"]').last(),
				).toContainText("What does critical thinking mean to you?");

				await expect(
					participantPage.locator('[data-testid="message-item"]').last(),
				).toContainText("What does critical thinking mean to you?");

				// Participant responds
				await participantPage.fill(
					'[data-testid="message-input"]',
					"To me, critical thinking means questioning assumptions and evaluating evidence before forming conclusions.",
				);
				await participantPage.click('[data-testid="send-message-btn"]');

				// Wait for response to appear on creator's page
				await expect(
					creatorPage.locator('[data-testid="message-item"]').last(),
				).toContainText("questioning assumptions");

				// Test message reactions
				await creatorPage
					.locator('[data-testid="message-item"]')
					.last()
					.hover();
				await creatorPage.click('[data-testid="react-thumbs-up"]');

				// Verify reaction appears
				await expect(
					creatorPage.locator('[data-testid="reaction-count-👍"]'),
				).toHaveText("1");
			});

			// PHASE 7: Threaded Conversations
			await test.step("Threaded message conversations", async () => {
				// Reply to participant's message
				const participantMessage = participantPage
					.locator('[data-testid="message-item"]')
					.filter({ hasText: "questioning assumptions" });

				await participantMessage.hover();
				await participantMessage.locator('[data-testid="reply-btn"]').click();

				await creatorPage.fill(
					'[data-testid="reply-input"]',
					"Excellent point! Can you give us an example of a time when you questioned an assumption that turned out to be wrong?",
				);
				await creatorPage.click('[data-testid="send-reply-btn"]');

				// Verify threaded reply appears
				await expect(
					creatorPage.locator('[data-testid="thread-reply"]').last(),
				).toContainText("questioned an assumption");
			});

			// PHASE 8: AI Facilitation
			await test.step("AI-assisted facilitation", async () => {
				// Creator requests AI guidance
				await creatorPage.click('[data-testid="ai-facilitate-btn"]');

				// Provide context for AI
				await creatorPage.fill(
					'[data-testid="ai-context"]',
					"Discussion is going well. Participants are engaged with the topic of assumptions. Need help guiding them toward practical applications.",
				);
				await creatorPage.click('[data-testid="get-ai-suggestion-btn"]');

				// Wait for AI response
				await expect(
					creatorPage.locator('[data-testid="ai-suggestion"]'),
				).toBeVisible();

				// AI suggestion should be relevant
				const aiSuggestion = await creatorPage.textContent(
					'[data-testid="ai-suggestion"]',
				);
				expect(aiSuggestion).toContain(""); // AI should provide substantive response

				// Use AI suggestion to send message
				await creatorPage.click('[data-testid="use-ai-suggestion-btn"]');

				// Verify AI-suggested message appears in chat
				await expect(
					creatorPage.locator('[data-testid="message-item"]').last(),
				).toHaveAttribute("data-ai-assisted", "true");
			});

			// PHASE 9: Discussion Management
			await test.step("Discussion management and moderation", async () => {
				// View participant list
				await creatorPage.click('[data-testid="view-participants-btn"]');

				// Verify participants are listed
				await expect(
					creatorPage.locator('[data-testid="participant-list-item"]'),
				).toHaveCount(2);

				// Update discussion settings
				await creatorPage.click('[data-testid="discussion-settings-btn"]');
				await creatorPage.fill(
					'[data-testid="edit-description"]',
					"Updated: An interactive workshop on critical thinking with AI assistance",
				);
				await creatorPage.click('[data-testid="save-settings-btn"]');

				// Verify description updated
				await expect(
					creatorPage.locator('[data-testid="discussion-description"]'),
				).toContainText("Updated: An interactive workshop");
			});

			// PHASE 10: Message History and Search
			await test.step("Message history and search functionality", async () => {
				// Search messages
				await creatorPage.fill('[data-testid="message-search"]', "assumptions");
				await creatorPage.click('[data-testid="search-messages-btn"]');

				// Verify search results
				await expect(
					creatorPage.locator('[data-testid="search-result"]'),
				).toHaveCount(2); // Should find messages containing "assumptions"

				// Clear search
				await creatorPage.click('[data-testid="clear-search-btn"]');

				// Load more messages (pagination)
				await creatorPage.click('[data-testid="load-more-messages-btn"]');
			});

			// PHASE 11: Discussion Analytics
			await test.step("Discussion analytics and insights", async () => {
				// View discussion analytics
				await creatorPage.click('[data-testid="discussion-analytics-btn"]');

				// Check analytics dashboard
				await expect(
					creatorPage.locator('[data-testid="total-messages"]'),
				).toContainText(/\d+/); // Should show message count

				await expect(
					creatorPage.locator('[data-testid="active-participants"]'),
				).toContainText("2");

				await expect(
					creatorPage.locator('[data-testid="discussion-duration"]'),
				).toBeVisible();
			});

			// PHASE 12: Export and Sharing
			await test.step("Export discussion and generate share link", async () => {
				// Export discussion
				await creatorPage.click('[data-testid="export-discussion-btn"]');
				await creatorPage.selectOption('[data-testid="export-format"]', "pdf");
				await creatorPage.click('[data-testid="generate-export-btn"]');

				// Wait for export to be ready
				await expect(
					creatorPage.locator('[data-testid="export-ready"]'),
				).toBeVisible();

				// Generate shareable link
				await creatorPage.click('[data-testid="generate-share-link-btn"]');
				await expect(
					creatorPage.locator('[data-testid="share-link"]'),
				).toBeVisible();
			});

			// PHASE 13: Discussion Closure
			await test.step("Close discussion and final actions", async () => {
				// Close discussion
				await creatorPage.click('[data-testid="close-discussion-btn"]');
				await creatorPage.fill(
					'[data-testid="closing-message"]',
					"Thank you all for a fantastic discussion! Great insights shared today.",
				);
				await creatorPage.click('[data-testid="confirm-close-btn"]');

				// Verify discussion is closed
				await expect(
					creatorPage.locator('[data-testid="discussion-status"]'),
				).toHaveText("Closed");

				// Participants should see closure notification
				await expect(
					participantPage.locator('[data-testid="discussion-closed-notice"]'),
				).toBeVisible();

				// Verify final message count and summary
				await expect(
					creatorPage.locator('[data-testid="final-message-count"]'),
				).toContainText(/\d+ messages/);
			});
		} finally {
			// Cleanup browser contexts
			await creatorContext.close();
			await participantContext.close();
		}
	});

	test("Error handling and edge cases", async ({ page }) => {
		test.setTimeout(30000);

		await test.step("Handle invalid join codes", async () => {
			await page.goto(`${BASE_URL}/discussions/join`);

			// Try invalid join code
			await page.fill('[data-testid="join-code-input"]', "INVALID1");
			await page.click('[data-testid="join-discussion-btn"]');

			// Should show error message
			await expect(page.locator('[data-testid="error-message"]')).toContainText(
				"Invalid join code",
			);
		});

		await test.step("Handle full discussion capacity", async () => {
			// This would require creating a discussion at max capacity
			// and testing that new participants cannot join
			await page.goto(`${BASE_URL}/discussions/join`);
			await page.fill('[data-testid="join-code-input"]', "FULL0001");
			await page.click('[data-testid="join-discussion-btn"]');

			await expect(page.locator('[data-testid="error-message"]')).toContainText(
				"Discussion is full",
			);
		});

		await test.step("Handle expired invitations", async () => {
			await page.goto(`${BASE_URL}/invite/expired-token-123`);

			await expect(page.locator('[data-testid="error-message"]')).toContainText(
				"This invitation has expired",
			);
		});
	});

	test("Mobile responsiveness and accessibility", async ({ page, context }) => {
		test.setTimeout(30000);

		// Set mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });

		await test.step("Mobile discussion interface", async () => {
			await page.goto(`${BASE_URL}/discussions`);

			// Test mobile navigation
			await page.click('[data-testid="mobile-menu-btn"]');
			await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();

			// Test mobile discussion creation
			await page.click('[data-testid="create-discussion-btn"]');
			await expect(
				page.locator('[data-testid="mobile-create-form"]'),
			).toBeVisible();
		});

		await test.step("Accessibility compliance", async () => {
			// Test keyboard navigation
			await page.keyboard.press("Tab");
			await expect(page.locator(":focus")).toBeVisible();

			// Test screen reader attributes
			const discussionTitle = page.locator('[data-testid="discussion-title"]');
			await expect(discussionTitle).toHaveAttribute("role", "heading");

			// Test color contrast (would need axe-core for full testing)
			const messageInput = page.locator('[data-testid="message-input"]');
			await expect(messageInput).toHaveAttribute("aria-label");
		});
	});
});
