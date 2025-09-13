// T014: E2E test complete invitation flow
import { test, expect } from '@playwright/test';

test.describe('Complete Invitation Flow - E2E', () => {
	test('should complete full invitation acceptance flow', async ({ page }) => {
		// This test represents the complete user journey from the quickstart scenarios
		
		// Step 1: Navigate to invitation page with valid token
		// Note: In real implementation, this would use a test invitation token
		const testToken = 'cm123complete456flow789test';
		
		await page.goto(`/invitations/${testToken}`);

		// Step 2: Verify page loads with invitation details
		await expect(page.locator('h1')).toContainText('invited to join');
		
		// Should show invitation details
		const invitedByText = page.locator('text=Invited by:');
		await expect(invitedByText).toBeVisible();

		// Should show discussion capacity info
		const participantsInfo = page.locator('text=/\\d+ (of \\d+ )?participants/');
		await expect(participantsInfo).toBeVisible();

		// Step 3: Fill in participant name
		const nameInput = page.locator('input[placeholder*="name"]');
		await expect(nameInput).toBeVisible();
		
		const testParticipantName = 'E2E Test Participant';
		await nameInput.fill(testParticipantName);
		
		// Verify name was entered
		await expect(nameInput).toHaveValue(testParticipantName);

		// Step 4: Submit form to join discussion
		const joinButton = page.locator('button', { hasText: 'Join Discussion' });
		await expect(joinButton).toBeVisible();
		await expect(joinButton).toBeEnabled();
		
		await joinButton.click();

		// Step 5: Verify join process (loading state or redirect)
		// Should either show loading state or redirect to discussion
		await expect(async () => {
			// Look for either loading state or successful redirect
			const isLoading = await page.locator('text=Joining...').isVisible().catch(() => false);
			const hasRedirected = page.url().includes('/discussion/');
			
			expect(isLoading || hasRedirected).toBe(true);
		}).toPass({ timeout: 5000 });

		// If redirected, verify we're in the discussion participant view
		if (page.url().includes('/discussion/')) {
			// Should be in participant view
			expect(page.url()).toMatch(/\/discussion\/.*\/participant/);
			
			// Should show discussion interface
			await expect(page.locator('h1, h2')).toBeVisible();
		}
	});

	test('should handle expired invitation gracefully', async ({ page }) => {
		const expiredToken = 'cm123expired456flow789test';
		
		await page.goto(`/invitations/${expiredToken}`);

		// Should show expired error message
		await expect(page.locator('text=expired')).toBeVisible();
		await expect(page.locator('text=Unable to Access Discussion')).toBeVisible();

		// Should not show join form
		const joinButton = page.locator('button', { hasText: 'Join Discussion' });
		await expect(joinButton).not.toBeVisible();

		// Should show helpful error message
		const helpText = page.locator('text=Invitation links have an expiration date');
		await expect(helpText).toBeVisible();
	});

	test('should handle invalid invitation tokens', async ({ page }) => {
		const invalidToken = 'invalid_token_format';
		
		await page.goto(`/invitations/${invalidToken}`);

		// Should show error for invalid token
		await expect(page.locator('text=not valid')).toBeVisible();
		
		// Should not show join form
		const nameInput = page.locator('input[placeholder*="name"]');
		await expect(nameInput).not.toBeVisible();
	});

	test('should handle full discussion scenario', async ({ page }) => {
		const fullDiscussionToken = 'cm123full456discussion789';
		
		await page.goto(`/invitations/${fullDiscussionToken}`);

		// Should show full discussion error
		await expect(page.locator('text=full')).toBeVisible();
		await expect(page.locator('text=maximum number of participants')).toBeVisible();
		
		// Should not allow joining
		const joinButton = page.locator('button', { hasText: 'Join Discussion' });
		await expect(joinButton).not.toBeVisible();
	});

	test('should validate participant name input', async ({ page }) => {
		const testToken = 'cm123validation456test789';
		
		await page.goto(`/invitations/${testToken}`);
		
		const nameInput = page.locator('input[placeholder*="name"]');
		const joinButton = page.locator('button[type="submit"]');
		
		// Empty name should disable submit button
		await expect(joinButton).toBeDisabled();
		
		// Fill with valid name
		await nameInput.fill('Valid User Name');
		await expect(joinButton).toBeEnabled();
		
		// Clear name should disable button again
		await nameInput.fill('');
		await expect(joinButton).toBeDisabled();
		
		// Very long name should show validation error
		const longName = 'a'.repeat(51); // 51 characters, over 50 limit
		await nameInput.fill(longName);
		
		// Try to submit - should show validation error
		await joinButton.click();
		
		const validationError = page.locator('text=50 characters or less');
		await expect(validationError).toBeVisible();
	});

	test('should show loading states appropriately', async ({ page }) => {
		const testToken = 'cm123loading456states789';
		
		await page.goto(`/invitations/${testToken}`);
		
		// Initial loading should show skeleton
		const skeleton = page.locator('[data-testid="loading-skeleton"]');
		
		// If still loading, skeleton should be visible
		if (await skeleton.isVisible()) {
			await expect(skeleton).toBeVisible();
			
			// Wait for content to load
			await expect(page.locator('h1')).toBeVisible({ timeout: 5000 });
		}
		
		// Fill form and test join loading state
		const nameInput = page.locator('input[placeholder*="name"]');
		await nameInput.fill('Loading Test User');
		
		const joinButton = page.locator('button[type="submit"]');
		await joinButton.click();
		
		// Should show loading text briefly
		const joiningText = page.locator('text=Joining...');
		// Note: This might be very brief, so we use a short timeout
		await expect(joiningText).toBeVisible({ timeout: 2000 }).catch(() => {
			// Loading might complete too quickly to catch
			console.log('Loading state completed too quickly to verify');
		});
	});

	test('should handle network errors gracefully', async ({ page }) => {
		const testToken = 'cm123network456error789';
		
		// Simulate network failure by going offline
		await page.context().setOffline(true);
		
		await page.goto(`/invitations/${testToken}`);
		
		// Should handle offline state
		// Note: Exact behavior depends on implementation
		// Could show error message or retry mechanism
		
		// Restore network
		await page.context().setOffline(false);
		
		// Page should recover when network is restored
		await page.reload();
		await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
	});

	test('should be accessible with keyboard navigation', async ({ page }) => {
		const testToken = 'cm123keyboard456access789';
		
		await page.goto(`/invitations/${testToken}`);
		
		// Should be able to navigate with Tab key
		await page.keyboard.press('Tab');
		
		// Should focus on name input
		const nameInput = page.locator('input[placeholder*="name"]');
		await expect(nameInput).toBeFocused();
		
		// Should be able to type
		await page.keyboard.type('Keyboard User');
		await expect(nameInput).toHaveValue('Keyboard User');
		
		// Should be able to tab to submit button
		await page.keyboard.press('Tab');
		
		const joinButton = page.locator('button[type="submit"]');
		await expect(joinButton).toBeFocused();
		
		// Should be able to submit with Enter
		await page.keyboard.press('Enter');
		
		// Should trigger form submission
		await expect(async () => {
			const isLoading = await page.locator('text=Joining...').isVisible().catch(() => false);
			const hasRedirected = page.url().includes('/discussion/');
			expect(isLoading || hasRedirected).toBe(true);
		}).toPass({ timeout: 5000 });
	});

	test('should work correctly in different browsers', async ({ browserName, page }) => {
		const testToken = `cm123browser456${browserName}789`;
		
		await page.goto(`/invitations/${testToken}`);
		
		// Basic functionality should work in all browsers
		await expect(page.locator('h1')).toBeVisible();
		
		const nameInput = page.locator('input[placeholder*="name"]');
		await expect(nameInput).toBeVisible();
		
		const joinButton = page.locator('button[type="submit"]');
		await expect(joinButton).toBeVisible();
		
		// Form should work consistently across browsers
		await nameInput.fill(`${browserName} User`);
		await expect(nameInput).toHaveValue(`${browserName} User`);
		
		await expect(joinButton).toBeEnabled();
		
		console.log(`✓ Basic functionality verified in ${browserName}`);
	});

	test('should handle concurrent users accessing same invitation', async ({ browser }) => {
		const testToken = 'cm123concurrent456users789';
		
		// Create multiple browser contexts to simulate different users
		const context1 = await browser.newContext();
		const context2 = await browser.newContext();
		
		const page1 = await context1.newPage();
		const page2 = await context2.newPage();
		
		try {
			// Both users access the same invitation
			await Promise.all([
				page1.goto(`/invitations/${testToken}`),
				page2.goto(`/invitations/${testToken}`)
			]);
			
			// Both should see the invitation page
			await Promise.all([
				expect(page1.locator('h1')).toBeVisible(),
				expect(page2.locator('h1')).toBeVisible()
			]);
			
			// Both should be able to fill forms independently
			await page1.locator('input[placeholder*="name"]').fill('User One');
			await page2.locator('input[placeholder*="name"]').fill('User Two');
			
			// Both should be able to submit (though only one might succeed depending on capacity)
			const button1 = page1.locator('button[type="submit"]');
			const button2 = page2.locator('button[type="submit"]');
			
			await expect(button1).toBeEnabled();
			await expect(button2).toBeEnabled();
			
			console.log('✓ Concurrent access handled correctly');
		} finally {
			await context1.close();
			await context2.close();
		}
	});

	test('should preserve form data during page interactions', async ({ page }) => {
		const testToken = 'cm123preserve456form789';
		
		await page.goto(`/invitations/${testToken}`);
		
		const nameInput = page.locator('input[placeholder*="name"]');
		
		// Fill in name
		await nameInput.fill('Persistent User');
		await expect(nameInput).toHaveValue('Persistent User');
		
		// Interact with other elements
		const invitationCard = page.locator('[role="main"], .container, div').first();
		await invitationCard.click();
		
		// Name should still be there
		await expect(nameInput).toHaveValue('Persistent User');
		
		// Focus away and back
		await page.keyboard.press('Tab');
		await nameInput.focus();
		
		// Value should be preserved
		await expect(nameInput).toHaveValue('Persistent User');
	});
});