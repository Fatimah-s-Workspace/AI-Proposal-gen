// Single source of truth for the inline theme bootstrap. It has to run
// before first paint (otherwise dark mode flashes light), which is why it's
// inline rather than a module - and being inline, it needs an explicit CSP
// allowance. src/middleware.ts allows it by SHA-256 hash, so this string
// and that hash must stay in lockstep; theme-init-script.test.ts is what
// catches them drifting apart.
export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem("theme");var d=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;
