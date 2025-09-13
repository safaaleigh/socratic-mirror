"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { AlertCircle, Clock, Users, XCircle } from "lucide-react";
import Link from "next/link";

type InvitationErrorType = "invalid" | "expired" | "full" | "ended" | "network";

interface InvitationErrorProps {
	type: InvitationErrorType;
	message: string;
}

const errorConfig: Record<
	InvitationErrorType,
	{
		icon: React.ComponentType<{ className?: string }>;
		title: string;
		description: string;
		variant: "default" | "destructive";
	}
> = {
	invalid: {
		icon: XCircle,
		title: "Invalid Invitation",
		description: "This invitation link is not valid or has been corrupted.",
		variant: "destructive",
	},
	expired: {
		icon: Clock,
		title: "Invitation Expired",
		description: "This invitation link has expired and is no longer valid.",
		variant: "destructive",
	},
	full: {
		icon: Users,
		title: "Discussion Full",
		description:
			"This discussion has reached its maximum number of participants.",
		variant: "default",
	},
	ended: {
		icon: AlertCircle,
		title: "Discussion Ended",
		description:
			"This discussion has ended and is no longer accepting participants.",
		variant: "default",
	},
	network: {
		icon: AlertCircle,
		title: "Connection Error",
		description: "Unable to verify the invitation due to a network issue.",
		variant: "destructive",
	},
};

export function InvitationError({ type, message }: InvitationErrorProps) {
	const config = errorConfig[type];
	const Icon = config.icon;

	return (
		<Card>
			<CardHeader className="text-center">
				<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
					<Icon className="h-8 w-8 text-muted-foreground" />
				</div>
				<CardTitle className="text-xl">{config.title}</CardTitle>
				<CardDescription>{config.description}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<Alert variant={config.variant}>
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>{message}</AlertDescription>
				</Alert>

				{/* Recovery actions based on error type */}
				<div className="space-y-3">
					{type === "network" && (
						<Button
							onClick={() => window.location.reload()}
							className="w-full"
							variant="outline"
						>
							Try Again
						</Button>
					)}

					{type === "expired" && (
						<div className="text-center text-muted-foreground text-sm">
							Contact the discussion organizer for a new invitation link.
						</div>
					)}

					{type === "full" && (
						<div className="text-center text-muted-foreground text-sm">
							Check back later or contact the discussion organizer.
						</div>
					)}

					{type === "ended" && (
						<div className="text-center text-muted-foreground text-sm">
							This discussion has concluded. Contact the organizer if you
							believe this is an error.
						</div>
					)}

					{/* Link back to main app if available */}
					<div className="border-t pt-4">
						<Button asChild variant="ghost" className="w-full">
							<Link href="/">Return to Socratic Discussions</Link>
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
