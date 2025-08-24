import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";

export default function AdminPending() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  React.useEffect(() => {
    // Redirect if user is not authenticated
    if (!isLoading && !user) {
      setLocation("/");
      return;
    }

    // If user has a role (not null), redirect appropriately
    if (!isLoading && user && user.role !== null) {
      if (user.role === "admin") {
        setLocation("/admin");
      } else if (user.role === "student") {
        setLocation("/student");
      } else {
        setLocation("/");
      }
    }
  }, [user, isLoading, setLocation]);

  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST' }).then(() => {
      window.location.href = '/';
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forest mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-gray-900">
      <Navbar />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Admin Access Pending
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Your admin access request is currently under review. You'll be notified once your account has been approved.
          </p>
        </div>

      

        <Card className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                  Important Information
                </h3>
                <p className="text-yellow-700 dark:text-yellow-300 mb-4">
                  While your admin access is pending, you can still use the system as a student to claim meals. 
                  Your admin privileges will be activated once your request is approved.
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={() => setLocation("/student")}
                    className="bg-forest hover:bg-forest-dark text-white"
                  >
                    Continue as Student
                  </Button>
                  <Button
                    onClick={handleLogout}
                    variant="outline"
                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Logout
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
}
