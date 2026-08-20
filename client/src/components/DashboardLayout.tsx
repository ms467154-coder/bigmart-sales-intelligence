import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { Activity, BarChart3, BrainCircuit, Database, FlaskConical, LayoutDashboard, LogOut, PanelLeft, ScanLine, Settings2, TriangleAlert, Upload } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";

const menuItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/" },
  { icon: FlaskConical, label: "Experiments", path: "/experiments" },
  { icon: BarChart3, label: "Segments", path: "/segments" },
  { icon: Upload, label: "Batch prediction", path: "/predictions" },
  { icon: TriangleAlert, label: "Error analysis", path: "/errors" },
  { icon: Activity, label: "MLOps status", path: "/mlops" },
];

const SIDEBAR_WIDTH_KEY = "bigmart-sidebar-width";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => Number(localStorage.getItem(SIDEBAR_WIDTH_KEY) ?? 270));
  useEffect(() => localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString()), [sidebarWidth]);
  return <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}><DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent></SidebarProvider>;
}

function DashboardLayoutContent({ children, setSidebarWidth }: { children: React.ReactNode; setSidebarWidth: (width: number) => void }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const isMobile = useIsMobile();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (!isResizing) return;
    const move = (event: MouseEvent) => {
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const width = Math.min(360, Math.max(224, event.clientX - left));
      setSidebarWidth(width);
    };
    const up = () => setIsResizing(false);
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    return () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
  }, [isResizing, setSidebarWidth]);

  return <>
    <div ref={sidebarRef} className="relative">
      <Sidebar collapsible="icon" className="border-r border-[var(--line)] bg-[var(--cream)]" disableTransition={isResizing}>
        <SidebarHeader className="h-24 justify-center border-b border-[var(--line)] px-4">
          <div className="flex items-center gap-3 w-full">
            <button onClick={toggleSidebar} aria-label="Toggle navigation" className="brand-mark"><BrainCircuit className="h-5 w-5" /></button>
            {!isCollapsed && <div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--red)]">BigMart</p><p className="truncate text-sm font-semibold tracking-tight">Sales intelligence</p></div>}
          </div>
        </SidebarHeader>
        <SidebarContent className="px-3 py-5"><div className="eyebrow px-3 pb-2">Workspace</div><SidebarMenu>{menuItems.map(item => <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={location === item.path} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-11 rounded-xl px-3 text-sm"><item.icon className="h-4 w-4" /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarContent>
        <SidebarFooter className="border-t border-[var(--line)] p-3">
          {user ? <DropdownMenu><DropdownMenuTrigger asChild><button className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-white/70"><Avatar className="h-8 w-8"><AvatarFallback className="bg-[var(--ink)] text-xs text-white">{user.name?.charAt(0).toUpperCase() ?? "M"}</AvatarFallback></Avatar><span className="min-w-0 flex-1 truncate text-xs font-medium">{user.name ?? "Signed in"}</span></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={logout}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem></DropdownMenuContent></DropdownMenu> : <button onClick={() => startLogin()} className="flex items-center gap-2 rounded-xl p-2 text-xs text-[var(--muted)] hover:bg-white/70"><Settings2 className="h-4 w-4" />Optional sign in</button>}
        </SidebarFooter>
      </Sidebar>
      {!isCollapsed && <div className="absolute right-0 top-0 z-50 h-full w-1 cursor-col-resize hover:bg-[var(--red)]/30" onMouseDown={() => setIsResizing(true)} />}
    </div>
    <SidebarInset className="bg-[var(--cream)]"><div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[var(--line)] bg-[var(--cream)]/90 px-4 backdrop-blur md:px-8"><div className="flex items-center gap-3">{isMobile && <SidebarTrigger className="h-9 w-9" />}<div><p className="eyebrow">Mohamed Salem · AI engineering</p><p className="text-sm font-semibold">{menuItems.find(item => item.path === location)?.label ?? "Overview"}</p></div></div><div className="flex items-center gap-2"><span className="status-dot" /> <span className="hidden text-xs text-[var(--muted)] sm:inline">Model v001 ready</span><ScanLine className="h-4 w-4 text-[var(--muted)]" /></div></div><main className="min-h-[calc(100vh-4rem)] p-4 md:p-8">{children}</main></SidebarInset>
  </>;
}
