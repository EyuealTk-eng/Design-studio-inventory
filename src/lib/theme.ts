// Shared by the server layout (the startup script) and the client theme switch.
export type ThemeChoice = "light" | "system" | "dark";
export const THEME_KEY = "theme";
export const THEME_EVENT = "theme-change";

/** Runs in <head> before the page paints, so there's no white flash in dark mode. */
export const themeScript = `(function(){try{var m=matchMedia("(prefers-color-scheme: dark)");var a=function(){var c=localStorage.getItem("${THEME_KEY}");document.documentElement.dataset.theme=c==="dark"||(c!=="light"&&m.matches)?"dark":"light"};a();m.addEventListener("change",a);window.addEventListener("${THEME_EVENT}",a)}catch(e){}})()`;
