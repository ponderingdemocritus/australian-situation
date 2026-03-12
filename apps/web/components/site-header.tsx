import { Separator } from "@aus-dash/ui/components/ui/separator";
import { SidebarTrigger } from "@aus-dash/ui/components/ui/sidebar";

export function SiteHeader() {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-2 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
        <div className="flex flex-col">
          <h1 className="text-sm font-medium text-foreground">Dashboard</h1>
          <p className="text-xs text-muted-foreground">Australia situation dashboard</p>
        </div>
      </div>
    </header>
  );
}
