import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { AIFacilitatorService } from "@/server/services/ai-facilitator";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const aiFacilitatorRouter = createTRPCRouter({
	triggerResponse: protectedProcedure
		.input(
			z.object({
				discussionId: z.string(),
				promptType: z.enum(["opening", "continuation"]).optional(),
				customPrompt: z.string().optional(),
				forcePrompt: z.boolean().optional().default(false),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			try {
				// Verify user has permission to trigger AI facilitator for this discussion
				const discussion = await ctx.db.discussion.findUnique({
					where: { id: input.discussionId },
					select: {
						id: true,
						creatorId: true,
						name: true,
						isActive: true,
					},
				});

				if (!discussion) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Discussion not found",
					});
				}

				if (!discussion.isActive) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Cannot trigger AI facilitator for inactive discussion",
					});
				}

				// Only discussion creator can trigger AI facilitator
				if (discussion.creatorId !== ctx.session.user.id) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message:
							"Only the discussion creator can trigger AI facilitator responses",
					});
				}

				const result = await AIFacilitatorService.triggerOnDemandResponse(
					input.discussionId,
					{
						promptType: input.promptType,
						customPrompt: input.customPrompt,
						forcePrompt: input.forcePrompt,
					},
				);

				if (!result.success) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message:
							result.error || "Failed to trigger AI facilitator response",
					});
				}

				return {
					success: true,
					message: result.message,
				};
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}

				console.error("AI Facilitator trigger error:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to trigger AI facilitator response",
				});
			}
		}),

	getStatus: protectedProcedure
		.input(z.object({ discussionId: z.string() }))
		.query(async ({ input, ctx }) => {
			try {
				const discussion = await ctx.db.discussion.findUnique({
					where: { id: input.discussionId },
					select: {
						id: true,
						creatorId: true,
						aiConfig: true,
						isActive: true,
						messages: {
							where: {
								senderType: "SYSTEM",
								type: { in: ["AI_QUESTION", "AI_PROMPT"] },
							},
							orderBy: { createdAt: "desc" },
							take: 5,
							select: {
								id: true,
								content: true,
								createdAt: true,
								type: true,
							},
						},
						_count: {
							select: {
								participants: true,
								anonymousParticipants: true,
							},
						},
					},
				});

				if (!discussion) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Discussion not found",
					});
				}

				// Only discussion creator can view AI facilitator status
				if (discussion.creatorId !== ctx.session.user.id) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message:
							"Only the discussion creator can view AI facilitator status",
					});
				}

				// Parse AI config
				let facilitatorConfig = {
					enabled: true,
					inactivityThresholdMinutes: 10,
					maxPrompts: 3,
					promptInterval: 30,
				};

				try {
					const aiConfig = discussion.aiConfig as any;
					if (aiConfig?.facilitator) {
						facilitatorConfig = {
							...facilitatorConfig,
							...aiConfig.facilitator,
						};
					}
				} catch {
					// Use defaults
				}

				const totalParticipants =
					discussion._count.participants +
					discussion._count.anonymousParticipants;
				const recentAIMessages = discussion.messages;

				// Check if we can trigger more prompts (throttling)
				const recentMessages = recentAIMessages.filter(
					(msg) =>
						msg.createdAt >
						new Date(Date.now() - facilitatorConfig.promptInterval * 60 * 1000),
				);
				const canTriggerMore =
					recentMessages.length < facilitatorConfig.maxPrompts;

				return {
					isActive: discussion.isActive,
					facilitatorConfig,
					totalParticipants,
					recentAIMessages: recentAIMessages.map((msg) => ({
						id: msg.id,
						content:
							msg.content.substring(0, 100) +
							(msg.content.length > 100 ? "..." : ""),
						createdAt: msg.createdAt,
						type: msg.type,
					})),
					canTriggerMore,
					nextAllowedTrigger:
						recentMessages.length >= facilitatorConfig.maxPrompts
							? new Date(
									Date.now() + facilitatorConfig.promptInterval * 60 * 1000,
								)
							: null,
				};
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}

				console.error("AI Facilitator status error:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to get AI facilitator status",
				});
			}
		}),
});
