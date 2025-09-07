import * as React from "react";

import { AppSidebar } from "@/components/app-sidebar";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";

interface DashboardLayoutProps {
	children: React.ReactNode;
	breadcrumbItems?: Array<{
		label: string;
		href?: string;
		isCurrentPage?: boolean;
	}>;
}

export function DashboardLayout({
	children,
	breadcrumbItems,
}: DashboardLayoutProps) {
	return (
		<SidebarProvider
			style={
				{
					"--sidebar-width": "19rem",
				} as React.CSSProperties
			}
		>
			<AppSidebar />
			<SidebarInset>
				<header className="flex h-16 shrink-0 items-center gap-2 px-4">
					<SidebarTrigger className="-ml-1" />
					<Separator
						orientation="vertical"
						className="mr-2 data-[orientation=vertical]:h-4"
					/>
					{breadcrumbItems && (
						<Breadcrumb>
							<BreadcrumbList>
								{breadcrumbItems.map((item, index) => (
									<React.Fragment key={item.label}>
										<BreadcrumbItem
											className={index === 0 ? "hidden md:block" : ""}
										>
											{item.isCurrentPage ? (
												<BreadcrumbPage>{item.label}</BreadcrumbPage>
											) : (
												<BreadcrumbLink href={item.href || "#"}>
													{item.label}
												</BreadcrumbLink>
											)}
										</BreadcrumbItem>
										{index < breadcrumbItems.length - 1 && (
											<BreadcrumbSeparator className="hidden md:block" />
										)}
									</React.Fragment>
								))}
							</BreadcrumbList>
						</Breadcrumb>
					)}
				</header>
				<div className="flex flex-1 flex-col gap-4 p-4 pt-0">{children}</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
