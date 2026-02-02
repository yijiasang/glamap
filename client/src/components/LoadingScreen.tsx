import glamapLogo from "/glamap-logo.png";

export default function LoadingScreen() {
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-center px-6">
        <img
          src={glamapLogo}
          alt="Glamap"
          className="h-48 sm:h-64 w-auto"
          style={{ animation: "glamapPulse 1.6s ease-in-out infinite" }}
        />
      </div>
    </div>
  );
}
