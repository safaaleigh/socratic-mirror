/**
 * Unified Invitation Router
 * 
 * Provides a single tRPC interface for both database-stored and JWT-based
 * invitation tokens. This router will eventually replace the separate
 * invitation and participant validation endpoints.
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/api/trpc";
import { unifiedTokenService } from "@/lib/invitation-token-service";
import type { TokenGenerationOptions } from "@/types/invitation-tokens";
import { TRPCError } from "@trpc/server";

/**
 * Input validation schemas
 */
const generateTokenSchema = z.object({
  discussionId: z.string().cuid("Invalid discussion ID"),
  expiresIn: z.string().optional().default("24h"),
  recipientEmail: z.string().email().optional(),
  message: z.string().max(500).optional(),
  forceType: z.enum(['database', 'jwt']).optional(),
  expectsHighVolume: z.boolean().optional().default(false),
  requiresRevocation: z.boolean().optional().default(false),
  isTemporary: z.boolean().optional().default(false),
});

const validateTokenSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

const revokeTokenSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

const listInvitationsSchema = z.object({
  discussionId: z.string().cuid().optional(),
  status: z.enum(['PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED']).optional(),
  limit: z.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

/**
 * Unified Invitation Router
 */
export const unifiedInvitationRouter = createTRPCRouter({
  /**
   * Generate an invitation token (authenticated users only)
   * 
   * Automatically selects the optimal token type based on the context:
   * - Database tokens for rich features (sender info, revocation, audit trail)
   * - JWT tokens for lightweight scenarios (anonymous, high-volume, temporary)
   */
  generate: protectedProcedure
    .input(generateTokenSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user has access to the discussion
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

        // Check if user has permission to create invitations
        // For now, only the creator can create invitations
        // TODO: Add proper permission system for moderators/collaborators
        if (discussion.creatorId !== ctx.session.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have permission to create invitations for this discussion",
          });
        }

        if (!discussion.isActive) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Cannot create invitations for inactive discussions",
          });
        }

        // Build token generation options
        const options: TokenGenerationOptions = {
          discussionId: input.discussionId,
          expiresIn: input.expiresIn,
          senderId: ctx.session.user.id,
          recipientEmail: input.recipientEmail,
          message: input.message,
          forceType: input.forceType,
          expectsHighVolume: input.expectsHighVolume,
          requiresRevocation: input.requiresRevocation,
          isTemporary: input.isTemporary,
        };

        const result = await unifiedTokenService.generateToken(options);

        return {
          token: result.token,
          type: result.type,
          expiresAt: result.expiresAt,
          invitationId: result.invitationId,
          discussionName: discussion.name,
          url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/invitations/${result.token}`,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        console.error('Token generation error:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate invitation token",
        });
      }
    }),

  /**
   * Validate an invitation token (public endpoint)
   * 
   * Works with both database and JWT tokens, providing a unified validation interface.
   * Returns discussion information if the token is valid.
   */
  validate: publicProcedure
    .input(validateTokenSchema)
    .query(async ({ input }) => {
      try {
        const result = await unifiedTokenService.validateToken(input.token);
        
        return {
          valid: result.valid,
          error: result.error,
          reason: result.reason,
          discussion: result.discussion,
          token: result.token ? {
            type: result.token.type,
            expiresAt: result.token.expiresAt,
            // Include additional info for database tokens
            ...(result.token.type === 'database' && {
              sender: result.token.sender,
              message: result.token.message,
              createdAt: result.token.createdAt,
            }),
          } : undefined,
        };
      } catch (error) {
        console.error('Token validation error:', error);
        return {
          valid: false,
          error: "Failed to validate token",
        };
      }
    }),

  /**
   * Revoke an invitation token (authenticated users only)
   * 
   * Only works for database tokens. JWT tokens cannot be revoked.
   */
  revoke: protectedProcedure
    .input(revokeTokenSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Check if token is revocable
        if (!unifiedTokenService.isRevocable(input.token)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This token type cannot be revoked",
          });
        }

        // For database tokens, verify the user has permission to revoke
        const invitation = await ctx.db.invitation.findUnique({
          where: { token: input.token },
          select: { 
            id: true, 
            senderId: true, 
            targetId: true,
            status: true,
          },
        });

        if (!invitation) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Invitation not found",
          });
        }

        // Check if user has permission to revoke (sender or discussion owner)
        if (invitation.senderId !== ctx.session.user.id) {
          const discussion = await ctx.db.discussion.findUnique({
            where: { id: invitation.targetId },
            select: { creatorId: true },
          });

          if (!discussion || discussion.creatorId !== ctx.session.user.id) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You do not have permission to revoke this invitation",
            });
          }
        }

        if (invitation.status === 'CANCELLED') {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invitation is already cancelled",
          });
        }

        const success = await unifiedTokenService.revokeToken(input.token);
        
        if (!success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to revoke invitation",
          });
        }

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        console.error('Token revocation error:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to revoke invitation token",
        });
      }
    }),

  /**
   * List invitations created by the current user (authenticated users only)
   * 
   * Only returns database tokens since JWT tokens are not tracked.
   */
  list: protectedProcedure
    .input(listInvitationsSchema)
    .query(async ({ ctx, input }) => {
      try {
        const where: any = {
          senderId: ctx.session.user.id,
        };

        if (input.discussionId) {
          where.targetId = input.discussionId;
          where.type = 'DISCUSSION';
        }

        if (input.status) {
          where.status = input.status;
        }

        if (input.cursor) {
          where.id = { lt: input.cursor };
        }

        const invitations = await ctx.db.invitation.findMany({
          where,
          take: input.limit + 1,
          orderBy: { createdAt: 'desc' },
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });

        let hasMore = false;
        if (invitations.length > input.limit) {
          invitations.pop();
          hasMore = true;
        }

        // Get discussion names for context
        const discussionIds = [...new Set(invitations.map(inv => inv.targetId))];
        const discussions = await ctx.db.discussion.findMany({
          where: { id: { in: discussionIds } },
          select: { id: true, name: true },
        });

        const discussionMap = new Map(discussions.map(d => [d.id, d.name]));

        const formattedInvitations = invitations.map(invitation => ({
          id: invitation.id,
          token: invitation.token,
          type: 'database' as const,
          discussionId: invitation.targetId,
          discussionName: discussionMap.get(invitation.targetId) || 'Unknown',
          recipientEmail: invitation.recipientEmail,
          message: invitation.message,
          status: invitation.status,
          createdAt: invitation.createdAt,
          expiresAt: invitation.expiresAt,
          url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/invitations/${invitation.token}`,
          revocable: true,
        }));

        return {
          invitations: formattedInvitations,
          nextCursor: invitations[invitations.length - 1]?.id,
          hasMore,
        };
      } catch (error) {
        console.error('List invitations error:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve invitations",
        });
      }
    }),

  /**
   * Get invitation statistics (authenticated users only)
   */
  stats: protectedProcedure
    .input(z.object({
      discussionId: z.string().cuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const where: any = {
          senderId: ctx.session.user.id,
        };

        if (input.discussionId) {
          where.targetId = input.discussionId;
          where.type = 'DISCUSSION';
        }

        const [total, pending, accepted, expired, cancelled] = await Promise.all([
          ctx.db.invitation.count({ where }),
          ctx.db.invitation.count({ where: { ...where, status: 'PENDING' } }),
          ctx.db.invitation.count({ where: { ...where, status: 'ACCEPTED' } }),
          ctx.db.invitation.count({ where: { ...where, status: 'EXPIRED' } }),
          ctx.db.invitation.count({ where: { ...where, status: 'CANCELLED' } }),
        ]);

        return {
          total,
          pending,
          accepted,
          expired,
          cancelled,
          // Note: JWT tokens are not tracked, so these stats only reflect database tokens
          note: "Statistics only include database tokens, not JWT tokens",
        };
      } catch (error) {
        console.error('Invitation stats error:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve invitation statistics",
        });
      }
    }),
});