import type { Session } from "next-auth";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	cleanupDatabase,
	createTestCaller,
	createTestUser,
	testDb,
} from "../db-setup";

describe("AI Facilitation Flow Integration Test", () => {
	let testUser: Awaited<ReturnType<typeof createTestUser>>;
	let participant: Awaited<ReturnType<typeof createTestUser>>;
	let testSession: Session;
	let participantSession: Session;
	let caller: Awaited<ReturnType<typeof createTestCaller>>;
	let participantCaller: Awaited<ReturnType<typeof createTestCaller>>;

	beforeEach(async () => {
		await cleanupDatabase();
		testUser = await createTestUser();
		participant = await createTestUser();

		testSession = {
			user: { id: testUser.id, email: testUser.email, name: testUser.name },
			expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		};

		participantSession = {
			user: {
				id: participant.id,
				email: participant.email,
				name: participant.name,
			},
			expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		};

		caller = await createTestCaller(testSession);
		participantCaller = await createTestCaller(participantSession);
	});

	afterEach(async () => {
		await cleanupDatabase();
	});

	it("should provide AI-guided facilitation throughout discussion", async () => {
		// Step 1: Create a lesson with specific objectives and questions
		const lesson = await testDb.lesson.create({
			data: {
				title: "Critical Thinking in Daily Life",
				description:
					"Explore how to apply critical thinking to everyday situations",
				content:
					"This lesson focuses on developing practical critical thinking skills.",
				objectives: [
					"Identify common logical fallacies",
					"Evaluate evidence quality",
					"Distinguish between facts and opinions",
					"Apply systematic thinking to problems",
				],
				keyQuestions: [
					"What assumptions are we making?",
					"What evidence supports this claim?",
					"Are there alternative explanations?",
					"What are the implications of this conclusion?",
				],
				facilitationStyle: "socratic",
				suggestedDuration: 60,
				suggestedGroupSize: 6,
				creatorId: testUser.id,
				isPublished: true,
			},
		});

		// Step 2: Create discussion with AI configuration
		const discussion = await caller.discussion.create({
			lessonId: lesson.id,
			name: "Critical Thinking Workshop - Evening Session",
			description:
				"AI-facilitated discussion on critical thinking applications",
			maxParticipants: 8,
			isPublic: false,
			aiConfig: {
				model: "gpt-4",
				temperature: 0.7,
				maxTokens: 500,
			},
		});

		// Step 3: Add participants
		const { joinCode } = await caller.discussion.generateJoinCode({
			discussionId: discussion.id,
		});
		await participantCaller.discussion.join({ joinCode });

		// Step 4: Send initial user message
		const userMessage = await participantCaller.message.send({
			discussionId: discussion.id,
			content:
				"I often struggle to evaluate news articles. How can I tell if a source is reliable?",
		});

		// Step 5: Request AI response based on discussion context
		const aiResponse = await caller.message.getAIResponse({
			discussionId: discussion.id,
			context: "User is asking about evaluating news sources for reliability",
		});

		expect(aiResponse).toMatchObject({
			message: expect.objectContaining({
				id: expect.any(String),
				discussionId: discussion.id,
				content: expect.any(String),
				type: expect.stringMatching(/^(AI_QUESTION|AI_PROMPT)$/),
				authorId: null, // AI messages have no human author
				createdAt: expect.any(Date),
			}),
		});

		// AI should provide educational content
		expect(aiResponse.message.content.length).toBeGreaterThan(50);

		// Should include suggested follow-ups
		if (aiResponse.suggestedFollowUps) {
			expect(aiResponse.suggestedFollowUps.length).toBeGreaterThan(0);
			aiResponse.suggestedFollowUps.forEach((followUp) => {
				expect(typeof followUp).toBe("string");
				expect(followUp.length).toBeGreaterThan(10);
			});
		}

		// Step 6: User responds to AI guidance
		const userResponse = await participantCaller.message.send({
			discussionId: discussion.id,
			content: "That's helpful! What about checking the author's credentials?",
			parentId: aiResponse.message.id,
		});

		// Step 7: AI provides targeted response to specific question
		const targetedAI = await caller.message.getAIResponse({
			discussionId: discussion.id,
			replyToId: userResponse.id,
			context:
				"User asking about author credentials as part of source evaluation",
		});

		expect(targetedAI.message).toMatchObject({
			parentId: userResponse.id,
			type: expect.stringMatching(/^(AI_QUESTION|AI_PROMPT)$/),
		});

		// Step 8: Facilitate deeper discussion
		const facilitatorMessage = await caller.message.send({
			discussionId: discussion.id,
			content:
				"Great questions! Let's explore this further. Can someone share a recent example where they had to evaluate conflicting information?",
			type: "MODERATOR",
		});

		// Step 9: Get AI suggestions for the facilitator
		const facilitationGuidance = await caller.message.getAIResponse({
			discussionId: discussion.id,
			context:
				"Discussion is progressing well on source evaluation. Participants are engaged. Need suggestions for keeping momentum and exploring deeper concepts.",
		});

		expect(facilitationGuidance.message.type).toMatch(
			/^(AI_QUESTION|AI_PROMPT)$/,
		);

		// Step 10: Verify AI responses integrate with lesson objectives
		const allMessages = await caller.message.list({
			discussionId: discussion.id,
			limit: 20,
		});

		const aiMessages = allMessages.messages.filter(
			(m) => m.type === "AI_QUESTION" || m.type === "AI_PROMPT",
		);

		expect(aiMessages.length).toBeGreaterThan(0);

		// AI messages should be contextually relevant
		aiMessages.forEach((message) => {
			expect(message.authorId).toBeNull();
			expect(message.content.length).toBeGreaterThan(20);
		});

		// Step 11: Test AI response to group dynamics
		const groupDynamicsAI = await caller.message.getAIResponse({
			discussionId: discussion.id,
			context:
				"Some participants seem quiet. Need to encourage more participation and ensure everyone feels included.",
		});

		expect(groupDynamicsAI.message.content).toBeDefined();

		// Step 12: List all messages to see conversation flow
		const finalMessageList = await caller.message.list({
			discussionId: discussion.id,
			limit: 50,
		});

		expect(finalMessageList.messages.length).toBeGreaterThan(5);

		// Should have a mix of user, moderator, and AI messages
		const messageTypes = finalMessageList.messages.map((m) => m.type);
		expect(messageTypes).toContain("USER");
		expect(messageTypes).toContain("MODERATOR");
		expect(
			messageTypes.some(
				(type) => type === "AI_QUESTION" || type === "AI_PROMPT",
			),
		).toBe(true);
	});

	it("should adapt AI responses based on lesson content and objectives", async () => {
		// Create lesson with different facilitation style
		const lesson = await testDb.lesson.create({
			data: {
				title: "Ethical Decision Making",
				content:
					"Explore frameworks for making ethical decisions in complex situations",
				objectives: [
					"Understand different ethical frameworks",
					"Apply ethical reasoning to real scenarios",
					"Consider stakeholder perspectives",
				],
				keyQuestions: [
					"Who are the stakeholders affected?",
					"What ethical principles apply?",
					"What are the long-term consequences?",
				],
				facilitationStyle: "collaborative",
				creatorId: testUser.id,
				isPublished: true,
			},
		});

		const discussion = await caller.discussion.create({
			lessonId: lesson.id,
			name: "Ethics in Technology",
			maxParticipants: 6,
			aiConfig: {
				model: "gpt-4",
				temperature: 0.8, // Higher creativity for ethics discussions
				maxTokens: 600,
			},
		});

		// Add participant and start discussion
		const { joinCode } = await caller.discussion.generateJoinCode({
			discussionId: discussion.id,
		});
		await participantCaller.discussion.join({ joinCode });

		const userMessage = await participantCaller.message.send({
			discussionId: discussion.id,
			content:
				"Is it ethical for companies to use AI to make hiring decisions?",
		});

		// AI should adapt to the ethical context
		const ethicsAI = await caller.message.getAIResponse({
			discussionId: discussion.id,
			context: "Discussion about AI ethics in hiring practices",
		});

		expect(ethicsAI.message.content).toBeDefined();
		expect(ethicsAI.message.type).toMatch(/^(AI_QUESTION|AI_PROMPT)$/);

		// Response should be relevant to ethics and decision-making
		const content = ethicsAI.message.content.toLowerCase();
		const ethicsKeywords = [
			"stakeholder",
			"consequence",
			"fair",
			"bias",
			"principle",
			"framework",
			"perspective",
			"impact",
			"justice",
			"equality",
		];

		const hasEthicsContent = ethicsKeywords.some((keyword) =>
			content.includes(keyword),
		);
		expect(hasEthicsContent).toBe(true);
	});

	it("should handle AI facilitation errors gracefully", async () => {
		// Setup basic discussion
		const lesson = await testDb.lesson.create({
			data: {
				title: "Test Lesson",
				content: "Test content",
				objectives: ["Test objective"],
				keyQuestions: ["Test question?"],
				facilitationStyle: "socratic",
				creatorId: testUser.id,
				isPublished: true,
			},
		});

		const discussion = await caller.discussion.create({
			lessonId: lesson.id,
			name: "Test Discussion",
			maxParticipants: 5,
		});

		// Test with minimal context
		const minimalAI = await caller.message.getAIResponse({
			discussionId: discussion.id,
		});

		expect(minimalAI.message).toBeDefined();
		expect(minimalAI.message.type).toMatch(/^(AI_QUESTION|AI_PROMPT)$/);

		// Test with empty context
		const emptyContextAI = await caller.message.getAIResponse({
			discussionId: discussion.id,
			context: "",
		});

		expect(emptyContextAI.message).toBeDefined();

		// Test AI response to non-existent message
		await expect(
			caller.message.getAIResponse({
				discussionId: discussion.id,
				replyToId: "non-existent-message-id",
			}),
		).rejects.toThrow();

		// Test AI response for non-existent discussion
		await expect(
			caller.message.getAIResponse({
				discussionId: "non-existent-discussion-id",
			}),
		).rejects.toThrow();
	});

	it("should provide contextual AI responses based on discussion history", async () => {
		// Setup
		const lesson = await testDb.lesson.create({
			data: {
				title: "Problem Solving Techniques",
				content: "Learn systematic approaches to problem solving",
				objectives: ["Identify problem types", "Apply solving strategies"],
				keyQuestions: ["What is the root cause?", "What alternatives exist?"],
				facilitationStyle: "analytical",
				creatorId: testUser.id,
				isPublished: true,
			},
		});

		const discussion = await caller.discussion.create({
			lessonId: lesson.id,
			name: "Problem Solving Workshop",
			maxParticipants: 5,
		});

		const { joinCode } = await caller.discussion.generateJoinCode({
			discussionId: discussion.id,
		});
		await participantCaller.discussion.join({ joinCode });

		// Build up discussion history
		await participantCaller.message.send({
			discussionId: discussion.id,
			content: "I have a problem at work with team communication.",
		});

		await caller.message.send({
			discussionId: discussion.id,
			content: "Can you describe the specific communication issues?",
			type: "MODERATOR",
		});

		await participantCaller.message.send({
			discussionId: discussion.id,
			content:
				"People interrupt each other in meetings and important points get lost.",
		});

		// AI should provide contextual response based on the discussion so far
		const contextualAI = await caller.message.getAIResponse({
			discussionId: discussion.id,
			context:
				"Discussion has identified interruption and lost information as key communication problems in meetings",
		});

		expect(contextualAI.message.content).toBeDefined();
		expect(contextualAI.message.content.length).toBeGreaterThan(50);

		// Should include suggested follow-up questions or strategies
		expect(contextualAI.suggestedFollowUps).toBeDefined();

		// AI response should be relevant to the ongoing conversation
		const responseContent = contextualAI.message.content.toLowerCase();
		const relevantTerms = [
			"meeting",
			"communication",
			"interrupt",
			"structure",
			"facilitate",
		];
		const hasRelevantContent = relevantTerms.some((term) =>
			responseContent.includes(term),
		);
		expect(hasRelevantContent).toBe(true);
	});
});
