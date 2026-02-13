import { useState, useEffect, useRef } from "react";
import { useStore } from "../../stores/store";
import {
  requestDeviceCode,
  exchangeDeviceCode,
  type DeviceCodeResponse,
} from "../../utils/cmdopAuth";

export function CmdopAuthSection() {
  const cmdopAuth = useStore((s) => s.cmdopAuth);
  const setCmdopAuth = useStore((s) => s.setCmdopAuth);

  const [deviceCode, setDeviceCode] = useState<DeviceCodeResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "requesting" | "polling" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const startAuth = async () => {
    setStatus("requesting");
    setError(null);

    try {
      const code = await requestDeviceCode();
      setDeviceCode(code);
      setStatus("polling");

      // Start polling
      pollTimerRef.current = setInterval(async () => {
        try {
          const result = await exchangeDeviceCode(code.device_code);
          if (result === "pending") return;
          if (result === "expired") {
            setStatus("error");
            setError("Device code expired. Please try again.");
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            return;
          }
          // Success
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          console.log(`[CMDOP OAuth] Got token! prefix="${result.access_token.slice(0, 6)}", length=${result.access_token.length}`);
          console.log(`[CMDOP OAuth] refresh prefix="${result.refresh_token.slice(0, 7)}", scope="${(result as unknown as Record<string, unknown>).scope}", workspace="${(result as unknown as Record<string, unknown>).workspace_name}"`);
          setCmdopAuth({
            accessToken: result.access_token,
            refreshToken: result.refresh_token,
            expiresAt: Date.now() + result.expires_in * 1000,
          });
          setDeviceCode(null);
          setStatus("idle");
        } catch (err) {
          setStatus("error");
          setError(String(err));
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        }
      }, (code.interval || 5) * 1000);
    } catch (err) {
      setStatus("error");
      setError(String(err));
    }
  };

  const disconnect = () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    setCmdopAuth(null);
    setDeviceCode(null);
    setStatus("idle");
    setError(null);
  };

  // Connected state
  if (cmdopAuth) {
    const isExpired = cmdopAuth.expiresAt < Date.now();
    return (
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div
            className={`w-2 h-2 rounded-full ${isExpired ? "bg-yellow-400" : "bg-green-400"}`}
          />
          <span className="text-sm text-gray-200">
            {isExpired ? "Token expired" : "Connected to CMDOP"}
          </span>
        </div>
        <div className="text-xs text-gray-500 mb-2 font-mono">
          Token: {cmdopAuth.accessToken.slice(0, 12)}...
        </div>
        <button
          onClick={disconnect}
          className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 bg-red-900/20 hover:bg-red-900/40 rounded transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  // Polling state — show device code
  if (status === "polling" && deviceCode) {
    return (
      <div>
        <div className="text-sm text-gray-200 mb-2">
          Enter this code to authorize:
        </div>
        <div className="bg-gray-900 border border-gray-600 rounded px-4 py-3 text-center mb-3">
          <div className="text-2xl font-mono font-bold text-blue-400 tracking-widest">
            {deviceCode.user_code}
          </div>
        </div>
        <a
          href={deviceCode.verification_uri}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-sm text-blue-400 hover:text-blue-300 underline mb-3"
        >
          Open CMDOP authorization page
        </a>
        <div className="text-xs text-gray-500 text-center">
          Waiting for authorization...
        </div>
        <button
          onClick={disconnect}
          className="mt-3 w-full px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  // Idle / Error state
  return (
    <div>
      {error && (
        <div className="text-xs text-red-400 mb-2">{error}</div>
      )}
      <button
        onClick={startAuth}
        disabled={status === "requesting"}
        className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:text-gray-400 text-white rounded transition-colors"
      >
        {status === "requesting" ? "Connecting..." : "Connect to CMDOP"}
      </button>
      <div className="text-xs text-gray-500 mt-2">
        Opens browser for device authorization. Required for remote projects.
      </div>
    </div>
  );
}
