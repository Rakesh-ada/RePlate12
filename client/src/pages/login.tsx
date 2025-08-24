import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { ArrowLeft, Mail, Shield, Users, Eye, EyeOff } from "lucide-react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Login() {
  const [, setLocation] = useLocation();
  const [isAuthenticating, setIsAuthenticating] = React.useState(false);
  const [isAdminAuthenticating, setIsAdminAuthenticating] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("student");
  
  // Admin password verification states
  const [adminPassword, setAdminPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isPasswordVerified, setIsPasswordVerified] = React.useState(false);
  const [isVerifyingPassword, setIsVerifyingPassword] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState("");

  // Check for authentication errors and tab parameter
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authError = urlParams.get('error');
    const tabParam = urlParams.get('tab');
    
    if (authError === 'auth_failed') {
      // Clear the URL parameters
      window.history.replaceState({}, document.title, '/login');
      // You could show a toast notification here
      console.error('Authentication failed');
    }

    if (tabParam === 'admin') {
      setActiveTab('admin');
    }
  }, []);

  const handleStudentLogin = () => {
    setIsAuthenticating(true);
    // Redirect to Google OAuth endpoint for student login
    window.location.href = "/api/auth/google?role=student";
  };

  const handleAdminLogin = () => {
    setIsAdminAuthenticating(true);
    // Redirect to Google OAuth endpoint for admin login (role will be null initially)
    window.location.href = "/api/auth/google?role=admin";
  };

  const handlePasswordVerification = async () => {
    if (!adminPassword.trim()) {
      setPasswordError("Please enter the admin password");
      return;
    }

    setIsVerifyingPassword(true);
    setPasswordError("");

    try {
      console.log('Sending password verification request:', { password: adminPassword });
      
      const response = await fetch("/api/auth/verify-admin-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: adminPassword }),
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (response.ok) {
        setIsPasswordVerified(true);
        setPasswordError("");
      } else {
        const errorData = await response.json();
        setPasswordError(errorData.message || "Invalid admin password");
      }
    } catch (error) {
      setPasswordError("Failed to verify password. Please try again.");
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const handleAdminGoogleLogin = () => {
    if (!isPasswordVerified) {
      setPasswordError("Please verify admin password first");
      return;
    }
    setIsAdminAuthenticating(true);
    window.location.href = "/api/auth/google?role=admin";
  };

  const resetAdminLogin = () => {
    setIsPasswordVerified(false);
    setAdminPassword("");
    setPasswordError("");
  };

  const handleBackToLanding = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-forest/3 to-forest/8 dark:from-gray-900 dark:via-gray-800 dark:to-gray-700">
      <Navbar />
      
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)] px-4">
        <div className="w-full max-w-2xl">
        <div className="text-center mt-6 text-xs text-gray-500 dark:text-gray-400">
            
            </div>
          {/* Back button */}
          <Button
            variant="ghost"
            onClick={handleBackToLanding}
            className="mb-6 text-gray-600 dark:text-gray-400 hover:text-forest dark:hover:text-forest-light"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>

          {/* Login Card with Tabs */}
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 shadow-2xl">
            <CardHeader className="text-center pb-6">
              <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-forest to-forest-dark rounded-2xl flex items-center justify-center shadow-lg">
                <Mail className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                Campus Login
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300">
                Sign in with your Google account to access the campus food claiming system
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="student" className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Student
                  </TabsTrigger>
                  <TabsTrigger value="admin" className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Admin
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="student" className="space-y-6">
                  {/* Student Login Section */}
                  <div className="text-center">
                    
                  </div>

                  <Button
                    onClick={handleStudentLogin}
                    disabled={isAuthenticating}
                    className="w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-500 transition-all duration-200 py-6 text-lg font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAuthenticating ? (
                      <>
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600 mr-3"></div>
                        Authenticating...
                      </>
                    ) : (
                      <>
                        <svg className="w-6 h-6 mr-3" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                        Continue with Google
                      </>
                    )}
                  </Button>

                  {/* Student Features */}
                  <div className="space-y-3 pt-4">
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                      <span>Access to discounted campus meals</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                      <span>Real-time meal availability</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                      <span>Secure claim code system</span>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="admin" className="space-y-6">
                  {/* Admin Password Verification Section */}
                  {!isPasswordVerified ? (
                    <>
                      <div className="text-center">
                        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Shield className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          Admin Access Required
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                          Please enter the admin password to continue
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="admin-password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Admin Password
                          </Label>
                          <div className="relative">
                            <Input
                              id="admin-password"
                              type={showPassword ? "text" : "password"}
                              placeholder="Enter admin password"
                              value={adminPassword}
                              onChange={(e) => setAdminPassword(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && handlePasswordVerification()}
                              className="pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {passwordError && (
                          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                            {passwordError}
                          </div>
                        )}

                        <Button
                          onClick={handlePasswordVerification}
                          disabled={isVerifyingPassword || !adminPassword.trim()}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isVerifyingPassword ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Verifying...
                            </>
                          ) : (
                            "Verify Password"
                          )}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Admin Google Login Section */}
                      <div className="text-center">
                        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          Password Verified ✓
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                          Now continue with Google authentication
                        </p>
                        <Button
                          variant="outline"
                          onClick={resetAdminLogin}
                          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          Use different password
                        </Button>
                      </div>

                      <Button
                        onClick={handleAdminGoogleLogin}
                        disabled={isAdminAuthenticating}
                        className="w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-500 transition-all duration-200 py-6 text-lg font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isAdminAuthenticating ? (
                          <>
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600 mr-3"></div>
                            Authenticating...
                          </>
                        ) : (
                          <>
                            <svg className="w-6 h-6 mr-3" viewBox="0 0 24 24">
                              <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                              />
                              <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                              />
                              <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                              />
                              <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                              />
                            </svg>
                            Continue with Google
                          </>
                        )}
                      </Button>
                    </>
                  )}

                  {/* Admin Features */}
                  <div className="space-y-3 pt-4">
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                      <span>Add and manage food items</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                      <span>Verify student claim codes</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                      <span>Monitor food waste and analytics</span>
                    </div>
                  </div>


                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Footer note */}
          <div className="text-center mt-6 text-xs text-gray-500 dark:text-gray-400">
            
          </div>
        <div></div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
