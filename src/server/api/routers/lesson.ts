import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

// Validation schemas
const createLessonSchema = z.object({
	title: z.string().min(1).max(200),
	description: z.string().optional(),
	content: z.string().min(1),
	objectives: z.array(z.string()).default([]),
	facilitationStyle: z
		.enum(["exploratory", "analytical", "ethical"])
		.default("exploratory"),
	keyQuestions: z.array(z.string()).default([]),
	suggestedDuration: z.number().min(5).max(180).optional(),
	suggestedGroupSize: z.number().min(2).max(10).default(3),
	isPublished: z.boolean().default(false),
});

const updateLessonSchema = createLessonSchema.partial().extend({
	id: z.string().cuid(),
});

const lessonFilterSchema = z.object({
	isPublished: z.boolean().optional(),
	isArchived: z.boolean().optional(),
	creatorId: z.string().optional(),
	limit: z.number().min(1).max(100).default(20),
	offset: z.number().min(0).default(0),
});

export const lessonRouter = createTRPCRouter({
	// Create a new lesson
	create: protectedProcedure
		.input(createLessonSchema)
		.mutation(async ({ ctx, input }) => {
			const lesson = await ctx.db.lesson.create({
				data: {
					...input,
					creatorId: ctx.session.user.id,
					publishedAt: input.isPublished ? new Date() : null,
				},
			});

			return lesson;
		}),

	// Update an existing lesson
	update: protectedProcedure
		.input(updateLessonSchema)
		.mutation(async ({ ctx, input }) => {
			const { id, ...data } = input;

			// Check if user owns the lesson
			const existingLesson = await ctx.db.lesson.findUnique({
				where: { id },
				select: { creatorId: true, isPublished: true },
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
					message: "You don't have permission to update this lesson",
				});
			}

			// Handle publish state change
			const publishUpdate =
				data.isPublished !== undefined &&
				data.isPublished !== existingLesson.isPublished
					? { publishedAt: data.isPublished ? new Date() : null }
					: {};

			const updatedLesson = await ctx.db.lesson.update({
				where: { id },
				data: {
					...data,
					...publishUpdate,
				},
			});

			return updatedLesson;
		}),

	// Publish or unpublish a lesson
	publish: protectedProcedure
		.input(
			z.object({
				id: z.string().cuid(),
				isPublished: z.boolean(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Check ownership
			const lesson = await ctx.db.lesson.findUnique({
				where: { id: input.id },
				select: { creatorId: true },
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
					message: "You don't have permission to publish this lesson",
				});
			}

			const updatedLesson = await ctx.db.lesson.update({
				where: { id: input.id },
				data: {
					isPublished: input.isPublished,
					publishedAt: input.isPublished ? new Date() : null,
				},
			});

			return updatedLesson;
		}),

	// Archive or unarchive a lesson
	archive: protectedProcedure
		.input(
			z.object({
				id: z.string().cuid(),
				isArchived: z.boolean(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Check ownership
			const lesson = await ctx.db.lesson.findUnique({
				where: { id: input.id },
				select: { creatorId: true },
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
					message: "You don't have permission to archive this lesson",
				});
			}

			const updatedLesson = await ctx.db.lesson.update({
				where: { id: input.id },
				data: {
					isArchived: input.isArchived,
				},
			});

			return updatedLesson;
		}),

	// List lessons with filtering
	list: protectedProcedure
		.input(lessonFilterSchema)
		.query(async ({ ctx, input }) => {
			const where = {
				...(input.isPublished !== undefined && {
					isPublished: input.isPublished,
				}),
				...(input.isArchived !== undefined && { isArchived: input.isArchived }),
				...(input.creatorId && { creatorId: input.creatorId }),
			};

			const [lessons, total] = await Promise.all([
				ctx.db.lesson.findMany({
					where,
					take: input.limit,
					skip: input.offset,
					orderBy: { createdAt: "desc" },
					include: {
						creator: {
							select: {
								id: true,
								name: true,
								email: true,
								image: true,
							},
						},
						_count: {
							select: {
								discussions: true,
							},
						},
					},
				}),
				ctx.db.lesson.count({ where }),
			]);

			return {
				lessons,
				total,
				hasMore: input.offset + input.limit < total,
			};
		}),

	// Get a single lesson by ID
	getById: protectedProcedure
		.input(z.string().cuid())
		.query(async ({ ctx, input }) => {
			const lesson = await ctx.db.lesson.findUnique({
				where: { id: input },
				include: {
					creator: {
						select: {
							id: true,
							name: true,
							email: true,
							image: true,
						},
					},
					discussions: {
						where: {
							isActive: true,
						},
						select: {
							id: true,
							name: true,
							isActive: true,
							scheduledFor: true,
							_count: {
								select: {
									participants: true,
									messages: true,
								},
							},
						},
						take: 5,
						orderBy: { createdAt: "desc" },
					},
				},
			});

			if (!lesson) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Lesson not found",
				});
			}

			// Check if user can view this lesson
			const canView =
				lesson.isPublished || lesson.creatorId === ctx.session.user.id;

			if (!canView) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You don't have permission to view this lesson",
				});
			}

			return lesson;
		}),

	// Get lessons created by the current user
	myLessons: protectedProcedure
		.input(
			z.object({
				limit: z.number().min(1).max(50).default(10),
				offset: z.number().min(0).default(0),
			}),
		)
		.query(async ({ ctx, input }) => {
			const [lessons, total] = await Promise.all([
				ctx.db.lesson.findMany({
					where: {
						creatorId: ctx.session.user.id,
					},
					take: input.limit,
					skip: input.offset,
					orderBy: { updatedAt: "desc" },
					include: {
						_count: {
							select: {
								discussions: true,
							},
						},
					},
				}),
				ctx.db.lesson.count({
					where: {
						creatorId: ctx.session.user.id,
					},
				}),
			]);

			return {
				lessons,
				total,
				hasMore: input.offset + input.limit < total,
			};
		}),

	// Delete a lesson (soft delete by archiving)
	delete: protectedProcedure
		.input(z.string().cuid())
		.mutation(async ({ ctx, input }) => {
			// Check ownership
			const lesson = await ctx.db.lesson.findUnique({
				where: { id: input },
				select: {
					creatorId: true,
					_count: {
						select: {
							discussions: {
								where: {
									isActive: true,
								},
							},
						},
					},
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
					message: "You don't have permission to delete this lesson",
				});
			}

			// Prevent deletion if there are active discussions
			if (lesson._count.discussions > 0) {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "Cannot delete lesson with active discussions",
				});
			}

			// Soft delete by archiving and unpublishing
			const deletedLesson = await ctx.db.lesson.update({
				where: { id: input },
				data: {
					isArchived: true,
					isPublished: false,
				},
			});

			return deletedLesson;
		}),
});
