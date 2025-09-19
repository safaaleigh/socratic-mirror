import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarIcon, UserIcon } from "lucide-react";

interface Participant {
	id: string;
	userId?: string;
	user?: {
		id: string;
		name?: string | null;
		email?: string | null;
		image?: string | null;
	} | null;
	role?: "PARTICIPANT" | "MODERATOR" | "CREATOR";
	joinedAt?: Date | string;
}

interface ParticipantsListProps {
	participants: Participant[];
	creatorId?: string;
	maxHeight?: string;
}

export function ParticipantsList({
	participants,
	creatorId,
	maxHeight = "300px",
}: ParticipantsListProps) {
	if (participants.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-sm">Participants</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col items-center justify-center py-8 text-center">
						<UserIcon className="mb-2 h-8 w-8 text-muted-foreground" />
						<p className="text-muted-foreground text-sm">No participants yet</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm">
					Participants ({participants.length})
				</CardTitle>
			</CardHeader>
			<CardContent className="p-0">
				<ScrollArea className="h-full" style={{ maxHeight }}>
					<div className="space-y-2 p-4">
						{participants.map((participant) => (
							<div key={participant.id} className="flex items-center gap-3">
								<HoverCard>
									<HoverCardTrigger asChild>
										<div className="cursor-pointer">
											<Avatar className="h-8 w-8">
												<AvatarImage
													src={participant.user?.image || undefined}
													alt={participant.user?.name || "User"}
												/>
												<AvatarFallback>
													{participant.user?.name?.charAt(0)?.toUpperCase() ||
														"U"}
												</AvatarFallback>
											</Avatar>
										</div>
									</HoverCardTrigger>
									<HoverCardContent className="w-80">
										<div className="space-y-3">
											<div className="flex items-center gap-3">
												<Avatar className="h-12 w-12">
													<AvatarImage
														src={participant.user?.image || undefined}
														alt={participant.user?.name || "User"}
													/>
													<AvatarFallback>
														{participant.user?.name?.charAt(0)?.toUpperCase() ||
															"U"}
													</AvatarFallback>
												</Avatar>
												<div>
													<h4 className="font-semibold text-sm">
														{participant.user?.name || "Unknown User"}
													</h4>
													{participant.user?.email && (
														<p className="text-muted-foreground text-xs">
															{participant.user.email}
														</p>
													)}
												</div>
											</div>
											{participant.joinedAt && (
												<div className="flex items-center gap-2 text-muted-foreground text-xs">
													<CalendarIcon className="h-3 w-3" />
													Joined{" "}
													{new Date(participant.joinedAt).toLocaleDateString()}
												</div>
											)}
										</div>
									</HoverCardContent>
								</HoverCard>

								<div className="min-w-0 flex-1">
									<span className="truncate text-sm">
										{participant.user?.name || "Unknown User"}
									</span>
								</div>

								<div className="flex gap-1">
									{participant.role === "MODERATOR" && (
										<Badge variant="secondary" className="text-xs">
											Mod
										</Badge>
									)}
									{participant.role === "CREATOR" && (
										<Badge variant="outline" className="text-xs">
											Creator
										</Badge>
									)}
									{participant.userId === creatorId && participant.role !== "CREATOR" && (
										<Badge variant="outline" className="text-xs">
											Creator
										</Badge>
									)}
								</div>
							</div>
						))}
					</div>
				</ScrollArea>
			</CardContent>
		</Card>
	);
}
