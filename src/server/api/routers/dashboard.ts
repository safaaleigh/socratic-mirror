import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { z } from "zod";

export const dashboardRouter = createTRPCRouter({
	// Get instructor dashboard stats
	getInstructorStats: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;

		// Get counts in parallel
		const [
			lessonsCount,
			publishedLessonsCount,
			groupsCount,
			activeGroupsCount,
			discussionsCreatedCount,
			activeDiscussionsCount,
			totalParticipants,
			pendingInvitations,
		] = await Promise.all([
			// Total lessons created
			ctx.db.lesson.count({
				where: { creatorId: userId },
			}),
			// Published lessons
			ctx.db.lesson.count({
				where: {
					creatorId: userId,
					isPublished: true,
				},
			}),
			// Total groups created
			ctx.db.group.count({
				where: { creatorId: userId },
			}),
			// Active groups
			ctx.db.group.count({
				where: {
					creatorId: userId,
					isActive: true,
				},
			}),
			// Total discussions created
			ctx.db.discussion.count({
				where: { creatorId: userId },
			}),
			// Active discussions
			ctx.db.discussion.count({
				where: {
					creatorId: userId,
					isActive: true,
				},
			}),
			// Total unique participants across all groups
			ctx.db.groupMember.count({
				where: {
					group: {
						creatorId: userId,
					},
					status: "ACTIVE",
				},
			}),
			// Pending invitations sent
			ctx.db.invitation.count({
				where: {
					senderId: userId,
					status: "PENDING",
					expiresAt: { gt: new Date() },
				},
			}),
		]);

		// Get recent activity
		const recentActivity = await ctx.db.message.findMany({
			where: {
				discussion: {
					creatorId: userId,
				},
			},
			take: 10,
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				content: true,
				type: true,
				createdAt: true,
				author: {
					select: {
						name: true,
						email: true,
					},
				},
				discussion: {
					select: {
						id: true,
						name: true,
					},
				},
			},
		});

		return {
			stats: {
				lessons: {
					total: lessonsCount,
					published: publishedLessonsCount,
				},
				groups: {
					total: groupsCount,
					active: activeGroupsCount,
				},
				discussions: {
					total: discussionsCreatedCount,
					active: activeDiscussionsCount,
				},
				participants: totalParticipants,
				pendingInvitations,
			},
			recentActivity,
		};
	}),

	// Get participant dashboard stats
	getParticipantStats: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;

		// Get counts in parallel
		const [
			activeDiscussions,
			completedDiscussions,
			totalMessages,
			groupMemberships,
			pendingInvitations,
		] = await Promise.all([
			// Active discussions participating in
			ctx.db.discussionParticipant.count({
				where: {
					userId,
					status: "ACTIVE",
					discussion: {
						isActive: true,
					},
				},
			}),
			// Completed discussions
			ctx.db.discussionParticipant.count({
				where: {
					userId,
					discussion: {
						isActive: false,
					},
				},
			}),
			// Total messages sent
			ctx.db.message.count({
				where: {
					authorId: userId,
				},
			}),
			// Group memberships
			ctx.db.groupMember.count({
				where: {
					userId,
					status: "ACTIVE",
				},
			}),
			// Pending invitations received
			ctx.db.invitation.count({
				where: {
					recipientEmail: ctx.session.user.email!,
					status: "PENDING",
					expiresAt: { gt: new Date() },
				},
			}),
		]);

		// Get recent discussions
		const recentDiscussions = await ctx.db.discussionParticipant.findMany({
			where: {
				userId,
				status: "ACTIVE",
			},
			take: 5,
			orderBy: { lastSeenAt: "desc" },
			include: {
				discussion: {
					select: {
						id: true,
						name: true,
						isActive: true,
						lesson: {
							select: {
								title: true,
							},
						},
						_count: {
							select: {
								messages: true,
								participants: {
									where: { status: "ACTIVE" },
								},
							},
						},
					},
				},
			},
		});

		return {
			stats: {
				discussions: {
					active: activeDiscussions,
					completed: completedDiscussions,
				},
				messages: totalMessages,
				groups: groupMemberships,
				pendingInvitations,
			},
			recentDiscussions: recentDiscussions.map((p) => p.discussion),
		};
	}),

	// Get active discussions for current user
	getActiveDiscussions: protectedProcedure
		.input(
			z.object({
				limit: z.number().min(1).max(20).default(10),
			}),
		)
		.query(async ({ ctx, input }) => {
			const discussions = await ctx.db.discussionParticipant.findMany({
				where: {
					userId: ctx.session.user.id,
					status: "ACTIVE",
					discussion: {
						isActive: true,
					},
				},
				take: input.limit,
				orderBy: { lastSeenAt: "desc" },
				include: {
					discussion: {
						include: {
							lesson: {
								select: {
									id: true,
									title: true,
									objectives: true,
								},
							},
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
									messages: true,
									participants: {
										where: { status: "ACTIVE" },
									},
								},
							},
						},
					},
				},
			});

			// Get unread message counts
			const discussionsWithUnread = await Promise.all(
				discussions.map(async (participant) => {
					const unreadCount = await ctx.db.message.count({
						where: {
							discussionId: participant.discussionId,
							createdAt: { gt: participant.lastSeenAt },
						},
					});

					return {
						...participant.discussion,
						unreadCount,
						myRole: participant.role,
						lastSeenAt: participant.lastSeenAt,
					};
				}),
			);

			return discussionsWithUnread;
		}),

	// Get upcoming scheduled discussions
	getUpcomingDiscussions: protectedProcedure
		.input(
			z.object({
				limit: z.number().min(1).max(20).default(10),
			}),
		)
		.query(async ({ ctx, input }) => {
			const now = new Date();
			const discussions = await ctx.db.discussionParticipant.findMany({
				where: {
					userId: ctx.session.user.id,
					status: "ACTIVE",
					discussion: {
						isActive: true,
						scheduledFor: {
							gt: now,
						},
					},
				},
				take: input.limit,
				orderBy: {
					discussion: {
						scheduledFor: "asc",
					},
				},
				include: {
					discussion: {
						include: {
							lesson: {
								select: {
									id: true,
									title: true,
								},
							},
							creator: {
								select: {
									name: true,
									email: true,
								},
							},
							_count: {
								select: {
									participants: {
										where: { status: "ACTIVE" },
									},
								},
							},
						},
					},
				},
			});

			return discussions.map((p) => ({
				...p.discussion,
				myRole: p.role,
			}));
		}),

	// Get recent activity feed
	getRecentActivity: protectedProcedure
		.input(
			z.object({
				limit: z.number().min(1).max(50).default(20),
				offset: z.number().min(0).default(0),
			}),
		)
		.query(async ({ ctx, input }) => {
			// Get discussions user is participating in
			const userDiscussions = await ctx.db.discussionParticipant.findMany({
				where: {
					userId: ctx.session.user.id,
					status: "ACTIVE",
				},
				select: {
					discussionId: true,
				},
			});

			const discussionIds = userDiscussions.map((d) => d.discussionId);

			// Get recent messages from those discussions
			const [messages, total] = await Promise.all([
				ctx.db.message.findMany({
					where: {
						discussionId: { in: discussionIds },
					},
					take: input.limit,
					skip: input.offset,
					orderBy: { createdAt: "desc" },
					include: {
						author: {
							select: {
								id: true,
								name: true,
								email: true,
								image: true,
							},
						},
						discussion: {
							select: {
								id: true,
								name: true,
							},
						},
						parent: {
							select: {
								id: true,
								content: true,
								author: {
									select: {
										name: true,
									},
								},
							},
						},
					},
				}),
				ctx.db.message.count({
					where: {
						discussionId: { in: discussionIds },
					},
				}),
			]);

			return {
				messages,
				total,
				hasMore: input.offset + input.limit < total,
			};
		}),

	// Get engagement metrics for a specific period
	getEngagementMetrics: protectedProcedure
		.input(
			z.object({
				days: z.number().min(1).max(90).default(7),
			}),
		)
		.query(async ({ ctx, input }) => {
			const startDate = new Date();
			startDate.setDate(startDate.getDate() - input.days);

			// Get metrics for the period
			const [
				messagesPerDay,
				activeUsersPerDay,
				newDiscussions,
				completedDiscussions,
			] = await Promise.all([
				// Messages sent per day
				ctx.db.message.groupBy({
					by: ["createdAt"],
					where: {
						createdAt: { gte: startDate },
						discussion: {
							participants: {
								some: {
									userId: ctx.session.user.id,
								},
							},
						},
					},
					_count: true,
				}),
				// Active users per day
				ctx.db.discussionParticipant.groupBy({
					by: ["lastSeenAt"],
					where: {
						lastSeenAt: { gte: startDate },
						discussion: {
							creatorId: ctx.session.user.id,
						},
					},
					_count: true,
				}),
				// New discussions created
				ctx.db.discussion.count({
					where: {
						createdAt: { gte: startDate },
						creatorId: ctx.session.user.id,
					},
				}),
				// Discussions completed
				ctx.db.discussion.count({
					where: {
						closedAt: { gte: startDate },
						creatorId: ctx.session.user.id,
					},
				}),
			]);

			// Process data for chart display
			const dailyMetrics: Record<
				string,
				{ messages: number; activeUsers: number }
			> = {};
			const currentDate = new Date(startDate);

			while (currentDate <= new Date()) {
				const dateKey = currentDate.toISOString().split("T")[0];
				if (dateKey) {
					dailyMetrics[dateKey] = {
						messages: 0,
						activeUsers: 0,
					};
				}
				currentDate.setDate(currentDate.getDate() + 1);
			}

			// Aggregate message counts
			messagesPerDay.forEach((item) => {
				const dateKey = item.createdAt.toISOString().split("T")[0];
				if (dateKey && dailyMetrics[dateKey]) {
					dailyMetrics[dateKey].messages = item._count;
				}
			});

			// Aggregate active user counts
			activeUsersPerDay.forEach((item) => {
				const dateKey = item.lastSeenAt.toISOString().split("T")[0];
				if (dateKey && dailyMetrics[dateKey]) {
					dailyMetrics[dateKey].activeUsers = item._count;
				}
			});

			return {
				period: {
					start: startDate,
					end: new Date(),
					days: input.days,
				},
				totals: {
					newDiscussions,
					completedDiscussions,
					totalMessages: messagesPerDay.reduce(
						(sum, item) => sum + item._count,
						0,
					),
					uniqueActiveUsers: activeUsersPerDay.length,
				},
				daily: Object.entries(dailyMetrics).map(([date, metrics]) => ({
					date,
					...metrics,
				})),
			};
		}),
});
