import { env } from "@/env";
import { db } from "@/server/db";
import type { Discussion, Lesson, Message } from "@prisma/client";
import { type FacilitationResponse, unifiedAIService } from "./ai-provider";

interface DiscussionContext {
	id: string;
	name: string;
	description?: string;
	lesson: {
		title: string;
		description?: string;
		objectives: string[];
		keyQuestions: string[];
		facilitationStyle: string;
		content?: string;
	};
	participants: Array<{
		id: string;
		name: string;
		role: "CREATOR" | "MODERATOR" | "PARTICIPANT";
	}>;
	recentMessages?: Array<{
		id: string;
		content: string;
		authorName?: string;
		type: "USER" | "MODERATOR" | "AI_QUESTION" | "AI_PROMPT" | "SYSTEM";
		createdAt: Date;
	}>;
	messageCount: number;
	duration: string; // e.g., "45 minutes"
}

interface AIFacilitationRequest {
	discussionContext: DiscussionContext;
	facilitationGoal:
		| "START_DISCUSSION"
		| "ENCOURAGE_PARTICIPATION"
		| "DEEPEN_ANALYSIS"
		| "SUMMARIZE_POINTS"
		| "GUIDE_REFLECTION"
		| "HANDLE_CONFLICT"
		| "WRAP_UP";
	specificContext?: string;
	replyToMessageId?: string;
	userPrompt?: string;
}

interface AIResponse {
	content: string;
	type: "AI_QUESTION" | "AI_PROMPT";
	suggestedFollowUps?: string[];
	facilitationStrategy: string;
	confidence: number; // 0-1
}

interface AIConfig {
	model: string;
	temperature: number;
	maxTokens: number;
}

const DEFAULT_AI_CONFIG: AIConfig = {
	model: "gpt-4",
	temperature: 0.7,
	maxTokens: 500,
};

export class AIFacilitatorService {
	/**
	 * Generate AI-facilitated response for a discussion
	 */
	async generateResponse(
		request: AIFacilitationRequest,
		config: Partial<AIConfig> = {},
	): Promise<AIResponse> {
		const finalConfig = { ...DEFAULT_AI_CONFIG, ...config };

		try {
			const systemPrompt = this.buildSystemPrompt(request.discussionContext);
			const userPrompt = this.buildUserPrompt(request);

			const response = await unifiedAIService.generateFacilitationResponse(
				systemPrompt,
				userPrompt,
				{
					temperature: finalConfig.temperature,
					maxTokens: finalConfig.maxTokens,
				},
			);

			// Validate and sanitize the response
			let content = response.content;
			if (!content || content.length < 10) {
				throw new Error("AI response content too short or missing");
			}

			if (content.length > 1000) {
				content = `${content.substring(0, 997)}...`;
			}

			// Ensure valid type
			let type = response.type;
			if (!["AI_QUESTION", "AI_PROMPT"].includes(type)) {
				type = "AI_QUESTION";
			}

			// Ensure confidence is in valid range
			let confidence = response.confidence;
			if (typeof confidence !== "number" || confidence < 0 || confidence > 1) {
				confidence = 0.7;
			}

			return {
				content,
				type,
				suggestedFollowUps: response.suggestedFollowUps || [],
				facilitationStrategy: response.facilitationStrategy,
				confidence,
			};
		} catch (error) {
			console.error("AI Facilitator Error:", error);

			// Return fallback response
			return this.getFallbackResponse(
				request.facilitationGoal,
				request.discussionContext,
			);
		}
	}

	/**
	 * Generate multiple response options for facilitator to choose from
	 */
	async generateResponseOptions(
		request: AIFacilitationRequest,
		config: Partial<AIConfig> = {},
		optionCount = 3,
	): Promise<AIResponse[]> {
		const responses = await Promise.allSettled(
			Array.from({ length: optionCount }, () =>
				this.generateResponse(request, {
					...config,
					temperature: Math.min(
						(config.temperature || 0.7) + Math.random() * 0.2,
						1.0,
					),
				}),
			),
		);

		return responses
			.filter(
				(result): result is PromiseFulfilledResult<AIResponse> =>
					result.status === "fulfilled",
			)
			.map((result) => result.value)
			.slice(0, optionCount);
	}

