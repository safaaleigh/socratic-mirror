"use client";

import { useEffect, useState } from "react";
import { ChatContainer } from "./ChatContainer";

interface AuthenticatedChatContainerProps {
	discussionId: string;
	userId: string;
	displayName: string;
	className?: string;
}

export function AuthenticatedChatContainer({
	discussionId,
	userId,
	displayName,
	className,
}: AuthenticatedChatContainerProps) {
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		const checkMobile = () => {
			setIsMobile(window.innerWidth < 768);
		};

		checkMobile();
		window.addEventListener("resize", checkMobile);
		return () => window.removeEventListener("resize", checkMobile);
	}, []);

	// For authenticated users, we create a stable participant ID based on their user ID
	const participantId = `user_${userId}`;
	const sessionId = `session_${userId}_${Date.now()}`;

	return (
		<ChatContainer
			discussionId={discussionId}
			participantId={participantId}
			sessionId={sessionId}
			displayName={displayName}
			currentUserId={userId}
			isMobile={isMobile}
			className={className}
		/>
	);
}
