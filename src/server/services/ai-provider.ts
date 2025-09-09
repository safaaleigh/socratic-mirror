import { env } from "@/env";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { type LanguageModel, generateObject, generateText } from "ai";
import { createOllama } from "ollama-ai-provider-v2";
import { z } from "zod";

// Zod schema for AI facilitation responses
export const facilitationResponseSchema = z.object({
	content: z
		.string()
		.describe("The facilitation content/question to share with participants"),
	type: z
		.enum(["AI_QUESTION", "AI_PROMPT"])
		.describe(
			"Whether this is a question to stimulate thinking or a prompt to guide discussion",
		),
	suggestedFollowUps: z
		.array(z.string())
		.max(3)
		.optional()
		.describe("Optional follow-up questions or prompts"),
	facilitationStrategy: z
		.string()
		.describe("Brief explanation of the pedagogical strategy used"),
	confidence: z
		.number()
		.min(0)
		.max(1)
		.describe("Confidence in the appropriateness of this response"),
});

export type FacilitationResponse = z.infer<typeof facilitationResponseSchema>;

export interface AIProviderConfig {
	temperature?: number;
	maxTokens?: number;
}

export interface GenerateTextParams {
	system: string;
	prompt: string;
	config?: AIProviderConfig;
}

export interface GenerateObjectParams extends GenerateTextParams {
	schema: z.ZodSchema;
}

export class UnifiedAIService {
	private model: LanguageModel;
	private providerType: string;

	constructor() {
		const { model, type } = this.getProviderConfig();
		this.model = model;
		this.providerType = type;
	}

	private getProviderConfig() {
		const providerType = env.AI_PROVIDER;
		const modelName = env.AI_MODEL;

		switch (providerType) {
			case "ollama": {
				const ollamaProvider = createOllama({
					baseURL: `${env.OLLAMA_BASE_URL}/api`,
				});
				return {
					provider: ollamaProvider,
					model: ollamaProvider(modelName),
					type: "ollama" as const,
				};
			}
			case "anthropic":
				if (!env.ANTHROPIC_API_KEY) {
					throw new Error(
						"ANTHROPIC_API_KEY is required when using Anthropic provider",
					);
				}
				return {
					provider: anthropic,
					model: anthropic(modelName),
					type: "anthropic" as const,
				};
			default:
				if (!env.OPENAI_API_KEY) {
					throw new Error(
						"OPENAI_API_KEY is required when using OpenAI provider",
					);
				}
				return {
					provider: openai,
					model: openai(modelName),
					type: "openai" as const,
				};
		}
	}

	async generateText(params: GenerateTextParams): Promise<string> {
		try {
			const result = await generateText({
				model: this.model,
				system: params.system,
				prompt: params.prompt,
				temperature: params.config?.temperature || 0.7,
			});

			return result.text;
		} catch (error) {
			console.error(`AI text generation error (${this.providerType}):`, error);
			throw new Error(
				`Failed to generate text using ${this.providerType} provider`,
			);
		}
	}

	async generateObject<T>(params: GenerateObjectParams): Promise<T> {
		// For Ollama models, skip native structured generation and use fallback directly
		// as most local models don't support JSON schema generation reliably
		if (this.providerType === "ollama") {
			console.log(
				`Using fallback JSON generation for ${this.providerType} (gpt-oss:20b doesn't support native structured output)`,
			);
			return this.fallbackJsonGeneration<T>(params);
		}

		// For cloud providers (OpenAI, Anthropic), try native structured generation first
		try {
			const result = await generateObject({
				model: this.model,
				system: params.system,
				prompt: params.prompt,
				schema: params.schema,
				temperature: params.config?.temperature || 0.7,
			});

			return result.object as T;
		} catch (error) {
			console.error(
				`AI structured generation failed (${this.providerType}):`,
				error,
			);
			console.log(
				`Attempting fallback JSON parsing for ${this.providerType}...`,
			);
			return this.fallbackJsonGeneration<T>(params);
		}
	}