	/**
	 * Analyze discussion dynamics and suggest interventions
	 */
	async analyzeDiscussionDynamics(context: DiscussionContext): Promise<{
		analysis: string;
		suggestions: Array<{
			type: AIFacilitationRequest["facilitationGoal"];
			description: string;
			urgency: "low" | "medium" | "high";
		}>;
		healthScore: number; // 0-1
	}> {
		try {
			const analysisPrompt = `
Analyze this discussion's dynamics and health:

Discussion: ${context.name}
Participants: ${context.participants.length}
Messages: ${context.messageCount}
Duration: ${context.duration}

Recent Messages:
${
	context.recentMessages
		?.slice(-5)
		.map(
			(msg) =>
				`${msg.authorName || "Anonymous"} (${msg.type}): ${msg.content.substring(0, 100)}`,
		)
		.join("\n") || "No recent messages"
}

Based on educational best practices, analyze:
1. Participation levels
2. Quality of discourse
3. Alignment with learning objectives
4. Need for interventions

Provide specific, actionable suggestions.
			`;

			const analysis = await unifiedAIService.generateText({
				system:
					"You are an educational facilitator analyzing discussion dynamics. Provide concrete, actionable insights.",
				prompt: analysisPrompt,
				config: {
					temperature: 0.3,
					maxTokens: 600,
				},
			});

			// Generate suggestions based on context
			const suggestions = this.generateDynamicSuggestions(context);

			// Calculate health score based on various factors
			const healthScore = this.calculateDiscussionHealthScore(context);

			return {
				analysis,
				suggestions,
				healthScore,
			};
		} catch (error) {
			console.error("Discussion analysis error:", error);

			return {
				analysis: "Unable to analyze discussion at this time.",
				suggestions: [
					{
						type: "ENCOURAGE_PARTICIPATION",
						description: "Check on quiet participants",
						urgency: "medium",
					},
				],
				healthScore: 0.5,
			};
		}
	}

	private buildSystemPrompt(context: DiscussionContext): string {
		return `
You are an expert educational facilitator specializing in ${context.lesson.facilitationStyle} learning. 

CONTEXT:
- Discussion: "${context.name}"
- Lesson: "${context.lesson.title}"
- Facilitation Style: ${context.lesson.facilitationStyle}
- Participants: ${context.participants.length}

LESSON OBJECTIVES:
${context.lesson.objectives.map((obj, i) => `${i + 1}. ${obj}`).join("\n")}

KEY QUESTIONS TO EXPLORE:
${context.lesson.keyQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

FACILITATION PRINCIPLES:
- Use Socratic questioning to guide discovery
- Encourage critical thinking and evidence-based reasoning
- Foster inclusive participation from all learners
- Build on participants' contributions constructively
- Guide toward deeper understanding of concepts
- Connect ideas to real-world applications
- Maintain focus on learning objectives

RESPONSE GUIDELINES:
- Keep responses concise but thought-provoking (50-200 words)
- Ask open-ended questions that stimulate analysis
- Acknowledge and build upon participant contributions
- Encourage evidence-based reasoning
- Help participants make connections between ideas
- Guide reflection on assumptions and implications

TONE: Encouraging, curious, intellectually rigorous but supportive.
		`;
	}

	private buildUserPrompt(request: AIFacilitationRequest): string {
		const { discussionContext, facilitationGoal, specificContext, userPrompt } =
			request;

		let prompt = `FACILITATION GOAL: ${facilitationGoal}\n\n`;

		// Add recent message context
		if (
			discussionContext.recentMessages &&
			discussionContext.recentMessages.length > 0
		) {
			prompt += "RECENT DISCUSSION:\n";
			for (const msg of discussionContext.recentMessages.slice(-3)) {
				prompt += `${msg.authorName || "Anonymous"}: "${msg.content}"\n`;
			}
			prompt += "\n";
		}

		// Add specific context if provided
		if (specificContext) {
			prompt += `SPECIFIC CONTEXT: ${specificContext}\n\n`;
		}

		// Add user prompt if provided
		if (userPrompt) {
			prompt += `FACILITATOR REQUEST: ${userPrompt}\n\n`;
		}

		// Add goal-specific instructions
		prompt += this.getGoalSpecificInstructions(facilitationGoal);

		return prompt;
	}

