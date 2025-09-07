import * as path from "node:path";
import { type FullConfig, chromium } from "@playwright/test";
import * as dotenv from "dotenv";

// Load test environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });

async function globalSetup(config: FullConfig) {
	const authFile = "tests/e2e/.auth/user.json";
	const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3004";
	const userEmail = process.env.TEST_USER_EMAIL || "test@example.com";
	const userPassword = process.env.TEST_USER_PASSWORD || "password123";

	console.log(`🔐 Setting up authentication for test user: ${userEmail}`);

	// Launch browser
	const browser = await chromium.launch();
	const page = await browser.newPage();

	try {
		// Navigate to the application
		await page.goto(baseUrl);

		// Click Sign In
		await page.getByRole("link", { name: "Sign In" }).click();

		// Fill in credentials
		await page.getByRole("textbox", { name: "Email" }).fill(userEmail);
		await page.getByRole("textbox", { name: "Password" }).fill(userPassword);

		// Click sign in button
		await page.getByRole("button", { name: "Sign in" }).click();

		// Wait for successful authentication (should redirect to homepage with Dashboard link)
		await page
			.getByRole("link", { name: "Dashboard" })
			.waitFor({ timeout: 10000 });

		console.log("✅ Authentication successful, saving session state");

		// Save authentication state
		await page.context().storageState({ path: authFile });

		console.log(`💾 Session state saved to ${authFile}`);
	} catch (error) {
		console.error("❌ Authentication failed:", error);
		throw error;
	} finally {
		await browser.close();
	}
}

export default globalSetup;
