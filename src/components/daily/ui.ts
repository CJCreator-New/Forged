// Shared class strings for the Daily page. Colours: paper, ink, one cobalt accent, red and amber for lint.

export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4E8C]";

export const buttonPrimary = `inline-flex h-10 items-center justify-center rounded-md bg-[#1F4E8C] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#173C6C] disabled:cursor-not-allowed disabled:bg-[#B9BCB5] ${focusRing}`;

export const buttonSecondary = `inline-flex h-10 items-center justify-center rounded-md border border-[#1B1F1D] px-4 text-sm font-semibold text-[#1B1F1D] transition-colors hover:bg-[#E8E9E3] disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const buttonQuiet = `inline-flex h-9 items-center justify-center rounded-md px-2.5 text-sm font-medium text-[#1F4E8C] underline underline-offset-2 transition-colors hover:text-[#173C6C] disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const fieldSelect = `h-10 w-full rounded-md border border-[#CFD0C8] bg-[#FBFBF8] px-2.5 text-sm text-[#1B1F1D] disabled:opacity-60 ${focusRing}`;

export const fieldLabel = "text-sm font-medium text-[#1B1F1D]";

export const cardSurface =
  "flex min-w-0 flex-col gap-4 rounded-lg border border-[#D6D7D0] bg-[#FBFBF8] p-4 sm:p-5";
