import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

// Set up test environment variables before anything else
(process.env as any).NODE_ENV = "test";
process.env.DATABASE_URL =
	"postgresql://test:test@localhost:5432/socratic_test";
process.env.TEST_DATABASE_URL =
	"postgresql://test:test@localhost:5432/socratic_test";
process.env.AUTH_SECRET = "test-secret-for-testing";
process.env.NEXTAUTH_URL = "http://localhost:3000";
process.env.NEXTAUTH_SECRET = "test-secret-for-testing";

// Skip T3 environment validation for tests
process.env.SKIP_ENV_VALIDATION = "true";

// Mock NextAuth auth function since tests don't need real auth
vi.mock("@/server/auth", () => ({
	auth: vi.fn(() => Promise.resolve(null)),
}));

// Extend Vitest's expect with jest-dom matchers
beforeAll(() => {
	// Setup test environment
});

afterEach(() => {
	cleanup();
});

afterAll(() => {
	// Cleanup after tests
});
