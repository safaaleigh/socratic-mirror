import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

export const authRouter = createTRPCRouter({
	register: publicProcedure
		.input(
			z.object({
				name: z.string().min(1, "Name is required"),
				email: z.string().email("Invalid email address"),
				password: z.string().min(6, "Password must be at least 6 characters"),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { name, email, password } = input;

			// Check if user already exists
			const existingUser = await ctx.db.user.findUnique({
				where: { email },
			});

			if (existingUser) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "User with this email already exists",
				});
			}

			// Hash password
			const hashedPassword = await bcrypt.hash(password, 12);

			// Create user
			const user = await ctx.db.user.create({
				data: {
					name,
					email,
					password: hashedPassword,
				},
				select: {
					id: true,
					name: true,
					email: true,
					createdAt: true,
				},
			});

			return {
				success: true,
				user,
			};
		}),
});
