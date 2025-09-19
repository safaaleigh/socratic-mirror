import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, MessageCircle, Users } from "lucide-react";

interface EmptyDiscussionStateProps {
	isParticipant: boolean;
	canJoin: boolean;
	onJoin?: () => void;
	message?: string;
	icon?: "eye" | "message" | "users";
}

export function EmptyDiscussionState({
	isParticipant,
	canJoin,
	onJoin,
	message,
	icon = "eye",
}: EmptyDiscussionStateProps) {
	const IconComponent = {
		eye: Eye,
		message: MessageCircle,
		users: Users,
	}[icon];

	const defaultMessage = isParticipant
		? "No messages yet. Start the conversation by sending a message below."
		: "You need to join this discussion to view and send messages.";

	const title = isParticipant ? "Start the conversation" : "Join to participate";

	return (
		<div className="flex flex-1 items-center justify-center p-4">
			<Card>
				<CardContent className="py-12 text-center">
					<IconComponent className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
					<h3 className="mb-2 font-semibold">{title}</h3>
					<p className="mb-4 text-muted-foreground text-sm">
						{message || defaultMessage}
					</p>
					{canJoin && onJoin && (
						<Button onClick={onJoin}>Join Discussion</Button>
					)}
				</CardContent>
			</Card>
		</div>
	);
}