"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Settings,
  Users,
  LogOut,
  ChevronDown,
  Bell,
  Sun,
  Moon,
  Globe,
  User,
} from "lucide-react";

export default function UserDropdown() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const [currentTheme, setCurrentTheme] = useState<"light" | "dark">("light");

  const toggleTheme = () => {
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    setCurrentTheme(newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const toggleLanguage = () => {
    // Language toggle functionality - could be expanded
  };

  const userInitials = useMemo(() => {
    if (!user?.name) return "U";
    const names = user.name.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return user.name.slice(0, 2).toUpperCase();
  }, [user?.name]);

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative flex items-center gap-2 px-2 py-1 h-auto rounded-lg hover:bg-muted/50 transition-colors"
          aria-label={t("userMenu") || "User menu"}
          aria-haspopup="true"
        >
          <Avatar className="h-8 w-8 ring-2 ring-primary/10">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:flex flex-col items-start text-left">
            <span className="text-sm font-medium truncate max-w-[100px]">
              {user.name}
            </span>
            <span className="text-[10px] text-muted-foreground truncate capitalize max-w-[100px]">
              {user.role}
            </span>
          </div>
          <ChevronDown className="hidden md:block h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-56 z-50"
        sideOffset={5}
      >
        <DropdownMenuLabel className="flex flex-col items-start gap-1 p-3 bg-muted/30">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <p className="text-sm font-medium truncate">
                {user.name}
              </p>
              <p className="text-xs text-muted-foreground truncate capitalize">
                {user.role}
              </p>
              {user.email && (
                <p className="text-[10px] text-muted-foreground truncate">
                  {user.email}
                </p>
              )}
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => handleNavigation("/profile")}
          className="cursor-pointer"
        >
          <User className="h-4 w-4 mr-2" aria-hidden="true" />
          <span>{t("profile") || "Profile"}</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleNavigation("/settings")}
          className="cursor-pointer"
        >
          <Settings className="h-4 w-4 mr-2" aria-hidden="true" />
          <span>{t("settings") || "Settings"}</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleNavigation("/users")}
          className="cursor-pointer"
        >
          <Users className="h-4 w-4 mr-2" aria-hidden="true" />
          <span>{t("users") || "Users"}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => handleNavigation("/notifications")}
          className="cursor-pointer"
        >
          <Bell className="h-4 w-4 mr-2" aria-hidden="true" />
          <span>{t("notifications")}</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer">
          {currentTheme === "dark" ? (
            <Sun className="h-4 w-4 mr-2" aria-hidden="true" />
          ) : (
            <Moon className="h-4 w-4 mr-2" aria-hidden="true" />
          )}
          <span>{currentTheme === "dark" ? t("lightMode") : t("darkMode")}</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={toggleLanguage} className="cursor-pointer">
          <Globe className="h-4 w-4 mr-2" aria-hidden="true" />
          <span>{t("changeLanguage")}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
        >
          <LogOut className="h-4 w-4 mr-2" aria-hidden="true" />
          <span>{t("logout") || "Logout"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
