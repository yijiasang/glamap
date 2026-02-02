import glamapLogo from "/glamap-logo.png";
import { Loader2 } from "lucide-react";

export default function LoadingScreen() {
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-center px-6">
        <img
          src={glamapLogo}
          alt="Glamap"
          className="h-24 sm:h-28 w-auto animate-pulse"
        />
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Warming up and loading…</span>
        </div>
      </div>
    </div>
  );
}
