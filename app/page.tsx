import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cn } from "@/lib/utils";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect("/chat");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="max-w-xl text-center space-y-8">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Resume AI Chatbot
        </h1>
        <p className="text-lg text-muted-foreground">
          Talk through your work history, projects, and skills with a friendly AI.
          We’ll turn the conversation into structured notes you can view and edit anytime.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            href="/auth/signup"
            className={cn(
              "inline-flex items-center justify-center h-10 rounded-md px-8 text-sm font-medium",
              "bg-primary text-primary-foreground shadow hover:bg-primary/90"
            )}
          >
            Get started
          </Link>
          <Link
            href="/auth/login"
            className={cn(
              "inline-flex items-center justify-center h-10 rounded-md px-8 text-sm font-medium",
              "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground"
            )}
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
