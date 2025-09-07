import { authRouter } from "@/server/api/routers/auth";
import { dashboardRouter } from "@/server/api/routers/dashboard";
import { discussionRouter } from "@/server/api/routers/discussion";
import { groupRouter } from "@/server/api/routers/group";
import { invitationRouter } from "@/server/api/routers/invitation";
import { lessonRouter } from "@/server/api/routers/lesson";
import { postRouter } from "@/server/api/routers/post";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
	auth: authRouter,
	post: postRouter,
	lesson: lessonRouter,
	group: groupRouter,
	discussion: discussionRouter,
	invitation: invitationRouter,
	dashboard: dashboardRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
