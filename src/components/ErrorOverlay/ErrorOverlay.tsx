import { useState } from "react";
import { useStore } from "../../stores/store";

export function ErrorOverlay() {
  const errors = useStore((s) => s.errors);
  const clearErrors = useStore((s) => s.clearErrors);
  const removeError = useStore((s) => s.removeError);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (errors.length === 0) return null;

  const handleCopyAll = async () => {
    const text = errors
      .map((e) => {
        const time = new Date(e.timestamp).toLocaleTimeString();
        let line = `[${time}] [${e.source}] ${e.message}`;
        if (e.details) line += `\n  ${e.details}`;
        return line;
      })
      .join("\n\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <>
      {/* Floating error button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-16 right-4 z-50 w-10 h-10 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/40 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        title={`${errors.length} error${errors.length !== 1 ? "s" : ""}`}
      >
        <span className="text-sm font-bold">{errors.length}</span>
      </button>

      {/* Error panel */}
      {open && (
        <div className="fixed bottom-28 right-4 z-50 w-[480px] max-h-[60vh] bg-gray-900 border border-red-500/30 rounded-lg shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50 bg-red-950/30">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-red-300">
                {errors.length} Error{errors.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopyAll}
                className="px-2.5 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
              >
                {copied ? "Copied!" : "Copy All"}
              </button>
              <button
                onClick={() => { clearErrors(); setOpen(false); }}
                className="px-2.5 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
              >
                Clear All
              </button>
              <button
                onClick={() => setOpen(false)}
                className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-200 rounded transition-colors text-sm"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Error list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {errors.map((err) => (
              <div
                key={err.id}
                className="bg-gray-800 border border-gray-700/50 rounded-lg p-3 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] text-gray-500">
                        {new Date(err.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="text-[10px] text-red-400 bg-red-400/10 px-1.5 rounded">
                        {err.source}
                      </span>
                    </div>
                    <div className="text-sm text-gray-200 break-words">
                      {err.message}
                    </div>
                    {err.details && (
                      <pre className="mt-1.5 text-xs text-gray-400 bg-gray-900 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words max-h-32">
                        {err.details}
                      </pre>
                    )}
                  </div>
                  <button
                    onClick={() => removeError(err.id)}
                    className="text-gray-500 hover:text-gray-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
