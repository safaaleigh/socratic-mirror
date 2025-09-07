import { expect, test } from "@playwright/test";

test.describe("Lesson Management E2E Tests", () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to lessons page (authentication handled by global setup)
		await page.goto("/lessons");
		await expect(page).toHaveTitle(/Socratic/);
		await expect(
			page.getByRole("heading", { name: "Lesson Management" }),
		).toBeVisible();
	});

	test("should display lessons page correctly", async ({ page }) => {
		// Verify page structure
		await expect(
			page.getByRole("heading", { name: "Lesson Management" }),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Create New Lesson" }),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Lesson Status Guide" }),
		).toBeVisible();

		// Verify status guide
		await expect(
			page.getByText("Draft: Can be edited and published"),
		).toBeVisible();
		await expect(
			page.getByText("Published: Available for discussions"),
		).toBeVisible();
		await expect(
			page.getByText("Archived: Read-only, can be forked"),
		).toBeVisible();
	});

	test("should create a new lesson successfully", async ({ page }) => {
		const timestamp = Date.now();
		const lessonTitle = `E2E Test Lesson ${timestamp}`;
		const lessonDescription = `A lesson created by E2E testing ${timestamp}`;

		// Click Create New Lesson
		await page.getByRole("button", { name: "Create New Lesson" }).click();
		await expect(
			page.getByRole("heading", { name: "Create New Lesson" }),
		).toBeVisible();

		// Fill out lesson form
		await page.getByRole("textbox", { name: "Title *" }).fill(lessonTitle);
		await page
			.getByRole("textbox", { name: "Description *" })
			.fill(lessonDescription);
		await page
			.getByRole("textbox", { name: "Content *" })
			.fill("Comprehensive content for testing lesson creation functionality.");

		// Add learning objective
		await page
			.getByRole("textbox", { name: "Add a learning objective" })
			.fill("Master E2E testing");
		await page
			.getByText("Learning Objectives")
			.locator("..")
			.getByRole("button", { name: "Add" })
			.click();

		// Add key question
		await page
			.getByRole("textbox", { name: "Add a key question for discussion" })
			.fill("How do we ensure quality?");
		await page
			.getByText("Key Questions")
			.locator("..")
			.getByRole("button", { name: "Add" })
			.click();

		// Set facilitation style and duration
		await page.getByLabel("Facilitation Style").selectOption(["Analytical"]);
		await page
			.getByRole("spinbutton", { name: "Duration (minutes)" })
			.fill("60");

		// Create the lesson
		await page.getByRole("button", { name: "Create Lesson" }).click();

		// Find the lesson heading and scroll to it
		const lessonHeading = page.getByRole("heading", { name: lessonTitle });
		await lessonHeading.scrollIntoViewIfNeeded();
		await expect(lessonHeading).toBeVisible();

		// Check for draft status - find the specific lesson heading and its parent card
		await expect(
			lessonHeading
				.locator("xpath=..")
				.locator("..")
				.getByText(lessonDescription),
		).toBeVisible();
		await expect(
			lessonHeading.locator("xpath=..").getByText("Draft"),
		).toBeVisible();
		await expect(
			lessonHeading.locator("xpath=../..").getByText("analytical style"),
		).toBeVisible();
		await expect(
			lessonHeading.locator("xpath=../..").getByText("60 min"),
		).toBeVisible();
		await expect(
			lessonHeading.locator("xpath=../..").getByText("Objectives (1)"),
		).toBeVisible();
	});

	test("should complete full lesson lifecycle: draft → published → archived", async ({
		page,
	}) => {
		// Create unique lesson name with timestamp to avoid conflicts
		const timestamp = Date.now();
		const lifecycleLessonTitle = `Lifecycle Test Lesson ${timestamp}`;

		// First create a lesson
		await page.getByRole("button", { name: "Create New Lesson" }).click();
		await page
			.getByRole("textbox", { name: "Title *" })
			.fill(lifecycleLessonTitle);
		await page
			.getByRole("textbox", { name: "Description *" })
			.fill("Testing lifecycle transitions");
		await page
			.getByRole("textbox", { name: "Content *" })
			.fill("Content for lifecycle testing");
		await page.getByRole("button", { name: "Create Lesson" }).click();

		// Verify it starts as Draft - wait for the lesson to be created and status to appear
		const lifecycleHeading = page
			.getByRole("heading", { name: lifecycleLessonTitle })
			.first();
		await expect(lifecycleHeading).toBeVisible({ timeout: 15000 });

		// Wait a moment for all UI elements to render, then check for Draft status
		await page.waitForTimeout(2000);
		await expect(
			lifecycleHeading.locator("xpath=..").getByText("Draft"),
		).toBeVisible({ timeout: 10000 });

		// Publish the lesson - find the publish button within this lesson's card
		await lifecycleHeading
			.locator("xpath=../../../..")
			.getByTitle("Publish lesson")
			.click();

		// Wait for the Draft status to disappear first, then wait for Published to appear
		await expect(
			lifecycleHeading.locator("xpath=..").getByText("Draft"),
		).not.toBeVisible({ timeout: 15000 });
		await expect(
			lifecycleHeading.locator("xpath=..").getByText("Published"),
		).toBeVisible({ timeout: 15000 });
		await expect(
			lifecycleHeading
				.locator("xpath=../../../..")
				.getByTitle("Archive lesson"),
		).toBeVisible();

		// Archive the lesson
		await lifecycleHeading
			.locator("xpath=../../../..")
			.getByTitle("Archive lesson")
			.click();

		// Wait for the Published status to disappear first, then wait for Archived to appear
		await expect(
			lifecycleHeading.locator("xpath=..").getByText("Published"),
		).not.toBeVisible({ timeout: 15000 });
		await expect(
			lifecycleHeading.locator("xpath=..").getByText("Archived"),
		).toBeVisible({ timeout: 15000 });
		await expect(
			lifecycleHeading.locator("xpath=../../../..").getByTitle("Delete lesson"),
		).toBeVisible();
	});

	test("should edit lesson successfully", async ({ page }) => {
		// Create unique lesson name with timestamp to avoid conflicts
		const timestamp = Date.now();
		const originalTitle = `Original Title ${timestamp}`;
		const updatedTitle = `Updated Title ${timestamp}`;

		// Create a lesson first
		await page.getByRole("button", { name: "Create New Lesson" }).click();
		await page.getByRole("textbox", { name: "Title *" }).fill(originalTitle);
		await page
			.getByRole("textbox", { name: "Description *" })
			.fill("Original description");
		await page
			.getByRole("textbox", { name: "Content *" })
			.fill("Original content");
		await page.getByRole("button", { name: "Create Lesson" }).click();

		// Edit the lesson - find the edit button within the specific lesson's card
		const originalHeading = page
			.getByRole("heading", { name: originalTitle })
			.first();
		await originalHeading
			.locator("xpath=../../../..")
			.getByTitle("Edit lesson")
			.click();
		await expect(
			page.getByRole("heading", { name: "Edit Lesson" }),
		).toBeVisible();

		// Verify form is pre-populated
		await expect(page.getByRole("textbox", { name: "Title *" })).toHaveValue(
			originalTitle,
		);
		await expect(
			page.getByRole("textbox", { name: "Description *" }),
		).toHaveValue("Original description");
		await expect(page.getByRole("textbox", { name: "Content *" })).toHaveValue(
			"Original content",
		);

		// Make changes
		await page.getByRole("textbox", { name: "Title *" }).fill(updatedTitle);
		await page
			.getByRole("textbox", { name: "Description *" })
			.fill("Updated description");
		await page.getByRole("button", { name: "Save Changes" }).click();

		// Verify changes are saved - find the updated lesson heading and verify its context
		const updatedHeading = page
			.getByRole("heading", { name: updatedTitle })
			.first();
		await expect(updatedHeading).toBeVisible();
		await expect(
			updatedHeading.locator("xpath=../..").getByText("Updated description"),
		).toBeVisible();
		await expect(
			updatedHeading
				.locator("xpath=../..")
				.getByText("Updated less than a minute ago"),
		).toBeVisible();
	});

	test("should handle lesson form validation", async ({ page }) => {
		// Create unique lesson name with timestamp to avoid conflicts
		const timestamp = Date.now();
		const validTitle = `Valid Title ${timestamp}`;

		await page.getByRole("button", { name: "Create New Lesson" }).click();

		// Try to create lesson with empty required fields
		await page.getByRole("button", { name: "Create Lesson" }).click();

		// Verify validation (forms should prevent submission with empty required fields)
		await expect(
			page.getByRole("heading", { name: "Create New Lesson" }),
		).toBeVisible();

		// Fill title with maximum length to test character limit (maxLength prevents >200 chars)
		const maxLengthTitle = "A".repeat(200);
		await page.getByRole("textbox", { name: "Title *" }).fill(maxLengthTitle);
		await page
			.getByRole("textbox", { name: "Description *" })
			.fill("Valid description");
		await page
			.getByRole("textbox", { name: "Content *" })
			.fill("Valid content");

		// Character counter should show at limit
		await expect(page.getByText("200/200 characters")).toBeVisible();

		// Use a shorter title
		await page.getByRole("textbox", { name: "Title *" }).fill(validTitle);
		await expect(
			page.getByText(`${validTitle.length}/200 characters`),
		).toBeVisible();

		await page.getByRole("button", { name: "Create Lesson" }).click();

		// Should successfully create
		await expect(
			page.getByRole("heading", { name: validTitle }).first(),
		).toBeVisible();
	});

	test("should handle lesson objectives and key questions", async ({
		page,
	}) => {
		// Create unique lesson name with timestamp to avoid conflicts
		const timestamp = Date.now();
		const multiObjectiveLessonTitle = `Multi-Objective Lesson ${timestamp}`;

		await page.getByRole("button", { name: "Create New Lesson" }).click();

		// Add multiple objectives
		await page
			.getByRole("textbox", { name: "Add a learning objective" })
			.fill("First objective");
		await page
			.getByText("Learning Objectives")
			.locator("..")
			.getByRole("button", { name: "Add" })
			.click();

		await page
			.getByRole("textbox", { name: "Add a learning objective" })
			.fill("Second objective");
		await page
			.getByText("Learning Objectives")
			.locator("..")
			.getByRole("button", { name: "Add" })
			.click();

		// Verify objectives appear
		await expect(page.getByText("First objective")).toBeVisible();
		await expect(page.getByText("Second objective")).toBeVisible();

		// Add key questions
		await page
			.getByRole("textbox", { name: "Add a key question for discussion" })
			.fill("First question?");
		await page
			.getByText("Key Questions")
			.locator("..")
			.getByRole("button", { name: "Add" })
			.click();

		await page
			.getByRole("textbox", { name: "Add a key question for discussion" })
			.fill("Second question?");
		await page
			.getByText("Key Questions")
			.locator("..")
			.getByRole("button", { name: "Add" })
			.click();

		// Verify questions appear
		await expect(page.getByText("First question?")).toBeVisible();
		await expect(page.getByText("Second question?")).toBeVisible();

		// Complete lesson creation
		await page
			.getByRole("textbox", { name: "Title *" })
			.fill(multiObjectiveLessonTitle);
		await page
			.getByRole("textbox", { name: "Description *" })
			.fill("Testing objectives and questions");
		await page
			.getByRole("textbox", { name: "Content *" })
			.fill("Content with multiple objectives");
		await page.getByRole("button", { name: "Create Lesson" }).click();

		// Verify lesson was created with objectives count
		const multiObjectiveHeading = page
			.getByRole("heading", { name: multiObjectiveLessonTitle })
			.first();
		await expect(
			multiObjectiveHeading.locator("xpath=../..").getByText("Objectives (2)"),
		).toBeVisible();
	});

	test("should test facilitation styles and duration settings", async ({
		page,
	}) => {
		// Create unique lesson name with timestamp to avoid conflicts
		const timestamp = Date.now();
		const styleTestLessonTitle = `Style Test Lesson ${timestamp}`;

		await page.getByRole("button", { name: "Create New Lesson" }).click();

		// Test different facilitation styles
		await page.getByLabel("Facilitation Style").selectOption(["Exploratory"]);
		await expect(page.getByLabel("Facilitation Style")).toHaveValue(
			"exploratory",
		);

		await page.getByLabel("Facilitation Style").selectOption(["Analytical"]);
		await expect(page.getByLabel("Facilitation Style")).toHaveValue(
			"analytical",
		);

		await page.getByLabel("Facilitation Style").selectOption(["Ethical"]);
		await expect(page.getByLabel("Facilitation Style")).toHaveValue("ethical");

		// Test duration and group size
		await page
			.getByRole("spinbutton", { name: "Duration (minutes)" })
			.fill("90");
		await page.getByRole("spinbutton", { name: "Group Size" }).fill("5");

		// Complete lesson creation
		await page
			.getByRole("textbox", { name: "Title *" })
			.fill(styleTestLessonTitle);
		await page
			.getByRole("textbox", { name: "Description *" })
			.fill("Testing facilitation styles");
		await page
			.getByRole("textbox", { name: "Content *" })
			.fill("Content with specific style");
		await page.getByRole("button", { name: "Create Lesson" }).click();

		// Verify settings are saved
		const styleTestHeading = page
			.getByRole("heading", { name: styleTestLessonTitle })
			.first();
		await expect(
			styleTestHeading.locator("xpath=../..").getByText("ethical style"),
		).toBeVisible();
		await expect(
			styleTestHeading.locator("xpath=../..").getByText("90 min"),
		).toBeVisible();
	});
});
