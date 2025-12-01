import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-primary/5 to-background">
      <div className="text-center space-y-6 px-4">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Mental Health Practice Manager
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Professional appointment scheduling and patient management for mental health practitioners in Uruguay
        </p>
        <Link to="/auth">
          <Button size="lg" className="mt-4">Get Started</Button>
        </Link>
      </div>
    </div>
  );
};

export default Index;
