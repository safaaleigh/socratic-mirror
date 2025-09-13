/**
 * Unified Invitation Token Types
 * 
 * Provides type definitions for the unified invitation token system
 * that supports both database-stored and JWT-based tokens.
 */

import type { InvitationStatus, InvitationType } from "@prisma/client";

/**
 * Token type discriminator
 */
export type TokenType = 'database' | 'jwt';

/**
 * Core token information available in both token types
 */
export interface BaseTokenInfo {
  discussionId: string;
  expiresAt: Date;
  type: TokenType;
}

/**
 * Enhanced token information only available for database tokens
 */
export interface DatabaseTokenInfo extends BaseTokenInfo {
  type: 'database';
  id: string;
  invitationType: InvitationType;
  targetId: string;
  status: InvitationStatus;
  sender: {
    id: string;
    name: string | null;
    email: string;
  };
  recipientEmail: string;
  recipientId: string | null;
  message: string | null;
  createdAt: Date;
}

/**
 * Lightweight token information for JWT tokens
 */
export interface JWTTokenInfo extends BaseTokenInfo {
  type: 'jwt';
  issuedAt: Date;
}

/**
 * Unified token information (discriminated union)
 */
export type UnifiedTokenInfo = DatabaseTokenInfo | JWTTokenInfo;

/**
 * Token validation result
 */
export interface TokenValidationResult {
  valid: boolean;
  token?: UnifiedTokenInfo;
  error?: string;
  reason?: string;
}

/**
 * Discussion information returned with valid tokens
 */
export interface TokenDiscussionInfo {
  id: string;
  name: string;
  participantCount: number;
  maxParticipants: number | null;
  isActive: boolean;
  status: 'active' | 'closed' | 'cancelled';
}

/**
 * Complete validation response including discussion info
 */
export interface TokenValidationResponse extends TokenValidationResult {
  discussion?: TokenDiscussionInfo;
}

/**
 * Token generation options
 */
export interface TokenGenerationOptions {
  discussionId: string;
  expiresIn?: string; // JWT-compatible duration string (e.g., "24h", "7d")
  
  // If provided, creates a database token with rich features
  senderId?: string;
  recipientEmail?: string;
  message?: string;
  
  // Force token type (overrides smart selection)
  forceType?: TokenType;
  
  // Context hints for smart selection
  expectsHighVolume?: boolean;
  requiresRevocation?: boolean;
  isTemporary?: boolean;
}

/**
 * Token generation result
 */
export interface TokenGenerationResult {
  token: string;
  type: TokenType;
  expiresAt: Date;
  
  // Only present for database tokens
  invitationId?: string;
}

/**
 * Token context for smart type selection
 */
export interface TokenSelectionContext {
  senderId?: string;
  recipientEmail?: string;
  hasMessage?: boolean;
  requiresRevocation?: boolean;
  expectsHighVolume?: boolean;
  isTemporary?: boolean;
}

/**
 * Unified token service interface
 */
export interface IUnifiedTokenService {
  generateToken(options: TokenGenerationOptions): Promise<TokenGenerationResult>;
  validateToken(token: string): Promise<TokenValidationResponse>;
  revokeToken(token: string): Promise<boolean>;
  isRevocable(token: string): boolean;
}

/**
 * Type guards for token discrimination
 */
export function isDatabaseToken(token: UnifiedTokenInfo): token is DatabaseTokenInfo {
  return token.type === 'database';
}

export function isJWTToken(token: UnifiedTokenInfo): token is JWTTokenInfo {
  return token.type === 'jwt';
}

/**
 * Smart token type selection logic
 */
export function selectOptimalTokenType(context: TokenSelectionContext): TokenType {
  // Force database token for rich features
  if (context.senderId && (
    context.recipientEmail || 
    context.hasMessage || 
    context.requiresRevocation
  )) {
    return 'database';
  }
  
  // Force JWT for high-volume or temporary scenarios
  if (context.expectsHighVolume || context.isTemporary || !context.senderId) {
    return 'jwt';
  }
  
  // Default to database for authenticated contexts
  return context.senderId ? 'database' : 'jwt';
}

/**
 * Error types for token operations
 */
export class TokenValidationError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_FORMAT' | 'EXPIRED' | 'NOT_FOUND' | 'REVOKED' | 'DISCUSSION_INVALID',
    public token?: string
  ) {
    super(message);
    this.name = 'TokenValidationError';
  }
}

export class TokenGenerationError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_OPTIONS' | 'DATABASE_ERROR' | 'JWT_ERROR',
    public options?: TokenGenerationOptions
  ) {
    super(message);
    this.name = 'TokenGenerationError';
  }
}