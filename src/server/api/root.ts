import { aiFacilitatorRouter } from "@/server/api/routers/ai-facilitator";
import { authRouter } from "@/server/api/routers/auth";
import { dashboardRouter } from "@/server/api/routers/dashboard";
import { discussionRouter } from "@/server/api/routers/discussion";
import { groupRouter } from "@/server/api/routers/group";
import { invitationRouter } from "@/server/api/routers/invitation";
import { lessonRouter } from "@/server/api/routers/lesson";
import { messageRouter } from "@/server/api/routers/message";
import { participantRouter } from "@/server/api/routers/participant";
import { unifiedInvitationRouter } from "@/server/api/routers/unified-invitation";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
	auth: authRouter,
	lesson: lessonRouter,
	group: groupRouter,
	discussion: discussionRouter,
	invitation: invitationRouter,
	message: messageRouter,
	participant: participantRouter,
	dashboard: dashboardRouter,
	// Unified invitation system (supports both DB and JWT tokens)
	unifiedInvitation: unifiedInvitationRouter,
	// AI Facilitator system
	aiFacilitator: aiFacilitatorRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.lesson.getAll();
 *       ^? Lesson[]
 */
export const createCaller = createCallerFactory(appRouter);
