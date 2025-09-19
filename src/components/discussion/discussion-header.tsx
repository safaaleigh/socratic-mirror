import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ArrowLeft, Settings, UserPlus } from "lucide-react";

interface DiscussionHeaderProps {
	name: string;
	description?: string | null;
	isActive: boolean;
	createdAt: Date | string;
	isCreator: boolean;
	isParticipant: boolean;
	canJoin: boolean;
	isJoining?: boolean;
	isLeaving?: boolean;
	onBack?: () => void;
	onInvite?: () => void;
	onJoin?: () => void;
	onLeave?: () => void;
	onSettings?: () => void;
}

export function DiscussionHeader({
	name,
	description,
	isActive,
	createdAt,
	isCreator,
	isParticipant,
	canJoin,
	isJoining = false,
	isLeaving = false,
	onBack,
	onInvite,
	onJoin,
	onLeave,
	onSettings,
}: DiscussionHeaderProps) {
	return (
		<Card>
			<CardHeader className="p-4 sm:p-6">
				{/* Mobile Layout */}
				<div className="block sm:hidden">
					{/* Top row - Back button and title */}
					<div className="mb-3 flex items-start gap-3">
						{onBack && (
							<Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
								<ArrowLeft className="h-4 w-4" />
							</Button>
						)}
						<div className="min-w-0 flex-1">
							<h1 className="font-bold text-lg leading-tight">{name}</h1>
							<div className="mt-1 flex items-center gap-2">
								<Badge variant={isActive ? "default" : "secondary"} className="text-xs">
									{isActive ? "Active" : "Inactive"}
								</Badge>
								<span className="text-muted-foreground text-xs">
									{new Date(createdAt).toLocaleDateString()}
								</span>
							</div>
						</div>
					</div>

					{/* Description */}
					{description && (
						<p className="mb-3 text-muted-foreground text-sm leading-relaxed">{description}</p>
					)}

					{/* Mobile Actions */}
					<div className="flex flex-wrap gap-2">
						{/* Primary actions first */}
						{canJoin && onJoin && (
							<Button
								variant="default"
								size="sm"
								onClick={onJoin}
								disabled={isJoining}
								className="flex-1 min-w-[120px]"
							>
								{isJoining ? "Joining..." : "Join Discussion"}
							</Button>
						)}

						{isParticipant && !isCreator && onLeave && (
							<Button
								variant="outline"
								size="sm"
								onClick={onLeave}
								disabled={isLeaving}
								className="flex-1 min-w-[100px]"
							>
								{isLeaving ? "Leaving..." : "Leave"}
							</Button>
						)}

						{/* Creator actions */}
						{isCreator && (
							<>
								{onInvite && (
									<Button variant="outline" size="sm" onClick={onInvite} className="flex-1 min-w-[100px]">
										<UserPlus className="mr-2 h-4 w-4" />
										Invite
									</Button>
								)}
								{onSettings && (
									<Button variant="ghost" size="icon" onClick={onSettings} className="shrink-0">
										<Settings className="h-4 w-4" />
									</Button>
								)}
							</>
						)}
					</div>
				</div>

				{/* Desktop Layout */}
				<div className="hidden sm:block">
					{/* Title and meta info */}
					<div className="mb-3 flex items-start gap-3">
						{onBack && (
							<Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
								<ArrowLeft className="h-4 w-4" />
							</Button>
						)}
						<div className="min-w-0 flex-1">
							<h1 className="font-bold text-xl leading-tight">{name}</h1>
							<div className="mt-1 flex items-center gap-2">
								<Badge variant={isActive ? "default" : "secondary"}>
									{isActive ? "Active" : "Inactive"}
								</Badge>
								<span className="text-muted-foreground text-xs">
									Created {new Date(createdAt).toLocaleDateString()}
								</span>
							</div>
						</div>
					</div>

					{/* Description */}
					{description && (
						<p className="mb-4 text-muted-foreground text-sm leading-relaxed">{description}</p>
					)}

					{/* Desktop Actions */}
					<div className="flex flex-wrap gap-2">
						{/* Primary actions first */}
						{canJoin && onJoin && (
							<Button
								variant="default"
								size="sm"
								onClick={onJoin}
								disabled={isJoining}
							>
								{isJoining ? "Joining..." : "Join Discussion"}
							</Button>
						)}

						{isParticipant && !isCreator && onLeave && (
							<Button
								variant="outline"
								size="sm"
								onClick={onLeave}
								disabled={isLeaving}
							>
								{isLeaving ? "Leaving..." : "Leave"}
							</Button>
						)}

						{/* Creator actions */}
						{isCreator && (
							<>
								{onInvite && (
									<Button variant="outline" size="sm" onClick={onInvite}>
										<UserPlus className="mr-2 h-4 w-4" />
										Invite
									</Button>
								)}
								{onSettings && (
									<Button variant="ghost" size="icon" onClick={onSettings}>
										<Settings className="h-4 w-4" />
									</Button>
								)}
							</>
						)}
					</div>
				</div>
			</CardHeader>
		</Card>
	);
}
