// Database services for Socratic discussion platform
export { MessageService, messageService } from "./message-service";
export { ParticipantService, participantService } from "./participant-service";
export { DiscussionService, discussionService } from "./discussion-service";
export { InvitationService, invitationService } from "./invitation-service";

// Re-export types for convenience
export type {
	MessageWithSender,
	CursorPaginationResult,
	CreateParticipantMessageParams,
	GetMessageHistoryParams,
} from "./message-service";

export type {
	ParticipantInfo,
	CreateParticipantParams,
	ParticipantSessionInfo,
	ParticipantStats,
} from "./participant-service";

export type {
	InvitationTokenPayload,
	DiscussionInviteInfo,
	GenerateTokenParams,
	TokenValidationResult,
} from "./discussion-service";

export type {
	InvitationValidationResult,
	ParticipantLimitCheck,
	DiscussionContext,
	GenerateInvitationParams,
	InvitationTokenInfo,
} from "./invitation-service";
