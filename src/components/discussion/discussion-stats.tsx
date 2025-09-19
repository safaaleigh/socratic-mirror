import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, MessageCircle, Users } from "lucide-react";

interface DiscussionStatsProps {
	participantCount: number;
	messageCount?: number;
	duration?: string;
}

export function DiscussionStats({
	participantCount,
	messageCount,
	duration,
}: DiscussionStatsProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm">Discussion Stats</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="flex items-center justify-between text-sm">
					<span className="flex items-center gap-2">
						<Users className="h-4 w-4" />
						Participants
					</span>
					<span>{participantCount}</span>
				</div>
				<div className="flex items-center justify-between text-sm">
					<span className="flex items-center gap-2">
						<MessageCircle className="h-4 w-4" />
						Messages
					</span>
					<span>{messageCount ?? "-"}</span>
				</div>
				<div className="flex items-center justify-between text-sm">
					<span className="flex items-center gap-2">
						<Clock className="h-4 w-4" />
						Duration
					</span>
					<span>{duration ?? "-"}</span>
				</div>
			</CardContent>
		</Card>
	);
}
