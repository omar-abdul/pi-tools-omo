import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function getGiantPiLogo(theme: any): string[] {
  const accent = (s: string) => theme.fg("accent", s);
  const success = (s: string) => theme.fg("success", s);
  const heading = (s: string) => theme.fg("mdHeading", s);
  const dim = (s: string) => theme.fg("dim", s);

  return [
    "",
    accent("        ▄██████████████████████████████████████▄"),
    accent("      ▄██████████████████████████████████████████▄"),
    accent("      ████▀▀▀▀                            ▀▀██████"),
    accent("      ████                                  ██████"),
    `      ${accent("████")}                                  ${success("██████")}`,
    `      ${accent("████")}                                  ${success("██████")}`,
    `      ${accent("████")}                                  ${success("██████")}`,
    `      ${accent("████")}                                  ${success("██████")}`,
    `      ${accent("████")}                                  ${success("██████")}`,
    `      ${accent("████")}                                  ${success("██████")}`,
    `      ${accent("████")}                                  ${success("██████")}`,
    `      ${accent("████")}                                  ${success("██████")}`,
    `      ${accent("████")}                                  ${success("██████")}`,
    `    ${accent("▄██████▄")}                              ${success("▄████████▄")}`,
    `    ${accent("▀▀▀▀▀▀▀▀")}                              ${success("▀▀▀▀▀▀▀▀▀▀")}`,
    "",
    `                 ${theme.bold(heading("⚡ P I   C O D I N G   A G E N T ⚡"))}`,
    `                  ${dim("Interactive developer environment ready.")}`,
    "",
  ];
}

export default function splashLogoExtension(pi: ExtensionAPI) {
  let showingSplash = true;

  // We set custom header on session start if reason is "startup"
  pi.on("session_start", async (event, ctx) => {
    // Only apply on initial load of the interactive mode
    if (ctx.hasUI && event.reason === "startup") {
      showingSplash = true;

      ctx.ui.setHeader((_tui, theme) => {
        return {
          render(_width: number): string[] {
            if (!showingSplash) {
              return [];
            }
            return getGiantPiLogo(theme);
          },
          invalidate() {},
        };
      });
    }
  });

  // When any user input is received, restore the built-in header instantly
  pi.on("input", async (_event, ctx) => {
    if (showingSplash) {
      showingSplash = false;
      ctx.ui.setHeader(undefined); // Restores standard header
    }
  });

  // Keep it safe: restore normal header on any other agent lifecycle start
  pi.on("agent_start", async (_event, ctx) => {
    if (showingSplash) {
      showingSplash = false;
      ctx.ui.setHeader(undefined); // Restores standard header
    }
  });
}
