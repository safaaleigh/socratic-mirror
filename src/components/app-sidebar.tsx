"use client";

import {
	BarChart3,
	BookOpen,
	ChevronUp,
	GraduationCap,
	LogOut,
	MessageCircle,
	User2,
	Users,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import type * as React from "react";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "@/components/ui/sidebar";

const data = {
	navMain: [
		{
			title: "Lessons",
			url: "/lessons",
			icon: GraduationCap,
		},
		{
			title: "Discussions",
			url: "/discussions",
			icon: MessageCircle,
		},
		{
			title: "Groups",
			url: "/groups",
			icon: Users,
		},
		{
			title: "Dashboard",
			url: "/dashboard",
			icon: BarChart3,
		},
	],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const { data: session } = useSession();

	const handleSignOut = () => {
		signOut({ callbackUrl: "/auth/signin" });
	};

	return (
		<Sidebar variant="floating" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild>
							<a href="/">
								<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
									<BookOpen className="size-4" />
								</div>
								<div className="flex flex-col gap-0.5 leading-none">
									<span className="font-medium">Socratic</span>
									<span className="">Learning Platform</span>
								</div>
							</a>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarMenu className="gap-2">
						{data.navMain.map((item) => {
							const Icon = item.icon;
							return (
								<SidebarMenuItem key={item.title}>
									<SidebarMenuButton asChild>
										<a href={item.url} className="font-medium">
											<Icon className="size-4" />
											{item.title}
										</a>
									</SidebarMenuButton>
								</SidebarMenuItem>
							);
						})}
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				{session?.user && (
					<SidebarMenu>
						<SidebarMenuItem>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<SidebarMenuButton
										size="lg"
										className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
									>
										<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
											{session.user.image ? (
												<img
													src={session.user.image}
													alt={session.user.name || "User"}
													className="size-6 rounded-lg"
												/>
											) : (
												<User2 className="size-4" />
											)}
										</div>
										<div className="flex flex-col gap-0.5 leading-none">
											<span className="font-medium">
												{session.user.name || "User"}
											</span>
											<span className="text-xs">{session.user.email}</span>
										</div>
										<ChevronUp className="ml-auto size-4" />
									</SidebarMenuButton>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
									side="right"
									align="end"
									sideOffset={4}
								>
									<DropdownMenuItem onClick={handleSignOut}>
										<LogOut className="mr-2 size-4" />
										Sign out
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</SidebarMenuItem>
					</SidebarMenu>
				)}
			</SidebarFooter>
		</Sidebar>
	);
}
