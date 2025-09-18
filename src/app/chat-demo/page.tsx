"use client";

import { ChatContainer } from "@/components/chat";
import { useEffect, useState } from "react";

export default function ChatDemoPage() {
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		const checkMobile = () => {
			setIsMobile(window.innerWidth < 768);
		};

		checkMobile();
		window.addEventListener("resize", checkMobile);
		return () => window.removeEventListener("resize", checkMobile);
	}, []);

	// Demo data - in production, these would come from your auth/session
	const demoData = {
		discussionId: "demo_discussion_123",
		participantId: "demo_participant_456",
		sessionId: "demo_session_789",
		displayName: "Demo User",
		currentUserId: undefined, // For anonymous participant
	};

	return (
		<div className={isMobile ? "" : "container mx-auto py-8"}>
			<div className={isMobile ? "" : "mx-auto max-w-4xl space-y-4"}>
				{!isMobile && (
					<div className="space-y-2 text-center">
						<h1 className="font-bold text-3xl">Chat UI Demo</h1>
						<p className="text-muted-foreground">
							Modern chat interface using Vercel AI SDK and shadcn/ui components
						</p>
					</div>
				)}

				<ChatContainer
					{...demoData}
					isMobile={isMobile}
					className={isMobile ? "" : "mx-auto"}
				/>

				{!isMobile && (
					<div className="space-y-1 text-center text-muted-foreground text-sm">
						<p>
							This is a demo of the enhanced chat UI with AI SDK integration.
						</p>
						<p>
							Messages are sent to the enhanced API endpoint for proper
							streaming support.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
