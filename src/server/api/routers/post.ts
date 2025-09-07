import { z } from "zod";

import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "@/server/api/trpc";

export const postRouter = createTRPCRouter({
	hello: publicProcedure
		.input(z.object({ text: z.string() }))
		.query(({ input }) => {
			return {
				greeting: `Hello ${input.text}`,
			};
		}),

	create: protectedProcedure
		.input(z.object({ message: z.string().min(1) }))
		.mutation(async ({ input }) => {
			// Placeholder for post creation
			// Since Post model doesn't exist in schema yet
			return {
				id: "placeholder",
				message: input.message,
				createdAt: new Date(),
			};
		}),

	getLatest: protectedProcedure.query(async () => {
		// Placeholder for getting latest post
		// Since Post model doesn't exist in schema yet
		return null as { id: string; message: string; createdAt: Date } | null;
	}),

	getSecretMessage: protectedProcedure.query(() => {
		return "you can now see this secret message!";
	}),
});
