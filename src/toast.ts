// ── Toast notification system ─────────────────────────────────────────────────

import { escHtml } from "./utils";

const TOAST_DURATION_MS = 5000;

const ICON_SUCCESS = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0 mt-0.5"><polyline points="20 6 9 17 4 12"/></svg>`;
const ICON_ERROR = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

export function showToast(
  message: string,
  type: "success" | "error" = "success",
): void {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const isSuccess = type === "success";
  const toast = document.createElement("div");
  toast.className = [
    "pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg border shadow-2xl text-[12px] cursor-pointer",
    "transition-all duration-300 ease-out opacity-0 translate-y-3",
    isSuccess
      ? "bg-[#0d2018] border-green-500/40 text-green-300"
      : "bg-[#200d0d] border-red-500/40 text-red-300",
  ].join(" ");

  toast.innerHTML = `${isSuccess ? ICON_SUCCESS : ICON_ERROR}<span class="leading-relaxed">${escHtml(message)}</span>`;
  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.remove("opacity-0", "translate-y-3");
      toast.classList.add("opacity-100", "translate-y-0");
    });
  });

  const dismiss = (): void => {
    toast.classList.remove("opacity-100", "translate-y-0");
    toast.classList.add("opacity-0", "translate-y-3");
    setTimeout(() => toast.remove(), 300);
  };

  const timer = setTimeout(dismiss, TOAST_DURATION_MS);
  toast.addEventListener("click", () => {
    clearTimeout(timer);
    dismiss();
  });
}
