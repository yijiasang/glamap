import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-profiles";
import { MapPin, MessageSquare, User, LogOut, Settings, Pencil, Bell, X, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import glamapLogo from "/glamap-logo.png";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Notification } from "@shared/schema";
import { api } from "@shared/routes";
import { formatDistanceToNow } from "date-fns";

export function Navigation() {
  const [location, setLocation] = useLocation();
  const { user, logout, isAuthenticated, getToken, isLoading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: [api.notifications.list.path],
    enabled: isAuthenticated,
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(api.notifications.list.path, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return api.notifications.list.responses[200].parse(await res.json());
    },
    refetchInterval: 30000,
  });

  const deleteNotification = useMutation({
    mutationFn: async (id: number) => {
      const token = await getToken();
      const url = `/api/notifications/${id}`;
      const res = await fetch(url, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to delete notification");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.notifications.list.path] }),
  });

  const clearAllNotifications = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      const res = await fetch('/api/notifications', {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to clear notifications");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.notifications.list.path] }),
  });

  const markAsRead = useMutation({
    mutationFn: async (id: number) => {
      const token = await getToken();
      const url = `/api/notifications/${id}/read`;
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to mark notification as read");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.notifications.list.path] }),
  });

  const unreadCount = notifications.filter((n: Notification) => !n.read).length;
  const showProfileItems = profileLoading || !!profile;

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead.mutate(notification.id);
    }
    if (notification.link) {
      setLocation(notification.link);
    }
  };

  const isActive = (path: string) => location === path;

  return (
    <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 h-20 flex items-center">
        {/* Left - Logo */}
        <div className="flex-1 flex items-center justify-start">
          <img src={glamapLogo} alt="Glamap" className="h-24" />
        </div>
        
        {/* Center - Explore */}
        <div className="hidden md:flex items-center justify-center">
          <Link href="/" className="px-5 py-2.5 rounded-full text-base font-medium transition-colors bg-primary/10 text-primary hover:bg-primary/20">
            <span className="flex items-center gap-2"><MapPin size={18} /> Explore</span>
          </Link>
        </div>

        {/* Right - Messages, Notifications, Profile */}
        <div className="flex-1 flex items-center justify-end gap-2 sm:gap-3">
          {isLoading ? (
            <div className="h-11 w-28 rounded-full bg-muted/50 animate-pulse" aria-hidden="true" />
          ) : !isAuthenticated ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link href="/login" className="hidden sm:block">
                <Button variant="ghost" className="font-medium text-base">Sign In</Button>
              </Link>
              <Link href="/login">
                <Button className="rounded-full px-5 sm:px-7 py-2.5 text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all">
                  <span className="hidden sm:inline">Get Started</span>
                  <span className="sm:hidden">Sign In</span>
                </Button>
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {/* Messages */}
              <Link href="/messages">
                <Button variant="ghost" size="icon" className="relative h-11 w-11" data-testid="button-messages">
                  <MessageSquare size={22} />
                </Button>
              </Link>
              
              {/* Notifications */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative h-11 w-11" data-testid="button-notifications">
                    <Bell size={22} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center bg-pink-500 text-white text-xs font-bold rounded-full">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-80 bg-background border-border shadow-xl" align="end">
                  <div className="flex items-center justify-between px-3 py-2">
                    <DropdownMenuLabel className="p-0 font-semibold">Notifications</DropdownMenuLabel>
                    {notifications.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto py-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => clearAllNotifications.mutate()}
                        data-testid="button-clear-all-notifications"
                      >
                        Clear all
                      </Button>
                    )}
                  </div>
                  <DropdownMenuSeparator />
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground text-sm">
                        No notifications yet
                      </div>
                    ) : (
                      notifications.map((notification: Notification) => (
                        <div
                          key={notification.id}
                          className={`relative group px-3 py-3 hover:bg-muted/50 cursor-pointer border-b border-border/50 last:border-b-0 ${!notification.read ? 'bg-primary/5' : ''}`}
                          onClick={() => handleNotificationClick(notification)}
                          data-testid={`notification-item-${notification.id}`}
                        >
                          <div className="pr-6">
                            <p className="text-sm font-medium">{notification.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">{notification.content}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {notification.createdAt && formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification.mutate(notification.id);
                            }}
                            className="absolute right-2 top-2 p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
                            data-testid={`button-delete-notification-${notification.id}`}
                          >
                            <X size={14} className="text-muted-foreground" />
                          </button>
                          {!notification.read && (
                            <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-pink-500 rounded-full" />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-12 w-12 rounded-full ring-2 ring-transparent hover:ring-primary/20 transition-all">
                    <Avatar className="h-11 w-11 border border-border" key={profile?.profileImageUrl}>
                      <AvatarImage src={profile?.profileImageUrl || undefined} alt={profile?.username || 'Profile'} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                        {profile?.username?.[0]?.toUpperCase() || user?.firstName?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-background border-border shadow-xl opacity-100" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user?.firstName} {user?.lastName}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={profile ? `/profile/${profile.id}` : "/onboarding"} className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      <span>My Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  {showProfileItems && (
                    <>
                      {profile ? (
                        <DropdownMenuItem asChild>
                          <Link href="/edit-profile" className="cursor-pointer">
                            <Pencil className="mr-2 h-4 w-4" />
                            <span>Edit Profile</span>
                          </Link>
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem disabled>
                          <Pencil className="mr-2 h-4 w-4" />
                          <span>Edit Profile</span>
                        </DropdownMenuItem>
                      )}
                      {profile ? (
                        <DropdownMenuItem asChild>
                          <Link href="/settings" className="cursor-pointer">
                            <Settings className="mr-2 h-4 w-4" />
                            <span>Settings</span>
                          </Link>
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem disabled>
                          <Settings className="mr-2 h-4 w-4" />
                          <span>Settings</span>
                        </DropdownMenuItem>
                      )}
                      {profile?.isAdmin ? (
                        <DropdownMenuItem asChild>
                          <Link href="/admin" className="cursor-pointer" data-testid="link-admin">
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            <span>Admin Dashboard</span>
                          </Link>
                        </DropdownMenuItem>
                      ) : profileLoading ? (
                        <DropdownMenuItem disabled>
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          <span>Admin Dashboard</span>
                        </DropdownMenuItem>
                      ) : null}
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => logout()} className="text-destructive focus:text-destructive cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
