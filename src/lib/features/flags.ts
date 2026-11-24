// One exported function per feature switch. Each returns the value from config/features.json.
// The JSON is imported statically, so there are no file reads, writes, or network calls here.
import features from "../../../config/features.json";

export const trendMode = () => features.trend_mode;
export const humanise = () => features.humanise;
export const carouselRender = () => features.carousel_render;
export const icons = () => features.icons;
export const theme = () => features.theme;
export const styling = () => features.styling;
export const logo = () => features.logo;
export const variants = () => features.variants;
export const length = () => features.length;
export const performanceLoop = () => features.performance_loop;
export const linterSoftWarnings = () => features.linter_soft_warnings;