	private getGoalSpecificInstructions(
		goal: AIFacilitationRequest["facilitationGoal"],
	): string {
		switch (goal) {
			case "START_DISCUSSION":
				return "Generate an engaging opening question or prompt that connects to participants' experiences and introduces the key concepts. Make it accessible but thought-provoking.";

			case "ENCOURAGE_PARTICIPATION":
				return "Create a welcoming invitation for quieter participants to share their thoughts. Acknowledge different perspectives and make participation feel safe and valued.";

			case "DEEPEN_ANALYSIS":
				return "Ask probing questions that push participants to examine assumptions, consider evidence, explore implications, or make connections to broader concepts.";

			case "SUMMARIZE_POINTS":
				return "Synthesize the key insights shared so far and highlight important themes or patterns. Help participants see how their contributions connect.";

			case "GUIDE_REFLECTION":
				return "Prompt participants to reflect on what they've learned, how their thinking has changed, or how they might apply insights to their own context.";

			case "HANDLE_CONFLICT":
				return "Acknowledge different viewpoints respectfully and guide the discussion toward productive dialogue. Focus on understanding different perspectives rather than winning arguments.";

			case "WRAP_UP":
				return "Help participants consolidate their learning by identifying key takeaways, unresolved questions worth further exploration, and connections to future learning.";

			default:
				return "Provide thoughtful facilitation that advances learning and keeps participants engaged with the material.";
		}
	}

	private getFallbackResponse(
		goal: AIFacilitationRequest["facilitationGoal"],
		context: DiscussionContext,
	): AIResponse {
		const fallbacks = {
			START_DISCUSSION: {
				content:
					"Let's begin by exploring your initial thoughts on this topic. What experiences or insights do you bring to this discussion?",
				type: "AI_QUESTION" as const,
				facilitationStrategy: "Opening with personal connection",
			},
			ENCOURAGE_PARTICIPATION: {
				content:
					"We'd love to hear from everyone. What questions or thoughts are coming up for you as you listen to this discussion?",
				type: "AI_QUESTION" as const,
				facilitationStrategy: "Inclusive invitation to participate",
			},
			DEEPEN_ANALYSIS: {
				content:
					"That's an interesting point. What evidence or examples support that perspective? Are there alternative ways to look at this?",
				type: "AI_QUESTION" as const,
				facilitationStrategy: "Socratic questioning for deeper analysis",
			},
			SUMMARIZE_POINTS: {
				content:
					"I'm hearing several important themes emerging. Let's take a moment to reflect on what we've discovered together so far.",
				type: "AI_PROMPT" as const,
				facilitationStrategy: "Consolidating learning",
			},
			GUIDE_REFLECTION: {
				content:
					"How has this discussion changed or reinforced your thinking about this topic? What new questions are emerging for you?",
				type: "AI_QUESTION" as const,
				facilitationStrategy: "Metacognitive reflection",
			},
			HANDLE_CONFLICT: {
				content:
					"I'm noticing different perspectives here, which is valuable for learning. Let's explore what we can learn from these different viewpoints.",
				type: "AI_PROMPT" as const,
				facilitationStrategy: "Reframing conflict as learning opportunity",
			},
			WRAP_UP: {
				content:
					"As we conclude, what are the most important insights you'll take away from this discussion? What questions remain for further exploration?",
				type: "AI_QUESTION" as const,
				facilitationStrategy: "Learning consolidation and future inquiry",
			},
		};

		const fallback = fallbacks[goal] || fallbacks.ENCOURAGE_PARTICIPATION;

		return {
			...fallback,
			suggestedFollowUps: [
				"How does this connect to your own experience?",
				"What questions does this raise for you?",
				"Can you elaborate on that point?",
			],
			confidence: 0.6,
		};
	}

