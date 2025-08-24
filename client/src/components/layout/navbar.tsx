import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Leaf, Sun, Moon, User, LogOut, Calendar } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { NotificationBell } from "@/components/notifications/notification-bell";

export function Navbar() {
  const { user, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-xl border-b border-gray-100/50 dark:border-gray-700/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo and Brand */}
          <Link href="/" className="group flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-forest to-forest-dark rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-forest/25 transition-all duration-300 group-hover:scale-105">
              <Leaf className="text-white w-6 h-6 group-hover:rotate-12 transition-transform duration-300" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-forest to-gray-900 dark:from-white dark:via-forest-light dark:to-white bg-clip-text text-transparent">
                RePlate
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium -mt-1">
                Campus Dining
              </span>
            </div>
          </Link>

          {/* User Info and Actions */}
          <div className="flex items-center space-x-4">
            {!isAuthenticated && (
              <>
                <a
                  href="https://replate-ngo.onrender.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-sm font-medium text-forest hover:text-forest-dark transition-colors duration-200"
                >
                  For NGOs
                </a>
                <div className="flex items-center space-x-2">
                  <Link href="/login">
                    <Button className="bg-forest hover:bg-forest-dark text-white px-4 py-2 rounded-xl font-medium transition-all duration-300 hover:scale-105">
                      Login
                    </Button>
                  </Link>
                </div>
              </>
            )}
            {isAuthenticated && user ? (
              <>
                
                
                <div className="flex items-center space-x-3">
                  {/* Notification Bell */}
                  <NotificationBell />
                  
                  {user.role === "student" && (
                    <Link href="/student">
                      <Button className="bg-forest/10 hover:bg-forest/20 text-forest dark:bg-forest/20 dark:hover:bg-forest/30 dark:text-forest-light border-forest/20 px-4 py-2 rounded-xl font-medium transition-all duration-300 hover:scale-105">
                        Dashboard
                      </Button>
                    </Link>
                  )}
                  
                  {user.role === "admin" && (
                    <Link href="/admin">
                      <Button className="bg-forest/10 hover:bg-forest/20 text-forest dark:bg-forest/20 dark:hover:bg-forest/30 dark:text-forest-light border-forest/20 px-4 py-2 rounded-xl font-medium transition-all duration-300 hover:scale-105">
                        Admin Dashboard
                      </Button>
                    </Link>
                  )}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="w-10 h-10 p-0 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl transition-all duration-300 hover:scale-105">
                      <User className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border border-gray-200/50 dark:border-gray-700/50 shadow-xl rounded-xl">
                    <DropdownMenuItem className="hover:bg-gray-100/80 dark:hover:bg-gray-700/80 rounded-lg">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-gray-200/50 dark:bg-gray-700/50" />
                    <DropdownMenuItem 
                      onClick={() => fetch('/api/auth/logout', { method: 'POST' }).then(() => window.location.href = '/')}
                      className="hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg cursor-pointer"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : null}

            <Button
              onClick={toggleTheme}
              className="w-10 h-10 p-0 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 hover:from-gray-200 hover:to-gray-300 dark:hover:from-gray-700 dark:hover:to-gray-600 rounded-xl shadow-lg transition-all duration-300 hover:scale-105"
            >
              {theme === "light" ? (
                <Sun className="h-5 w-5 text-yellow-500" />
              ) : (
                <Moon className="h-5 w-5 text-blue-400" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
