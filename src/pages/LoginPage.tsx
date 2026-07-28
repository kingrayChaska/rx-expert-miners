import { useState } from "react";
import { supabase } from "@/services/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageToggle from "@/components/shared/LanguageToggle";
import { Database, Shield, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type AuthMode = "login" | "signup";

const LoginPage = () => {
  const { t, lang } = useLanguage();
  const isRTL = lang === "ar";
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);

  const handleResendConfirmation = async () => {
    if (!email.trim()) {
      toast.error(
        isRTL
          ? "أدخل البريد الإلكتروني أولاً."
          : "Enter your email address first.",
      );
      return;
    }

    setResendingConfirmation(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
      });
      if (error) throw error;
      toast.success(
        isRTL
          ? "تم إرسال بريد التفعيل مرة أخرى."
          : "A new confirmation email has been sent.",
      );
    } catch (err: any) {
      const msg = err.message || "";
      toast.error(
        msg ||
          (isRTL
            ? "تعذر إرسال بريد التفعيل."
            : "Unable to resend the confirmation email."),
      );
    } finally {
      setResendingConfirmation(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) toast.error(error.message);
  };

  const handleAppleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo: window.location.origin },
    });
    if (error) toast.error(error.message);
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (password.length < 6) {
      toast.error(
        isRTL
          ? "كلمة المرور يجب أن تكون 6 أحرف على الأقل"
          : "Password must be at least 6 characters",
      );
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success(
          isRTL
            ? "تم إنشاء الحساب. تحقق من بريدك الإلكتروني."
            : "Account created. Check your email to verify.",
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.includes("Invalid login credentials")) {
        toast.error(
          isRTL
            ? "بيانات تسجيل الدخول غير صحيحة. تحقق من البريد وكلمة المرور."
            : "Invalid email or password. Please check and try again.",
        );
      } else if (msg.includes("User already registered")) {
        toast.error(
          isRTL
            ? "هذا البريد مسجل بالفعل. جرب تسجيل الدخول بدلاً من ذلك."
            : "This email is already registered. Try signing in instead.",
        );
        setMode("login");
      } else if (msg.includes("Email not confirmed")) {
        toast.error(
          isRTL
            ? "يرجى تأكيد البريد الإلكتروني أولاً. يمكنك إعادة إرسال رابط التفعيل أدناه."
            : "Your email address still needs confirmation. You can resend the verification email below.",
        );
      } else {
        toast.error(
          msg ||
            (isRTL
              ? "حدث خطأ. حاول مرة أخرى."
              : "An error occurred. Please try again."),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className={`absolute top-4 ${isRTL ? "left-4" : "right-4"}`}>
        <LanguageToggle />
      </div>

      <div
        className="glass-card rounded-2xl p-8 md:p-10 max-w-md w-full space-y-6"
        dir={isRTL ? "rtl" : "ltr"}
      >
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center">
              <Database className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <div>
            <h1
              className="text-2xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("appName")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{t("welcome")}</p>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex rounded-lg overflow-hidden border border-border">
          <button
            onClick={() => setMode("login")}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === "login"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {isRTL ? "تسجيل الدخول" : "Sign In"}
          </button>
          <button
            onClick={() => setMode("signup")}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === "signup"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {isRTL ? "إنشاء حساب" : "Sign Up"}
          </button>
        </div>

        {/* Email/Password form */}
        <form onSubmit={handleEmailAuth} className="space-y-3">
          <Input
            type="email"
            placeholder={isRTL ? "البريد الإلكتروني" : "Email address"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder={isRTL ? "كلمة المرور" : "Password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              className={isRTL ? "pl-10" : "pr-10"}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground ${isRTL ? "left-3" : "right-3"}`}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? isRTL
                ? "جاري..."
                : "Please wait..."
              : mode === "login"
                ? isRTL
                  ? "تسجيل الدخول"
                  : "Sign In"
                : isRTL
                  ? "إنشاء حساب"
                  : "Create Account"}
          </Button>

          {mode === "login" && (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={handleResendConfirmation}
              disabled={resendingConfirmation || !email.trim()}
            >
              {resendingConfirmation
                ? isRTL
                  ? "جاري الإرسال..."
                  : "Sending..."
                : isRTL
                  ? "إعادة إرسال بريد التفعيل"
                  : "Resend confirmation email"}
            </Button>
          )}
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-border" />
          <span className="text-xs text-muted-foreground">
            {isRTL ? "أو" : "OR"}
          </span>
          <div className="flex-1 border-t border-border" />
        </div>

        {/* Google button */}
        <Button
          type="button"
          onClick={handleGoogleSignIn}
          variant="outline"
          className="w-full gap-3"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {t("signIn")}
        </Button>

        {/* Apple button */}
        <Button
          type="button"
          onClick={handleAppleSignIn}
          variant="outline"
          className="w-full gap-3"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
            />
          </svg>
          {isRTL ? "تسجيل الدخول بـ Apple" : "Sign in with Apple"}
        </Button>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-3 w-3" />
          <span>{isRTL ? "وصول آمن فقط" : "Secure access only"}</span>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