	private async fallbackJsonGeneration<T>(
		params: GenerateObjectParams,
	): Promise<T> {
		// Convert Zod schema to a more readable description
		const schemaDescription = this.describeSchema(params.schema);

		const jsonPrompt = `${params.prompt}

Please respond with ONLY a valid JSON object with these fields:
${schemaDescription}

Important: Respond with ONLY the JSON object, no explanatory text.`;

		try {
			const textResponse = await this.generateText({
				system: params.system,
				prompt: jsonPrompt,
				config: params.config,
			});

			// Try to extract and fix JSON from the response
			const jsonString = this.extractAndCleanJSON(textResponse);
			if (!jsonString) {
				throw new Error("No JSON object found in response");
			}

			let parsedObject: Record<string, unknown>;
			try {
				parsedObject = JSON.parse(jsonString);
			} catch (jsonError) {
				console.error("Initial JSON parse error:", jsonError);
				console.log(
					"Problematic JSON (first 1000 chars):",
					jsonString.slice(0, 1000),
				);
				console.log("Attempting to fix common JSON issues...");

				// Try to fix common JSON issues and retry
				const fixedJsonString = this.fixCommonJSONIssues(jsonString);

				try {
					parsedObject = JSON.parse(fixedJsonString);
					console.log("Successfully parsed JSON after fixes");
				} catch (retryError) {
					console.error("JSON parse failed even after fixes:", retryError);
					console.log(
						"Fixed JSON (first 1000 chars):",
						fixedJsonString.slice(0, 1000),
					);
					throw new Error(
						`JSON parsing failed: ${retryError instanceof Error ? retryError.message : String(retryError)}`,
					);
				}
			}

			// Validate and sanitize the response for facilitation schema
			if (params.schema === facilitationResponseSchema) {
				parsedObject =
					this.validateAndSanitizeFacilitationResponse(parsedObject);
			}

			// Basic validation that required fields exist
			const requiredFields = (params.schema as { required?: string[] })
				?.required;
			if (Array.isArray(requiredFields)) {
				for (const field of requiredFields) {
					if (!(field in parsedObject)) {
						throw new Error(`Missing required field: ${field}`);
					}
				}
			}

			return parsedObject as T;
		} catch (parseError) {
			console.error("Fallback JSON generation failed:", parseError);
			console.log("Attempting field-by-field generation...");

			// Try field-by-field generation for facilitation schema
			if (params.schema === facilitationResponseSchema) {
				try {
					return (await this.generateFieldByField(params)) as T;
				} catch (fieldError) {
					console.error("Field-by-field generation also failed:", fieldError);
					return {
						content:
							"Let's explore this topic further. What are your initial thoughts?",
						type: "AI_QUESTION",
						facilitationStrategy:
							"Fallback response - both JSON and field-by-field generation failed",
						confidence: 0.3,
					} as T;
				}
			}

			throw new Error(
				`Failed to generate valid JSON using fallback method: ${parseError}`,
			);
		}
	}

	private extractAndCleanJSON(text: string): string | null {
		// Try to find a JSON object in the text using balanced brace matching
		const startIndex = text.indexOf("{");
		if (startIndex === -1) {
			return null;
		}

		let braceCount = 0;
		let endIndex = startIndex;
		let inString = false;
		let escaped = false;

		for (let i = startIndex; i < text.length; i++) {
			const char = text[i];

			if (escaped) {
				escaped = false;
				continue;
			}

			if (char === "\\") {
				escaped = true;
				continue;
			}

			if (char === '"') {
				inString = !inString;
				continue;
			}

			if (!inString) {
				if (char === "{") {
					braceCount++;
				} else if (char === "}") {
					braceCount--;
					if (braceCount === 0) {
						endIndex = i + 1;
						break;
					}
				}
			}
		}

		if (braceCount !== 0) {
			// Fallback to simple regex if balanced matching fails
			const jsonMatch = text.match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				return null;
			}
			return jsonMatch[0].trim();
		}

