import { env } from "@/env";
import { Resend } from "resend";

// Initialize Resend client
const resend = new Resend(env.RESEND_API_KEY);

export interface EmailInvitation {
	email: string;
	personalMessage?: string;
}

export interface SendInvitationsParams {
	invitations: EmailInvitation[];
	discussion: {
		id: string;
		name: string;
		description?: string;
		lesson?: {
			title: string;
			description?: string;
		};
	};
	sender: {
		name: string;
		email: string;
	};
	invitationTokens: string[];
	expiresAt: Date;
}

export interface EmailResult {
	email: string;
	invitationId: string;
	status: "sent" | "failed";
	error?: string;
}

export interface SendInvitationsResult {
	sent: EmailResult[];
	totalSent: number;
	totalFailed: number;
}

// Email templates
const createInvitationEmailHtml = (params: {
	recipientEmail: string;
	senderName: string;
	discussionName: string;
	discussionDescription?: string;
	lessonTitle?: string;
	personalMessage?: string;
	invitationUrl: string;
	expiresAt: Date;
}) => {
	const {
		senderName,
		discussionName,
		discussionDescription,
		lessonTitle,
		personalMessage,
		invitationUrl,
		expiresAt,
	} = params;

	const formatDate = (date: Date) => {
		return date.toLocaleDateString("en-US", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	return `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Discussion Invitation</title>
			<style>
				body { 
					font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
					line-height: 1.6; 
					color: #333; 
					background-color: #f8f9fa; 
					margin: 0; 
					padding: 20px; 
				}
				.container { 
					max-width: 600px; 
					margin: 0 auto; 
					background: white; 
					border-radius: 10px; 
					box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); 
					overflow: hidden; 
				}
				.header { 
					background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
					color: white; 
					padding: 30px; 
					text-align: center; 
				}
				.header h1 { 
					margin: 0; 
					font-size: 24px; 
					font-weight: 300; 
				}
				.content { 
					padding: 30px; 
				}
				.discussion-info { 
					background: #f8f9fa; 
					border-left: 4px solid #667eea; 
					padding: 20px; 
					margin: 20px 0; 
					border-radius: 4px; 
				}
				.discussion-info h2 { 
					margin: 0 0 10px 0; 
					color: #667eea; 
					font-size: 18px; 
				}
				.personal-message { 
					background: #e3f2fd; 
					border-left: 4px solid #2196f3; 
					padding: 15px; 
					margin: 20px 0; 
					border-radius: 4px; 
					font-style: italic; 
				}
				.cta-button { 
					display: inline-block; 
					background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
					color: white; 
					text-decoration: none; 
					padding: 15px 30px; 
					border-radius: 25px; 
					font-weight: bold; 
					text-align: center; 
					margin: 20px 0; 
					transition: transform 0.2s; 
				}
				.cta-button:hover { 
					transform: translateY(-2px); 
				}
				.footer { 
					background: #f8f9fa; 
					padding: 20px; 
					text-align: center; 
					font-size: 12px; 
					color: #666; 
					border-top: 1px solid #eee; 
				}
				.expires-info { 
					background: #fff3cd; 
					border: 1px solid #ffeaa7; 
					padding: 10px; 
					margin: 15px 0; 
					border-radius: 4px; 
					font-size: 14px; 
				}
				@media (max-width: 600px) {
					.container { margin: 0; border-radius: 0; }
					.content { padding: 20px; }
					.header { padding: 20px; }
				}
			</style>
		</head>
		<body>
			<div class="container">
				<div class="header">
					<h1>🎓 You're Invited to Join a Discussion</h1>
				</div>
				
				<div class="content">
					<p>Hello!</p>
					<p><strong>${senderName}</strong> has invited you to join an educational discussion on <strong>Socratic</strong>.</p>
					
					${
						personalMessage
							? `
						<div class="personal-message">
							<strong>Personal message from ${senderName}:</strong><br>
							"${personalMessage}"
						</div>
					`
							: ""
					}
					
					<div class="discussion-info">
						<h2>${discussionName}</h2>
						${discussionDescription ? `<p>${discussionDescription}</p>` : ""}
						${lessonTitle ? `<p><strong>Based on lesson:</strong> ${lessonTitle}</p>` : ""}
					</div>
					
					<div style="text-align: center;">
						<a href="${invitationUrl}" class="cta-button">
							Join Discussion
						</a>
					</div>
					
					<div class="expires-info">
						<strong>⏰ Important:</strong> This invitation expires on ${formatDate(expiresAt)}
					</div>
					
					<p>Socratic is a platform for engaging educational discussions that help you think critically and learn collaboratively with others.</p>
					
					<hr style="border: none; height: 1px; background: #eee; margin: 30px 0;">
					
					<p style="font-size: 14px; color: #666;">
						Can't click the button? Copy and paste this link into your browser:<br>
						<a href="${invitationUrl}" style="color: #667eea; word-break: break-all;">${invitationUrl}</a>
					</p>
				</div>
				
				<div class="footer">
					<p>This invitation was sent by ${senderName} (${params.senderName}) through Socratic.</p>
					<p>If you don't want to receive invitations, you can ignore this email.</p>
				</div>
			</div>
		</body>
		</html>
	`;
};

const createInvitationEmailText = (params: {
	recipientEmail: string;
	senderName: string;
	discussionName: string;
	discussionDescription?: string;
	lessonTitle?: string;
	personalMessage?: string;
	invitationUrl: string;
	expiresAt: Date;
}) => {
	const {
		senderName,
		discussionName,
		discussionDescription,
		lessonTitle,
		personalMessage,
		invitationUrl,
		expiresAt,
	} = params;

	const formatDate = (date: Date) => {
		return date.toLocaleDateString("en-US", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	return `
You're Invited to Join a Discussion on Socratic

Hello!

${senderName} has invited you to join an educational discussion on Socratic.

${
	personalMessage
		? `Personal message from ${senderName}:
"${personalMessage}"

`
		: ""
}Discussion: ${discussionName}
${discussionDescription ? `Description: ${discussionDescription}` : ""}
${lessonTitle ? `Based on lesson: ${lessonTitle}` : ""}

Join the discussion: ${invitationUrl}

IMPORTANT: This invitation expires on ${formatDate(expiresAt)}

Socratic is a platform for engaging educational discussions that help you think critically and learn collaboratively with others.

---

This invitation was sent by ${senderName} through Socratic.
If you don't want to receive invitations, you can ignore this email.
	`.trim();
};

export class EmailService {
	private resend: Resend;

	constructor() {
		this.resend = resend;
	}

	/**
	 * Send discussion invitations to multiple recipients
	 */
	async sendInvitations(
		params: SendInvitationsParams,
	): Promise<SendInvitationsResult> {
		const results: EmailResult[] = [];
		let totalSent = 0;
		let totalFailed = 0;

		// Process invitations in parallel with rate limiting
		const promises = params.invitations.map(async (invitation, index) => {
			const token = params.invitationTokens[index];
			if (!token) {
				const error = "Missing invitation token";
				results.push({
					email: invitation.email,
					invitationId: "",
					status: "failed",
					error,
				});
				totalFailed++;
				return;
			}

			try {
				// Create invitation URL
				const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
				const invitationUrl = `${baseUrl}/invite/${token}`;

				// Prepare email content
				const emailParams = {
					recipientEmail: invitation.email,
					senderName: params.sender.name,
					discussionName: params.discussion.name,
					discussionDescription: params.discussion.description,
					lessonTitle: params.discussion.lesson?.title,
					personalMessage: invitation.personalMessage,
					invitationUrl,
					expiresAt: params.expiresAt,
				};

				const htmlContent = createInvitationEmailHtml(emailParams);
				const textContent = createInvitationEmailText(emailParams);

				// Send email via Resend
				const response = await this.resend.emails.send({
					from: "Socratic Discussions <invitations@socratic-platform.com>",
					to: [invitation.email],
					subject: `Join "${params.discussion.name}" - Discussion Invitation`,
					html: htmlContent,
					text: textContent,
					headers: {
						"X-Discussion-Id": params.discussion.id,
						"X-Sender-Email": params.sender.email,
					},
					tags: [
						{ name: "type", value: "discussion-invitation" },
						{ name: "discussion-id", value: params.discussion.id },
					],
				});

				if (response.data?.id) {
					results.push({
						email: invitation.email,
						invitationId: response.data.id,
						status: "sent",
					});
					totalSent++;
				} else {
					const error = response.error?.message || "Unknown error";
					results.push({
						email: invitation.email,
						invitationId: "",
						status: "failed",
						error,
					});
					totalFailed++;
				}
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error";
				results.push({
					email: invitation.email,
					invitationId: "",
					status: "failed",
					error: errorMessage,
				});
				totalFailed++;
			}

			// Rate limiting delay to avoid overwhelming Resend
			await new Promise((resolve) => setTimeout(resolve, 100));
		});

		await Promise.all(promises);

		return {
			sent: results,
			totalSent,
			totalFailed,
		};
	}

	/**
	 * Send a single invitation email
	 */
	async sendSingleInvitation(params: {
		email: string;
		personalMessage?: string;
		discussion: SendInvitationsParams["discussion"];
		sender: SendInvitationsParams["sender"];
		invitationToken: string;
		expiresAt: Date;
	}): Promise<{ success: boolean; error?: string; messageId?: string }> {
		try {
			const result = await this.sendInvitations({
				invitations: [
					{
						email: params.email,
						personalMessage: params.personalMessage,
					},
				],
				discussion: params.discussion,
				sender: params.sender,
				invitationTokens: [params.invitationToken],
				expiresAt: params.expiresAt,
			});

			const emailResult = result.sent[0];
			if (emailResult?.status === "sent") {
				return {
					success: true,
					messageId: emailResult.invitationId,
				};
			}
			return {
				success: false,
				error: emailResult?.error || "Failed to send email",
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Resend an invitation email
	 */
	async resendInvitation(params: {
		originalEmail: string;
		discussion: SendInvitationsParams["discussion"];
		sender: SendInvitationsParams["sender"];
		invitationToken: string;
		expiresAt: Date;
		personalMessage?: string;
	}): Promise<{ success: boolean; error?: string; messageId?: string }> {
		return this.sendSingleInvitation({
			email: params.originalEmail,
			personalMessage: params.personalMessage,
			discussion: params.discussion,
			sender: params.sender,
			invitationToken: params.invitationToken,
			expiresAt: params.expiresAt,
		});
	}

	/**
	 * Send discussion summary email
	 */
	async sendDiscussionSummary(params: {
		participants: Array<{ email: string; name: string }>;
		discussion: {
			id: string;
			name: string;
			messageCount: number;
			keyInsights: string[];
			duration: string;
		};
		sender: SendInvitationsParams["sender"];
	}): Promise<{ success: boolean; error?: string }> {
		try {
			const emailPromises = params.participants.map(async (participant) => {
				const htmlContent = `
					<h1>Discussion Summary: ${params.discussion.name}</h1>
					<p>Hello ${participant.name},</p>
					<p>Thank you for participating in our discussion! Here's a summary:</p>
					<ul>
						<li><strong>Messages exchanged:</strong> ${params.discussion.messageCount}</li>
						<li><strong>Duration:</strong> ${params.discussion.duration}</li>
					</ul>
					<h3>Key Insights:</h3>
					<ul>
						${params.discussion.keyInsights.map((insight) => `<li>${insight}</li>`).join("")}
					</ul>
					<p>Best regards,<br>${params.sender.name}</p>
				`;

				return this.resend.emails.send({
					from: "Socratic Discussions <summaries@socratic-platform.com>",
					to: [participant.email],
					subject: `Discussion Summary: ${params.discussion.name}`,
					html: htmlContent,
					tags: [
						{ name: "type", value: "discussion-summary" },
						{ name: "discussion-id", value: params.discussion.id },
					],
				});
			});

			await Promise.all(emailPromises);
			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}
}

// Export singleton instance
export const emailService = new EmailService();
