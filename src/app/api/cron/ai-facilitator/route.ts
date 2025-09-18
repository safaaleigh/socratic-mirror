import { AIFacilitatorService } from "@/server/services/ai-facilitator";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	try {
		// Verify this is actually a cron job request from Vercel
		const userAgent = request.headers.get("user-agent");
		if (!userAgent?.includes("vercel-cron")) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		console.log("AI Facilitator cron job starting...");

		const result =
			await AIFacilitatorService.checkAndTriggerInactiveDiscussions();

		console.log(
			`AI Facilitator completed. Checked ${result.discussionsChecked} discussions, triggered ${result.interventionsTriggered} interventions.`,
		);

		return NextResponse.json({
			success: true,
			discussionsChecked: result.discussionsChecked,
			interventionsTriggered: result.interventionsTriggered,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("AI Facilitator cron job error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
