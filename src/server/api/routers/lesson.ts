import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

// Input validation schemas from contract
const createLessonSchema = z.object({
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

const updateLessonSchema = z.object({
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

const lessonIdSchema = z.object({
	id: z.string().cuid(),
});

const deleteLessonSchema = z.object({
	id: z.string().cuid(),
	handleActiveDiscussions: z.enum(["complete", "end"]),
});

const forkLessonSchema = z.object({
	id: z.string().cuid(),
	newTitle: z.string().min(1).max(200).optional(),
});

// Helper function to compute lesson status and permissions
function computeLessonMetadata(lesson: any, currentUserId: string) {
	const isOwner = lesson.creatorId === currentUserId;

	let status: "draft" | "published" | "archived";
	if (lesson.isArchived) {
		status = "archived";
	} else if (lesson.isPublished) {
		status = "published";
	} else {
		status = "draft";
	}

	return {
		...lesson,
		status,
		canEdit: isOwner && !lesson.isArchived,
		canPublish: isOwner && !lesson.isPublished && !lesson.isArchived,
		canArchive: isOwner && lesson.isPublished && !lesson.isArchived,
		canDelete: isOwner,
	};
}

export const lessonRouter = createTRPCRouter({
	// Create new lesson (T010)
	create: protectedProcedure
		.input(createLessonSchema)
		.mutation(async ({ ctx, input }) => {
			const lesson = await ctx.db.lesson.create({
				data: {
					...input,
					creatorId: ctx.session.user.id,
				},
			});

			return computeLessonMetadata(lesson, ctx.session.user.id);
		}),

	// List user's lessons (T011)
	list: protectedProcedure.query(async ({ ctx }) => {
		const lessons = await ctx.db.lesson.findMany({
			where: {
				creatorId: ctx.session.user.id,
			},
			orderBy: {
				updatedAt: "desc",
			},
		});

		return lessons.map((lesson) =>
			computeLessonMetadata(lesson, ctx.session.user.id),
		);
	}),

	// Get lesson by ID (T012)
	getById: protectedProcedure
		.input(lessonIdSchema)
		.query(async ({ ctx, input }) => {
			const lesson = await ctx.db.lesson.findUnique({
				where: {
					id: input.id,
				},
			});

			if (!lesson) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Lesson not found",
				});
			}

			if (lesson.creatorId !== ctx.session.user.id) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Access denied",
				});
			}

			return computeLessonMetadata(lesson, ctx.session.user.id);
		}),

	// Update lesson (T013)
	update: protectedProcedure
		.input(updateLessonSchema)
		.mutation(async ({ ctx, input }) => {
			const { id, ...updateData } = input;

			// Check if lesson exists and user owns it
			const existingLesson = await ctx.db.lesson.findUnique({
				where: { id },
			});

			if (!existingLesson) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Lesson not found",
				});
			}

			if (existingLesson.creatorId !== ctx.session.user.id) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Access denied",
				});
			}

			// Check if lesson can be edited (not archived)
			if (existingLesson.isArchived) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Archived lessons cannot be edited",
				});
			}

			const updatedLesson = await ctx.db.lesson.update({
				where: { id },
				data: updateData,
			});

			return computeLessonMetadata(updatedLesson, ctx.session.user.id);
		}),

	// Publish lesson (T014)
	publish: protectedProcedure
		.input(lessonIdSchema)
		.mutation(async ({ ctx, input }) => {
			const lesson = await ctx.db.lesson.findUnique({
				where: { id: input.id },
			});

			if (!lesson) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Lesson not found",
				});
			}

			if (lesson.creatorId !== ctx.session.user.id) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Access denied",
				});
			}

			// Check if lesson can be published (draft state)
			if (lesson.isPublished || lesson.isArchived) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Only draft lessons can be published",
				});
			}

			const publishedLesson = await ctx.db.lesson.update({
				where: { id: input.id },
				data: {
					isPublished: true,
					publishedAt: new Date(),
				},
			});

			return computeLessonMetadata(publishedLesson, ctx.session.user.id);
		}),

	// Archive lesson (T015)
	archive: protectedProcedure
		.input(lessonIdSchema)
		.mutation(async ({ ctx, input }) => {
			const lesson = await ctx.db.lesson.findUnique({
				where: { id: input.id },
			});

			if (!lesson) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Lesson not found",
				});
			}

			if (lesson.creatorId !== ctx.session.user.id) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Access denied",
				});
			}

			// Check if lesson can be archived (published state)
			if (!lesson.isPublished || lesson.isArchived) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Only published lessons can be archived",
				});
			}

			const archivedLesson = await ctx.db.lesson.update({
				where: { id: input.id },
				data: {
					isArchived: true,
				},
			});

			return computeLessonMetadata(archivedLesson, ctx.session.user.id);
		}),

	// Delete lesson (T016)
	delete: protectedProcedure
		.input(deleteLessonSchema)
		.mutation(async ({ ctx, input }) => {
			const lesson = await ctx.db.lesson.findUnique({
				where: { id: input.id },
				include: {
					discussions: true,
				},
			});

			if (!lesson) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Lesson not found",
				});
			}

			if (lesson.creatorId !== ctx.session.user.id) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Access denied",
				});
			}

			const affectedDiscussions = lesson.discussions.length;

			// Handle active discussions based on user choice
			if (input.handleActiveDiscussions === "end") {
				// End discussions immediately by setting closedAt
				await ctx.db.discussion.updateMany({
					where: {
						lessonId: input.id,
						closedAt: null,
					},
					data: {
						closedAt: new Date(),
						isActive: false,
					},
				});
			}
			// For "complete" option, we just unlink the lesson but let discussions continue

			// Unlink lesson from discussions (set lessonId to null)
			await ctx.db.discussion.updateMany({
				where: {
					lessonId: input.id,
				},
				data: {
					lessonId: null,
				},
			});

			// Delete the lesson
			await ctx.db.lesson.delete({
				where: { id: input.id },
			});

			return {
				success: true,
				affectedDiscussions,
			};
		}),

	// Fork lesson (T017)
	fork: protectedProcedure
		.input(forkLessonSchema)
		.mutation(async ({ ctx, input }) => {
			const originalLesson = await ctx.db.lesson.findUnique({
				where: { id: input.id },
			});

			if (!originalLesson) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Lesson not found",
				});
			}

			if (originalLesson.creatorId !== ctx.session.user.id) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Access denied",
				});
			}

			// Check if lesson can be forked (archived state)
			if (!originalLesson.isArchived) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Only archived lessons can be forked",
				});
			}

			// Create new lesson as fork
			const forkedLesson = await ctx.db.lesson.create({
				data: {
					title: input.newTitle || `${originalLesson.title} (Copy)`,
					description: originalLesson.description,
					content: originalLesson.content,
					objectives: originalLesson.objectives,
					keyQuestions: originalLesson.keyQuestions,
					facilitationStyle: originalLesson.facilitationStyle,
					suggestedDuration: originalLesson.suggestedDuration,
					suggestedGroupSize: originalLesson.suggestedGroupSize,
					creatorId: ctx.session.user.id,
					// New lesson starts as draft
					isPublished: false,
					isArchived: false,
				},
			});

			return computeLessonMetadata(forkedLesson, ctx.session.user.id);
		}),
});
