"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";
import { AlertCircle, Copy, Link, Mail, Plus, X } from "lucide-react";
import { useState } from "react";

interface InviteParticipantsModalProps {
	discussionId: string;
	discussionTitle?: string;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}

export function InviteParticipantsModal({
	discussionId,
	discussionTitle,
	isOpen,
	onOpenChange,
}: InviteParticipantsModalProps) {
	const [activeTab, setActiveTab] = useState("email");
	const [emailList, setEmailList] = useState<string[]>([]);
	const [newEmail, setNewEmail] = useState("");
	const [customMessage, setCustomMessage] = useState("");
	const [inviteLink, setInviteLink] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const sendInvitationsMutation = api.invitation.sendInvitations.useMutation({
		onSuccess: (result) => {
			setError(null);
			setSuccess(`Invitations sent to ${result.sentCount} recipients`);
			setEmailList([]);
			setCustomMessage("");
		},
		onError: (error) => {
			setError(error.message);
		},
	});

	const createLinkMutation = api.invitation.createLink.useMutation({
		onSuccess: (result) => {
			setError(null);
			setInviteLink(result.inviteUrl);
			setSuccess("Invitation link created successfully");
		},
		onError: (error) => {
			setError(error.message);
		},
	});

	const addEmail = () => {
		const email = newEmail.trim();
		if (!email) return;

		// Basic email validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			setError("Please enter a valid email address");
			return;
		}

		if (emailList.includes(email)) {
			setError("Email already added");
			return;
		}

		if (emailList.length >= 20) {
			setError("Maximum 20 email addresses allowed");
			return;
		}

		setEmailList((prev) => [...prev, email]);
		setNewEmail("");
		setError(null);
	};

	const removeEmail = (email: string) => {
		setEmailList((prev) => prev.filter((e) => e !== email));
	};

	const handleSendInvitations = () => {
		if (emailList.length === 0) {
			setError("Please add at least one email address");
			return;
		}

		sendInvitationsMutation.mutate({
			discussionId,
			emails: emailList,
			customMessage: customMessage.trim() || undefined,
		});
	};

	const handleCreateLink = () => {
		createLinkMutation.mutate({
			discussionId,
			maxUses: undefined, // Allow unlimited uses for now
			expiresAt: undefined, // No expiration for now
		});
	};

	const copyToClipboard = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setSuccess("Copied to clipboard!");
		} catch (error) {
			setError("Failed to copy to clipboard");
		}
	};

	const resetState = () => {
		setError(null);
		setSuccess(null);
		setActiveTab("email");
		setEmailList([]);
		setNewEmail("");
		setCustomMessage("");
		setInviteLink("");
	};

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) resetState();
				onOpenChange(open);
			}}
		>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Invite Participants</DialogTitle>
					<DialogDescription>
						Invite people to join "{discussionTitle}" discussion
					</DialogDescription>
				</DialogHeader>

				{error && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{success && (
					<Alert>
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>{success}</AlertDescription>
					</Alert>
				)}

				<Tabs value={activeTab} onValueChange={setActiveTab}>
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="email">
							<Mail className="mr-2 h-4 w-4" />
							Email Invitations
						</TabsTrigger>
						<TabsTrigger value="link">
							<Link className="mr-2 h-4 w-4" />
							Invitation Link
						</TabsTrigger>
					</TabsList>

					<TabsContent value="email" className="space-y-4">
						<div className="space-y-3">
							<div className="space-y-2">
								<Label htmlFor="email-input">Email Addresses</Label>
								<div className="flex gap-2">
									<Input
										id="email-input"
										type="email"
										placeholder="Enter email address"
										value={newEmail}
										onChange={(e) => setNewEmail(e.target.value)}
										onKeyPress={(e) => e.key === "Enter" && addEmail()}
									/>
									<Button onClick={addEmail} size="icon">
										<Plus className="h-4 w-4" />
									</Button>
								</div>
							</div>

							{emailList.length > 0 && (
								<div className="space-y-2">
									<Label>Recipients ({emailList.length}/20)</Label>
									<div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
										{emailList.map((email) => (
											<Badge key={email} variant="secondary" className="gap-1">
												{email}
												<Button
													variant="ghost"
													size="icon"
													className="h-3 w-3 p-0 hover:bg-destructive hover:text-destructive-foreground"
													onClick={() => removeEmail(email)}
												>
													<X className="h-2 w-2" />
												</Button>
											</Badge>
										))}
									</div>
								</div>
							)}

							<div className="space-y-2">
								<Label htmlFor="custom-message">
									Custom Message (Optional)
								</Label>
								<Textarea
									id="custom-message"
									placeholder="Add a personal message to your invitation..."
									value={customMessage}
									onChange={(e) => setCustomMessage(e.target.value)}
									rows={3}
									maxLength={500}
								/>
							</div>

							<Button
								onClick={handleSendInvitations}
								disabled={
									emailList.length === 0 || sendInvitationsMutation.isPending
								}
								className="w-full"
							>
								{sendInvitationsMutation.isPending
									? "Sending Invitations..."
									: `Send Invitations (${emailList.length})`}
							</Button>
						</div>
					</TabsContent>

					<TabsContent value="link" className="space-y-4">
						<div className="space-y-3">
							<div className="text-muted-foreground text-sm">
								Create a shareable link that anyone can use to join the
								discussion.
							</div>

							{inviteLink ? (
								<div className="space-y-3">
									<Label>Invitation Link</Label>
									<div className="flex gap-2">
										<Input
											value={inviteLink}
											readOnly
											className="font-mono text-sm"
										/>
										<Button
											onClick={() => copyToClipboard(inviteLink)}
											size="icon"
											variant="outline"
										>
											<Copy className="h-4 w-4" />
										</Button>
									</div>
									<p className="text-muted-foreground text-xs">
										Share this link with anyone you want to invite to the
										discussion.
									</p>
								</div>
							) : (
								<Button
									onClick={handleCreateLink}
									disabled={createLinkMutation.isPending}
									className="w-full"
								>
									{createLinkMutation.isPending
										? "Creating Link..."
										: "Generate Invitation Link"}
								</Button>
							)}
						</div>
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}
