// One exported function per feature switch. Each reads config/features.json fresh on every call
// (ADR 0005), so an edit takes effect without a restart. Reads only; no writes, no network.
import { readSwitches } from "../config/switches";

export const trendMode = () => readSwitches().trend_mode;
export const humanise = () => readSwitches().humanise;
export const carouselRender = () => readSwitches().carousel_render;
export const icons = () => readSwitches().icons;
export const theme = () => readSwitches().theme;
export const styling = () => readSwitches().styling;
export const logo = () => readSwitches().logo;
export const variants = () => readSwitches().variants;
export const length = () => readSwitches().length;
export const performanceLoop = () => readSwitches().performance_loop;
export const linterSoftWarnings = () => readSwitches().linter_soft_warnings;
