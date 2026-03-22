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

const registerSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  company_name: z.string().min(1, "Company name is required"),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register: registerUser, isAuthenticated, isLoading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  if (authLoading) return null;
  if (isAuthenticated) return <Navigate to={ROUTES.DASHBOARD} replace />;

  const onSubmit = async (data: RegisterForm) => {
    setIsSubmitting(true);
    try {
      await registerUser(data);
      navigate(ROUTES.DASHBOARD);
    } catch (err) {
      handleApiError(err, "Registration failed");
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
            Join the Craft
          </h2>
          <p className="text-base leading-relaxed text-white/50">
            Set up your company workspace and start configuring premium kitchen solutions.
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
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <Diamond className="h-6 w-6 text-primary" />
            <span className="font-display text-xl font-bold">Norvik</span>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl tracking-tight">Create Account</h1>
            <p className="mt-2 text-sm text-muted-foreground">Get started with Norvik Studio</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">First Name</Label>
                <Input id="first_name" placeholder="John" className="h-11" {...register("first_name")} />
                {errors.first_name && <p className="text-sm text-destructive">{errors.first_name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Last Name</Label>
                <Input id="last_name" placeholder="Doe" className="h-11" {...register("last_name")} />
                {errors.last_name && <p className="text-sm text-destructive">{errors.last_name.message}</p>}
              </div>
            </div>
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
            <div className="space-y-2">
              <Label htmlFor="company_name" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Company</Label>
              <Input id="company_name" placeholder="Your Furniture Co." className="h-11" {...register("company_name")} />
              {errors.company_name && <p className="text-sm text-destructive">{errors.company_name.message}</p>}
            </div>
            <Button type="submit" className="h-11 w-full text-sm font-semibold tracking-wide" disabled={isSubmitting}>
              {isSubmitting ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to={ROUTES.LOGIN} className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