	private generateDynamicSuggestions(context: DiscussionContext): Array<{
		type: AIFacilitationRequest["facilitationGoal"];
		description: string;
		urgency: "low" | "medium" | "high";
	}> {
		const suggestions = [];

		// Check participation levels
		const participantCount = context.participants.length;
		const messagesPerParticipant =
			context.messageCount / Math.max(participantCount, 1);

		if (messagesPerParticipant < 2) {
			suggestions.push({
				type: "ENCOURAGE_PARTICIPATION" as const,
				description: "Low participation detected - encourage more engagement",
				urgency: "high" as const,
			});
		}

		// Check discussion depth based on message count and duration
		if (
			context.messageCount > 20 &&
			!context.recentMessages?.some((m) => m.type === "AI_QUESTION")
		) {
			suggestions.push({
				type: "DEEPEN_ANALYSIS" as const,
				description: "Discussion is active - guide toward deeper analysis",
				urgency: "medium" as const,
			});
		}

		// Check if discussion needs direction
		if (context.messageCount < 5) {
			suggestions.push({
				type: "START_DISCUSSION" as const,
				description: "Discussion needs momentum - provide engaging prompt",
				urgency: "high" as const,
			});
		}

		return suggestions;
	}

	private calculateDiscussionHealthScore(context: DiscussionContext): number {
		let score = 0.5; // Base score

		// Factor in participation
		const avgMessagesPerParticipant =
			context.messageCount / Math.max(context.participants.length, 1);
		if (avgMessagesPerParticipant > 3) score += 0.2;
		if (avgMessagesPerParticipant > 5) score += 0.1;

		// Factor in message types diversity
		const messageTypes = new Set(
			context.recentMessages?.map((m) => m.type) || [],
		);
		if (messageTypes.has("USER") && messageTypes.has("AI_QUESTION"))
			score += 0.1;
		if (messageTypes.has("MODERATOR")) score += 0.1;

		// Factor in recent activity
		const recentMessageCount = context.recentMessages?.length || 0;
		if (recentMessageCount >= 3) score += 0.1;

		return Math.min(Math.max(score, 0), 1);
	}

