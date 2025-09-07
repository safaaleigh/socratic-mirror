/**
 * tRPC API Contract: Lesson Management
 *
 * This file defines the type-safe API contracts for lesson CRUD operations.
 * Generated from functional requirements FR-001 through FR-023.
 */

import { z } from "zod";

// ========== Input Validation Schemas ==========

/**
 * FR-004, FR-005: Lesson creation input validation
 */
export const createLessonSchema = z.object({
	title: z
		.string()
		.min(1, "Title is required")
		.max(200, "Title must not exceed 200 characters"),
	description: z.string().min(1, "Description is required"),
	content: z.string().min(1, "Content is required"),
	objectives: z.array(z.string()).default([]),
	keyQuestions: z.array(z.string()).default([]),
	facilitationStyle: z
		.enum(["exploratory", "analytical", "ethical"])
		.default("exploratory"),
	suggestedDuration: z.number().int().positive().optional(),
	suggestedGroupSize: z.number().int().positive().default(3),
});

/**
 * FR-013: Lesson update input validation
 */
export const updateLessonSchema = z.object({
	id: z.string().cuid(),
	title: z.string().min(1).max(200).optional(),
	description: z.string().min(1).optional(),
	content: z.string().min(1).optional(),
	objectives: z.array(z.string()).optional(),
	keyQuestions: z.array(z.string()).optional(),
	facilitationStyle: z
		.enum(["exploratory", "analytical", "ethical"])
		.optional(),
	suggestedDuration: z.number().int().positive().optional(),
	suggestedGroupSize: z.number().int().positive().optional(),
});

/**
 * Common lesson ID parameter
 */
export const lessonIdSchema = z.object({
	id: z.string().cuid(),
});

/**
 * FR-018: Lesson deletion with associated discussions handling
 */
export const deleteLessonSchema = z.object({
	id: z.string().cuid(),
	handleActiveDiscussions: z.enum(["complete", "end"]),
});

/**
 * FR-021: Fork lesson for reuse
 */
export const forkLessonSchema = z.object({
	id: z.string().cuid(),
	newTitle: z.string().min(1).max(200).optional(),
});

// ========== Output Type Definitions ==========

/**
 * Standard lesson response format
 * Matches Prisma Lesson model structure
 */
export const lessonResponseSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string().nullable(),
	content: z.string(),
	objectives: z.array(z.string()),
	keyQuestions: z.array(z.string()),
	facilitationStyle: z.string(),
	suggestedDuration: z.number().nullable(),
	suggestedGroupSize: z.number(),
	creatorId: z.string(),
	isPublished: z.boolean(),
	isArchived: z.boolean(),
	createdAt: z.date(),
	updatedAt: z.date(),
	publishedAt: z.date().nullable(),
	// Computed fields
	status: z.enum(["draft", "published", "archived"]),
	canEdit: z.boolean(),
	canPublish: z.boolean(),
	canArchive: z.boolean(),
	canDelete: z.boolean(),
});

export type LessonResponse = z.infer<typeof lessonResponseSchema>;
export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;
export type DeleteLessonInput = z.infer<typeof deleteLessonSchema>;
export type ForkLessonInput = z.infer<typeof forkLessonSchema>;

// ========== tRPC Router Contract ==========

/**
 * Lesson tRPC Router API Contract
 *
 * This interface defines all lesson management endpoints
 * as they should be implemented in /src/server/api/routers/lesson.ts
 */
export interface LessonRouter {
	// FR-003, FR-006: Create lesson
	create: {
		input: CreateLessonInput;
		output: LessonResponse;
		errors: ["UNAUTHORIZED", "VALIDATION_ERROR"];
	};

	// FR-011: List user's lessons
	list: {
		input: undefined;
		output: LessonResponse[];
		errors: ["UNAUTHORIZED"];
	};

	// FR-011: Get single lesson by ID
	getById: {
		input: { id: string };
		output: LessonResponse;
		errors: ["UNAUTHORIZED", "NOT_FOUND", "FORBIDDEN"];
	};

	// FR-013: Update existing lesson
	update: {
		input: UpdateLessonInput;
		output: LessonResponse;
		errors: [
			"UNAUTHORIZED",
			"NOT_FOUND",
			"FORBIDDEN",
			"VALIDATION_ERROR",
			"CONFLICT",
		];
	};

	// FR-014: Publish draft lesson
	publish: {
		input: { id: string };
		output: LessonResponse;
		errors: ["UNAUTHORIZED", "NOT_FOUND", "FORBIDDEN", "BAD_REQUEST"];
	};

	// FR-016: Archive published lesson
	archive: {
		input: { id: string };
		output: LessonResponse;
		errors: ["UNAUTHORIZED", "NOT_FOUND", "FORBIDDEN", "BAD_REQUEST"];
	};

	// FR-017, FR-018: Delete lesson with discussion handling
	delete: {
		input: DeleteLessonInput;
		output: { success: boolean; affectedDiscussions: number };
		errors: ["UNAUTHORIZED", "NOT_FOUND", "FORBIDDEN"];
	};

	// FR-021: Fork archived lesson
	fork: {
		input: ForkLessonInput;
		output: LessonResponse;
		errors: ["UNAUTHORIZED", "NOT_FOUND", "FORBIDDEN", "BAD_REQUEST"];
	};
}

// ========== Error Definitions ==========

export const lessonApiErrors = {
	LESSON_NOT_FOUND: "Lesson not found or access denied",
	LESSON_NOT_EDITABLE: "Lesson cannot be edited in current state",
	LESSON_NOT_PUBLISHABLE: "Only draft lessons can be published",
	LESSON_NOT_ARCHIVABLE: "Only published lessons can be archived",
	LESSON_NOT_FORKABLE: "Only archived lessons can be forked",
	CONCURRENT_MODIFICATION: "Lesson was modified by another user",
	VALIDATION_FAILED: "Input validation failed",
	UNAUTHORIZED_ACCESS: "Authentication required",
	FORBIDDEN_ACTION: "Insufficient permissions for this action",
} as const;

// ========== Business Rules ==========

export const lessonBusinessRules = {
	// FR-015: Published lessons cannot revert to draft
	canRevertToDraft: (lesson: { isPublished: boolean }) => !lesson.isPublished,

	// FR-014: Only drafts can be published
	canPublish: (lesson: { isPublished: boolean; isArchived: boolean }) =>
		!lesson.isPublished && !lesson.isArchived,

	// FR-016: Only published lessons can be archived
	canArchive: (lesson: { isPublished: boolean; isArchived: boolean }) =>
		lesson.isPublished && !lesson.isArchived,

	// FR-021: Only archived lessons can be forked
	canFork: (lesson: { isArchived: boolean }) => lesson.isArchived,

	// FR-023: Only creators can modify their lessons
	canModify: (lesson: { creatorId: string }, userId: string) =>
		lesson.creatorId === userId,
} as const;