		const jsonString = text.substring(startIndex, endIndex);
		return jsonString.trim();
	}

	private fixCommonJSONIssues(jsonString: string): string {
		let fixed = jsonString;

		// Fix trailing commas in arrays and objects
		fixed = fixed.replace(/,(\s*[\]\}])/g, "$1");

		// Fix missing commas between array elements and objects
		fixed = fixed.replace(/"\s*"\s*(?=["\[])/g, '", "');
		fixed = fixed.replace(/(\]|\})\s*(?=[\{\[])/g, "$1, ");

		// Fix unescaped quotes in strings (more robust pattern)
		fixed = fixed.replace(
			/"([^"\\]*(\\.[^"\\]*)*)"([^",:}\]]*)"([^"\\]*(\\.[^"\\]*)*)":/g,
			'"$1\\"$3\\"$4":',
		);

		// Fix missing quotes around keys
		fixed = fixed.replace(/(\w+):/g, '"$1":');

		// Remove multiple consecutive commas
		fixed = fixed.replace(/,,+/g, ",");

		// Fix array formatting issues
		fixed = fixed.replace(/,\s*,/g, ",");
		fixed = fixed.replace(/\[\s*,/g, "[");
		fixed = fixed.replace(/,\s*\]/g, "]");

		// Fix object formatting issues
		fixed = fixed.replace(/\{\s*,/g, "{");
		fixed = fixed.replace(/,\s*\}/g, "}");

		// Fix spacing around colons and commas for better readability
		fixed = fixed.replace(/\s*:\s*/g, ": ");
		fixed = fixed.replace(/,(?!\s)/g, ", ");

		return fixed;
	}

	private async generateFieldByField(
		params: GenerateObjectParams,
	): Promise<Record<string, unknown>> {
		console.log("Using field-by-field generation for facilitation response");

		const baseContext = `Context: ${params.prompt}`;

		// Run all generations in parallel for speed
		const [contentResponse, typeResponse, strategyResponse, followUpsResponse] =
			await Promise.all([
				this.generateText({
					system: params.system,
					prompt: `${baseContext}\n\nGenerate a thoughtful facilitation question or prompt (50-200 words). Respond with ONLY the content, no additional text:`,
					config: params.config,
				}),
				this.generateText({
					system: params.system,
					prompt: `${baseContext}\n\nBased on the context, should this be a question to stimulate thinking or a prompt to guide discussion? Respond with exactly one word: "AI_QUESTION" or "AI_PROMPT":`,
					config: { ...params.config, temperature: 0.1 },
				}),
				this.generateText({
					system: params.system,
					prompt: `${baseContext}\n\nBriefly explain the pedagogical strategy being used (1-2 sentences). Respond with ONLY the strategy explanation:`,
					config: params.config,
				}),
				this.generateText({
					system: params.system,
					prompt: `${baseContext}\n\nGenerate 2-3 brief follow-up questions (each on a new line). Respond with ONLY the questions, one per line:`,
					config: params.config,
				}),
			]);

		// Parse and validate responses
		const content = contentResponse.trim();
		const type = typeResponse.trim().includes("AI_PROMPT")
			? "AI_PROMPT"
			: "AI_QUESTION";
		const strategy = strategyResponse.trim();
		const followUps = followUpsResponse
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0 && line.includes("?"))
			.slice(0, 3);

		const result = {
			content: content || "What are your thoughts on this topic?",
			type,
			facilitationStrategy: strategy || "Field-by-field generation approach",
			confidence: 0.8,
			...(followUps.length > 0 && { suggestedFollowUps: followUps }),
		};

		console.log("Field-by-field generation successful");
		return result;
	}

	private validateAndSanitizeFacilitationResponse(
		obj: Record<string, unknown>,
	): Record<string, unknown> {
		// Ensure required fields exist with defaults
		const sanitized: Record<string, unknown> = {
			content:
				obj.content || "Let's continue our discussion. What are your thoughts?",
			type: obj.type === "AI_PROMPT" ? "AI_PROMPT" : "AI_QUESTION",
			facilitationStrategy: obj.facilitationStrategy || "General facilitation",
			confidence:
				typeof obj.confidence === "number"
					? Math.min(Math.max(obj.confidence, 0), 1)
					: 0.7,
		};

		// Handle optional suggestedFollowUps
		if (Array.isArray(obj.suggestedFollowUps)) {
			sanitized.suggestedFollowUps = obj.suggestedFollowUps
				.filter(
					(item: unknown) => typeof item === "string" && item.trim().length > 0,
				)
				.slice(0, 3);
		}

		return sanitized;
	}

	private describeSchema(schema: z.ZodSchema): string {
		// For our facilitation response schema, provide a clear description
		if (schema === facilitationResponseSchema) {
			return `- content: (string) The facilitation content/question to share with participants
- type: (string) Either "AI_QUESTION" or "AI_PROMPT" 
- suggestedFollowUps: (array of strings, optional) Up to 3 follow-up questions
- facilitationStrategy: (string) Brief explanation of the pedagogical strategy used
- confidence: (number) Confidence score between 0 and 1`;
		}

		// Generic fallback
		return "A JSON object with the appropriate fields for the requested data structure";
	}

	async generateFacilitationResponse(
		system: string,
		prompt: string,
		config?: AIProviderConfig,
	): Promise<FacilitationResponse> {
		return this.generateObject<FacilitationResponse>({
			system,
			prompt,
			schema: facilitationResponseSchema,
			config,
		});
	}

	getProviderInfo() {
		return {
			provider: this.providerType,
			model: env.AI_MODEL,
			baseURL: this.providerType === "ollama" ? env.OLLAMA_BASE_URL : undefined,
		};
	}
}

// Export singleton instance
export const unifiedAIService = new UnifiedAIService();