	/**
	 * Simple on-demand trigger for admin UI
	 */
	static async triggerOnDemandResponse(
		discussionId: string,
		options?: {
			forcePrompt?: boolean;
			promptType?: "opening" | "continuation" | "custom";
			customPrompt?: string;
		},
	): Promise<{ success: boolean; message?: string; error?: string }> {
		try {
			// Get discussion with relations
			const discussion = await db.discussion.findUnique({
				where: { id: discussionId, isActive: true },
				include: {
					lesson: true,
					messages: {
						orderBy: { createdAt: "desc" },
						take: 10,
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
				return { success: false, error: "Discussion not found or inactive" };
			}

			// Generate simple prompt based on discussion state
			let prompt: string;
			if (options?.customPrompt) {
				prompt = options.customPrompt;
			} else {
				const type =
					options?.promptType === "custom" ? undefined : options?.promptType;
				prompt = AIFacilitatorService.generateSimplePrompt(discussion, type);
			}

			if (!prompt) {
				return {
					success: false,
					error: "Could not generate facilitator prompt",
				};
			}

			// Create AI facilitator message
			await db.message.create({
				data: {
					discussionId: discussion.id,
					content: prompt,
					senderName: "AI Facilitator",
					senderType: "SYSTEM",
					type: "AI_QUESTION",
				},
			});

			return {
				success: true,
				message: `AI facilitator response sent: "${prompt.substring(0, 50)}..."`,
			};
		} catch (error) {
			console.error("AI Facilitator On-Demand Service error:", error);
			return {
				success: false,
				error:
					error instanceof Error ? error.message : "Unknown error occurred",
			};
		}
	}

	static async checkAndTriggerInactiveDiscussions(): Promise<{
		discussionsChecked: number;
		interventionsTriggered: number;
	}> {
		// Find active discussions that might need facilitator intervention
		const activeDiscussions = await db.discussion.findMany({
			where: {
				isActive: true,
				OR: [
					{ participants: { some: {} } },
					{ anonymousParticipants: { some: {} } },
				],
			},
			include: {
				lesson: true,
				messages: {
					orderBy: { createdAt: "desc" },
					take: 10,
				},
				_count: {
					select: {
						participants: true,
						anonymousParticipants: true,
					},
				},
			},
		});

		let interventionsTriggered = 0;

		for (const discussion of activeDiscussions) {
			try {
				const shouldIntervene =
					await AIFacilitatorService.checkIfInterventionNeeded(discussion);
				if (shouldIntervene) {
					const result = await AIFacilitatorService.triggerOnDemandResponse(
						discussion.id,
					);
					if (result.success) {
						interventionsTriggered++;
					}
				}
			} catch (error) {
				console.error(`Error processing discussion ${discussion.id}:`, error);
			}
		}

		return {
			discussionsChecked: activeDiscussions.length,
			interventionsTriggered,
		};
	}

	private static async checkIfInterventionNeeded(
		discussion: any,
	): Promise<boolean> {
		const config = AIFacilitatorService.getFacilitatorConfig(discussion);

		if (!config.enabled) {
			return false;
		}

		// Check if discussion has any participants
		const totalParticipants =
			discussion._count.participants + discussion._count.anonymousParticipants;
		if (totalParticipants === 0) {
			return false;
		}

		// Get the last message timestamp
		const lastMessage = discussion.messages[0];
		if (!lastMessage) {
			// No messages yet - trigger intervention if discussion is more than 5 minutes old
			const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
			return discussion.createdAt < fiveMinutesAgo;
		}

		// Check inactivity threshold
		const thresholdDate = new Date(
			Date.now() - config.inactivityThresholdMinutes * 60 * 1000,
		);
		const isInactive = lastMessage.createdAt < thresholdDate;

		if (!isInactive) {
			return false;
		}

		// Check if we should throttle prompts
		return !(await AIFacilitatorService.shouldThrottlePrompts(
			discussion,
			config,
		));
	}

	private static getFacilitatorConfig(discussion: any) {
		const defaultConfig = {
			enabled: true,
			inactivityThresholdMinutes: 10,
			maxPrompts: 3,
			promptInterval: 30,
			facilitationStyle: discussion.lesson?.facilitationStyle || "exploratory",
		};

		try {
			const aiConfig = discussion.aiConfig as any;
			return {
				...defaultConfig,
				...aiConfig?.facilitator,
			};
		} catch {
			return defaultConfig;
		}
	}

	private static async shouldThrottlePrompts(
		discussion: any,
		config: any,
	): Promise<boolean> {
		// Check if we've already sent too many AI prompts recently
		const recentAIMessages = discussion.messages.filter(
			(msg: any) =>
				msg.senderType === "SYSTEM" &&
				(msg.type === "AI_QUESTION" || msg.type === "AI_PROMPT") &&
				msg.createdAt >
					new Date(Date.now() - config.promptInterval * 60 * 1000),
		);

		return recentAIMessages.length >= config.maxPrompts;
	}

	private static generateSimplePrompt(
		discussion: any,
		promptType?: "opening" | "continuation",
	): string {
		const messageCount = discussion.messages.length;
		const hasLesson = !!discussion.lesson;

		const resolvedPromptType =
			promptType ?? (messageCount === 0 ? "opening" : "continuation");

		if (resolvedPromptType === "opening") {
			if (hasLesson && discussion.lesson.keyQuestions?.length) {
				const questions = discussion.lesson.keyQuestions;
				const randomQuestion =
					questions[Math.floor(Math.random() * questions.length)];
				return `Welcome to "${discussion.name}"! Let's begin by exploring: ${randomQuestion}`;
			}
			return `Welcome to "${discussion.name}"! What brings you to this discussion today?`;
		}
		// Continuation prompts
		const facilitationStyle =
			discussion.lesson?.facilitationStyle || "exploratory";

		if (facilitationStyle === "analytical") {
			const prompts = [
				"What evidence supports the points we've discussed?",
				"Can we identify the underlying assumptions in our reasoning?",
				"What are the strongest and weakest aspects of the arguments presented?",
			];
			return prompts[Math.floor(Math.random() * prompts.length)] ?? prompts[0]!;
		}
		if (facilitationStyle === "ethical") {
			const prompts = [
				"What ethical considerations are at stake in this discussion?",
				"Who might be affected by the ideas we're exploring?",
				"What values seem to be in tension here?",
			];
			return prompts[Math.floor(Math.random() * prompts.length)] ?? prompts[0]!;
		}
		const prompts = [
			"What new perspectives have emerged from our conversation so far?",
			"What questions are arising for you as we discuss this?",
			"How might someone with a different background view this issue?",
		];
		return prompts[Math.floor(Math.random() * prompts.length)] ?? prompts[0]!;
	}
}

// Export singleton instance
export const aiService = new AIFacilitatorService();
