// T012: E2E test mobile responsiveness
import { test, expect } from '@playwright/test';

test.describe('Invitation Token Page - Mobile Responsiveness', () => {
	test.beforeEach(async ({ page }) => {
		// Set mobile viewport
		await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE dimensions
	});

	test('should display invitation page correctly on mobile', async ({ page }) => {
		// Navigate to a test invitation page
		// Note: This test assumes a test invitation token exists
		// In real implementation, this would be set up via test data
		const testToken = 'cm123testmobile456token789';
		
		await page.goto(`/invitations/${testToken}`);

		// Check that page loads and is responsive
		await expect(page.locator('h1')).toBeVisible();
		
		// Verify card layout is mobile-friendly
		const card = page.locator('[data-testid="invitation-card"]');
		await expect(card).toBeVisible();
		
		// Check that content is not cut off
		const cardWidth = await card.boundingBox();
		expect(cardWidth?.width).toBeLessThanOrEqual(375);
	});

	test('should have touch-friendly button sizes', async ({ page }) => {
		const testToken = 'cm123testtouch456button789';
		
		await page.goto(`/invitations/${testToken}`);
		
		// Find the join button
		const joinButton = page.locator('button', { hasText: 'Join Discussion' });
		await expect(joinButton).toBeVisible();
		
		// Verify button meets touch target size requirements (44px minimum)
		const buttonBox = await joinButton.boundingBox();
		expect(buttonBox?.height).toBeGreaterThanOrEqual(44);
	});

	test('should handle form input on mobile devices', async ({ page }) => {
		const testToken = 'cm123testinput456mobile789';
		
		await page.goto(`/invitations/${testToken}`);
		
		// Find and interact with name input
		const nameInput = page.locator('input[placeholder*="name"]');
		await expect(nameInput).toBeVisible();
		
		// Test typing on mobile (simulates virtual keyboard)
		await nameInput.fill('Mobile Test User');
		await expect(nameInput).toHaveValue('Mobile Test User');
		
		// Verify input is not obscured when focused
		await nameInput.focus();
		const inputBox = await nameInput.boundingBox();
		expect(inputBox?.y).toBeGreaterThan(0); // Not hidden at top of screen
	});

	test('should scroll properly on mobile when content is long', async ({ page }) => {
		const testToken = 'cm123testscroll456mobile789';
		
		await page.goto(`/invitations/${testToken}`);
		
		// Check that page is scrollable if content exceeds viewport
		const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
		const viewportHeight = 667; // Our test viewport height
		
		if (bodyHeight > viewportHeight) {
			// Test scrolling to bottom
			await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
			
			// Verify we can see bottom content
			const footer = page.locator('p', { hasText: 'participate in the discussion' });
			await expect(footer).toBeVisible();
			
			// Scroll back to top
			await page.evaluate(() => window.scrollTo(0, 0));
			
			// Verify we can see top content
			const header = page.locator('h1');
			await expect(header).toBeVisible();
		}
	});

	test('should handle orientation changes gracefully', async ({ page }) => {
		const testToken = 'cm123testorientation456789';
		
		await page.goto(`/invitations/${testToken}`);
		
		// Start in portrait
		await page.setViewportSize({ width: 375, height: 667 });
		await expect(page.locator('h1')).toBeVisible();
		
		// Switch to landscape
		await page.setViewportSize({ width: 667, height: 375 });
		await expect(page.locator('h1')).toBeVisible();
		
		// Verify form is still usable
		const nameInput = page.locator('input[placeholder*="name"]');
		await expect(nameInput).toBeVisible();
		
		const joinButton = page.locator('button', { hasText: 'Join Discussion' });
		await expect(joinButton).toBeVisible();
	});

	test('should display error messages clearly on mobile', async ({ page }) => {
		const expiredToken = 'cm123testexpired456mobile789';
		
		await page.goto(`/invitations/${expiredToken}`);
		
		// Should show error message for expired invitation
		const errorMessage = page.locator('text=expired');
		await expect(errorMessage).toBeVisible();
		
		// Error message should be readable on mobile
		const errorBox = await errorMessage.boundingBox();
		expect(errorBox?.width).toBeLessThanOrEqual(375);
	});

	test('should handle small screen navigation', async ({ page }) => {
		const testToken = 'cm123testnavigation456mobile';
		
		await page.goto(`/invitations/${testToken}`);
		
		// Fill in form and attempt to join
		const nameInput = page.locator('input[placeholder*="name"]');
		await nameInput.fill('Mobile User');
		
		const joinButton = page.locator('button', { hasText: 'Join Discussion' });
		await joinButton.click();
		
		// Should handle the transition gracefully
		// Note: In real implementation, this would redirect or show loading state
		// For now, we just verify no layout breaks occur
		await expect(page.locator('h1')).toBeVisible();
	});

	test('should be accessible with screen readers on mobile', async ({ page }) => {
		const testToken = 'cm123testaccessibility456mobile';
		
		await page.goto(`/invitations/${testToken}`);
		
		// Check for proper ARIA labels and semantic HTML
		const mainHeading = page.locator('h1');
		await expect(mainHeading).toBeVisible();
		
		const nameLabel = page.locator('label[for="participantName"]');
		await expect(nameLabel).toBeVisible();
		
		const nameInput = page.locator('input#participantName');
		await expect(nameInput).toBeVisible();
		
		// Verify form has proper structure
		const form = page.locator('form');
		await expect(form).toBeVisible();
	});
});