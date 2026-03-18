"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from "@aus-dash/ui";
import {
  IconBolt,
  IconChartBar,
  IconDatabase,
  IconFileDescription,
  IconHome,
  IconListDetails,
  IconReceipt,
  IconSearch
} from "@tabler/icons-react";
import { dashboardNavItems } from "../features/site/content";

const icons = {
  Energy: IconBolt,
  Housing: IconHome,
  Methodology: IconFileDescription,
  Overview: IconChartBar,
  Prices: IconReceipt,
  Series: IconSearch,
  Sources: IconDatabase
} as const;

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="/dashboard">
                <IconListDetails />
                <span className="text-base font-semibold">Australia Situation</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {dashboardNavItems.map((item) => {
            const Icon = icons[item.label as keyof typeof icons] ?? IconChartBar;

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild tooltip={item.label}>
                  <a href={item.href}>
                    <Icon />
                    <span>{item.label}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 text-xs leading-5 text-sidebar-foreground/70">
          SDK-backed dashboard routes
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
