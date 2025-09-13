"use client";

import { Suspense } from "react";
import { JoinPageContent } from "./_components/join-page-content";

export default async function JoinDiscussionPage({
	params,
}: {
	params: Promise<{ discussionId: string }>;
}) {
	const { discussionId } = await params;

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-md">
				<Suspense
					fallback={
						<div className="text-center">
							<div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-gray-900 border-b-2" />
							<p className="text-muted-foreground">Loading...</p>
						</div>
					}
				>
					<JoinPageContent discussionId={discussionId} />
				</Suspense>
			</div>
		</div>
	);
}
