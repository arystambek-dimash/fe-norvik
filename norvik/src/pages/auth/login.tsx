import { useState } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/auth-context";
import { ROUTES } from "@/lib/constants";
import { handleApiError } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Diamond } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  if (authLoading) return null;
  if (isAuthenticated) return <Navigate to={ROUTES.DASHBOARD} replace />;

  const onSubmit = async (data: LoginForm) => {
    setIsSubmitting(true);
    try {
      await login(data);
      navigate(ROUTES.DASHBOARD);
    } catch (err) {
      handleApiError(err, "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel — decorative */}
      <div className="hidden w-1/2 bg-espresso lg:flex lg:flex-col lg:items-center lg:justify-center lg:p-12">
        <div className="max-w-md space-y-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
            <Diamond className="h-8 w-8 text-brass" />
          </div>
          <h2 className="text-4xl tracking-tight text-white">
            Crafting Exceptional Spaces
          </h2>
          <p className="text-base leading-relaxed text-white/50">
            Design, configure, and manage premium kitchen cabinets with precision and elegance.
          </p>
          <div className="mx-auto h-px w-24 bg-white/10" />
          <p className="text-xs uppercase tracking-[0.3em] text-white/25">
            Norvik Studio
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex w-full items-center justify-center bg-background px-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <Diamond className="h-6 w-6 text-primary" />
            <span className="font-display text-xl font-bold">Norvik</span>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl tracking-tight">Welcome back</h1>
            <p className="mt-2 text-sm text-muted-foreground">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</Label>
              <Input id="email" type="email" placeholder="you@company.com" className="h-11" {...register("email")} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" className="h-11" {...register("password")} />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="h-11 w-full text-sm font-semibold tracking-wide" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to={ROUTES.REGISTER} className="font-medium text-primary hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
