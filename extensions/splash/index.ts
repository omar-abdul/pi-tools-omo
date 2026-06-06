import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Helper to determine accurate visual width of characters in a monospaced terminal.
function getVisualWidth(s: string): number {
  let w = 0;
  for (const char of s) {
    const code = char.codePointAt(0);
    if (!code) continue;
    // Common double-width characters: emojis, fullwidth symbols, CJK characters
    if (
      code > 0xffff ||
      (code >= 0x2600 && code <= 0x27bf) || // Symbols
      (code >= 0x1f000 && code <= 0x1f9ff) || // Emojis
      (code >= 0x2b00 && code <= 0x2bff) || // Arrows & misc symbols
      (code >= 0x3000 && code <= 0x9fff) // CJK Ideographs
    ) {
      w += 2;
    } else {
      w += 1;
    }
  }
  return w;
}

// Pads a raw string to visual columns so that ANSI colorizers run perfectly afterwards.
function padVisual(s: string, targetWidth: number): string {
  const currentWidth = getVisualWidth(s);
  return s + " ".repeat(Math.max(0, targetWidth - currentWidth));
}

// Theme colorizers for the logo grids
function colorizeRpgLogo(lines: string[], theme: any): string[] {
  const border = (s: string) => theme.fg("border", s);
  const accent = (s: string) => theme.fg("accent", s);
  const gold = (s: string) => theme.fg("warning", s);

  return lines.map(line => {
    const chars = Array.from(line);
    let result = "";
    for (const c of chars) {
      if ("╔═╦╗╠╝╚║╩╬".includes(c)) {
        result += border(c);
      } else if ("▒▓██".includes(c)) {
        result += accent(c);
      } else if ("✦✧❖❈".includes(c)) {
        result += gold(c);
      } else if (c === "✨") {
        result += gold("✨");
      } else if (c === "🔮") {
        result += border("🔮");
      } else {
        result += c;
      }
    }
    return result;
  });
}

function colorizeCosmicLogo(lines: string[], theme: any): string[] {
  const border = (s: string) => theme.fg("border", s);
  const accent = (s: string) => theme.fg("accent", s);
  const pink = (s: string) => theme.fg("borderAccent", s);
  const white = (s: string) => theme.fg("syntaxPunctuation", s);

  return lines.map(line => {
    const chars = Array.from(line);
    let result = "";
    for (const c of chars) {
      if ("╭─├┼╮╯╰║┬│".includes(c)) {
        result += border(c);
      } else if (c === "█") {
        result += accent(c);
      } else if (c === "★") {
        result += white(c);
      } else if (c === "☄") {
        result += pink("☄");
      } else if (c === "✨") {
        result += pink("✨");
      } else if (c === "🪐") {
        result += accent("🪐");
      } else {
        result += c;
      }
    }
    return result;
  });
}

function colorizeCyberLogo(lines: string[], theme: any): string[] {
  const border = (s: string) => theme.fg("border", s);
  const pink = (s: string) => theme.fg("accent", s);
  const warning = (s: string) => theme.fg("warning", s);

  return lines.map(line => {
    const chars = Array.from(line);
    let result = "";
    for (const c of chars) {
      if ("┌─├┼┐┘└│┬".includes(c)) {
        result += border(c);
      } else if (c === "█") {
        result += pink(c);
      } else if ("#_CYBER".includes(c)) {
        result += warning(c);
      } else if ("[]+-:".includes(c)) {
        result += border(c);
      } else {
        result += c;
      }
    }
    return result;
  });
}

function colorizeSynthwaveLogo(lines: string[], theme: any): string[] {
  const orange = (s: string) => theme.fg("borderAccent", s);
  const fuchsia = (s: string) => theme.fg("accent", s);
  const green = (s: string) => theme.fg("success", s);

  return lines.map(line => {
    const chars = Array.from(line);
    let result = "";
    for (const c of chars) {
      if ("◢◣◥◤".includes(c)) {
        result += orange(c);
      } else if (c === "█") {
        result += fuchsia(c);
      } else if ("▃▄▅▆▇".includes(c)) {
        result += orange(c);
      } else if (c === "🌴") {
        result += green("🌴");
      } else if (c === "🌅") {
        result += orange("🌅");
      } else {
        result += c;
      }
    }
    return result;
  });
}

function colorizeDefaultLogo(lines: string[], theme: any): string[] {
  const accent = (s: string) => theme.fg("accent", s);

  return lines.map(line => {
    const chars = Array.from(line);
    let result = "";
    for (const c of chars) {
      if ("█▄▀▀".includes(c)) {
        result += accent(c);
      } else {
        result += c;
      }
    }
    return result;
  });
}

function getGiantPiLogo(theme: any): string[] {
  const name = theme.name || "default";

  let logoLines: string[] = [];
  let sidebarLines: string[] = [];
  let colorizer: (lines: string[], theme: any) => string[] = colorizeDefaultLogo;
  let title = "";
  let subtitle = "";

  if (name === "rpg-magic") {
    logoLines = [
      " ╔══════════════════════════╗  ",
      " ║   ✹   ✦   ✨   ✦   ✹   ║  ",
      " ╠══════╦══════╦═══════════╝  ",
      " ║  ▒▒  ║      ║  ▒▒  ║       ",
      " ║  ▒▒  ║      ║  ▒▒  ║       ",
      " ║  ▒▒  ║      ╚══════╝       ",
      " ║  ▒▒  ╚══════╗        ╔════╗",
      " ║   ❖    ❈    ║        ║ ✦  ║",
      " ╠═════════════╝        ║ 🔮 ║",
      " ║  ▒▒  ║               ║ ✦  ║",
      " ║  ▒▒  ║               ║ ✦  ║",
      " ╚══════╝               ╚════╝"
    ];
    colorizer = colorizeRpgLogo;
    
    const gold = (s: string) => theme.fg("warning", s);
    const purple = (s: string) => theme.fg("border", s);
    const red = (s: string) => theme.fg("error", s);
    const blue = (s: string) => theme.fg("accent", s);
    const green = (s: string) => theme.fg("success", s);
    const dim = (s: string) => theme.fg("dim", s);

    sidebarLines = [
      `  ✨ ${gold("QUEST")}  :: ${purple("CODE THE FUTURE")}`,
      `  ${dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}`,
      `  🧙 ${gold("GUILD")}  :: ${purple("Pi Forge")}`,
      `  👑 ${gold("CLASS")}  :: ${purple("Grand Archmage")}`,
      `  ⚡ ${gold("LEVEL")}  :: ${purple("99")}`,
      `  💖 ${gold("HEALTH")} :: [${red("████████████")}] 100%`,
      `  🔷 ${gold("MANA")}   :: [${blue("████████████")}] 100%`,
      `  📜 ${gold("SPELLS")} :: ${purple("/help")}, ${purple("/settings")}, ${purple("/reload")}`,
      `  🎒 ${gold("BAG")}    :: ${purple("Compacted Context")}, ${purple("MCP Tools")}`,
      `  🛡️ ${gold("BUFFS")}  :: ${green("Active Focus (+50% Dev Speed)")}`,
      `  ${dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}`,
      `  🔮 ${gold("STATUS")} :: ${green("Ready to weave solutions...")}`
    ];

    title = theme.bold(gold("⚔️   E N T E R   T H E   C O D E   R E A L M   ⚔️"));
    subtitle = dim("Interactive companion initialized. Prepare your spells.");
  } else if (name === "cosmic-mystic") {
    logoLines = [
      " ╭──────────────────────────╮  ",
      " │   ★    ☄      ★      ☄   │  ",
      " ├──────┬──────┬────────────╯  ",
      " │  ██  │      │  ██  │        ",
      " │  ██  │      │  ██  │        ",
      " │  ██  │      ╰──────╯        ",
      " │  ██  ╰──────╮        ╭────╮ ",
      " │   🌌   ✦  ✨ │        │ ☄  │ ",
      " ├─────────────╯        │ 🪐 │ ",
      " │  ██  │               │ ☄  │ ",
      " │  ██  │               │ ☄  │ ",
      " ╰──────╯               ╰────╯ "
    ];
    colorizer = colorizeCosmicLogo;

    const pink = (s: string) => theme.fg("borderAccent", s);
    const indigo = (s: string) => theme.fg("accent", s);
    const teal = (s: string) => theme.fg("border", s);
    const white = (s: string) => theme.fg("syntaxPunctuation", s);
    const gold = (s: string) => theme.fg("warning", s);
    const dim = (s: string) => theme.fg("dim", s);

    sidebarLines = [
      `  🌌 ${pink("OBSERVATORY NODE")}`,
      `  ${dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}`,
      `  🪐 ${gold("SYSTEM")}   :: ${indigo("Pi-Infinity Core")}`,
      `  💫 ${gold("ORBIT")}    :: ${indigo("Interactive TUI")}`,
      `  🌠 ${gold("COGNITION")}:: ${indigo("Infinite Deep Space")}`,
      `  💠 ${gold("VOID ST")}  :: [${teal("▒▒▒▒▒▒▒▒▒▒▒▒")}] ${pink("Nebula Mode")}`,
      `  ☄️ ${gold("GRAVITY")}  :: ${indigo("Quantum Stable")}`,
      `  ${dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}`,
      `  ✨ ${white("Spectral data streaming active...")}`,
      `  🛡️ ${teal("Solar shield energized")}`,
      `  🚀 ${pink("warpSpeed: 9.9")}`,
      `  🌌 ${indigo("Exploring codebase coordinates...")}`
    ];

    title = theme.bold(pink("🌌   C O S M I C   K E R N E L   🌌"));
    subtitle = dim("Deep space coding transceiver stable and ready.");
  } else if (name === "cyber-glitch") {
    logoLines = [
      " ┌──────────────────────────┐  ",
      " │   [x]   _ERR_   [x]   +  │  ",
      " ├───┐  ┌───┬───┬───────────┘  ",
      " │ █ │  │   │ █ │              ",
      " │ █ │  │   │ █ │              ",
      " │ █ │  │   └───┘              ",
      " │ █ └──┘───┐           ┌────┐ ",
      " │ #_CYBER  │           │ :: │ ",
      " ├──────────┘           │ ++ │ ",
      " │ █ │                  │ :: │ ",
      " │ █ │                  │ :: │ ",
      " └───┘                  └────┘ "
    ];
    colorizer = colorizeCyberLogo;

    const pink = (s: string) => theme.fg("accent", s);
    const cyan = (s: string) => theme.fg("border", s);
    const yellow = (s: string) => theme.fg("warning", s);
    const green = (s: string) => theme.fg("success", s);
    const red = (s: string) => theme.fg("error", s);
    const dim = (s: string) => theme.fg("dim", s);

    sidebarLines = [
      `  ⚡ ${pink("NEURAL LINK ESTABLISHED")}`,
      `  ${dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}`,
      `  🔋 ${yellow("COGNITION")} :: ${cyan("Direct Sub-Link")}`,
      `  💾 ${yellow("SYS_LOAD")}  :: ${cyan("COMPACTED CONTEXT")}`,
      `  📡 ${yellow("SIGNAL")}    :: ${green("100% ENCRYPTED")}`,
      `  👾 ${yellow("NODE_NET")}  :: [${green("████████████")}]`,
      `  💀 ${yellow("FIREWALL")}  :: ${red("ACTIVE & BYPASSING")}`,
      `  ${dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}`,
      `  ⚡ ${green("Running prompt injection filters...")}`,
      `  💾 ${cyan("Port 1455 terminal linked.")}`,
      `  📡 ${pink("ping: 2ms | jitter: 0.1ms")}`,
      `  👾 ${yellow("System sandbox initialized.")}`
    ];

    title = theme.bold(pink("⚡   S Y S T E M   O P E R A T I O N A L   ⚡"));
    subtitle = dim("Hacking environment loaded. Execute commands below.");
  } else if (name === "synthwave-sunset") {
    logoLines = [
      " ◢██████████████████████████◣  ",
      " █   ▃▃▄▄▅▅▆▆▇▇████▇▇▆▆▅▅   █  ",
      " ◥██████████████████████████◤  ",
      " █  ██  █      █  ██  █        ",
      " █  ██  █      █  ██  █        ",
      " █  ██  █      ◥██████◤        ",
      " █  ██  ◥██████◣        ◢████◣ ",
      " █   🌴 🌴 🌴 █        █ 🌴  █ ",
      " ◥████████████◤        █ 🌅  █ ",
      " █  ██  █              █ 🌴  █ ",
      " █  ██  █              █ 🌴  █ ",
      " ◥██████◤              ◥████◤ "
    ];
    colorizer = colorizeSynthwaveLogo;

    const fuchsia = (s: string) => theme.fg("accent", s);
    const orange = (s: string) => theme.fg("borderAccent", s);
    const cyan = (s: string) => theme.fg("border", s);
    const mustard = (s: string) => theme.fg("warning", s);
    const green = (s: string) => theme.fg("success", s);
    const dim = (s: string) => theme.fg("dim", s);

    sidebarLines = [
      `  🌴 ${orange("SUNSET SATELLITE")} ${fuchsia("FM")}`,
      `  ${dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}`,
      `  🏎️ ${mustard("DECK")}   :: ${cyan("Grid Racer v4.2")}`,
      `  📻 ${mustard("STATION")}:: ${cyan("108.5 Outrun Station")}`,
      `  🚥 ${mustard("GAUGES")} :: ${green("All Systems Nominal")}`,
      `  🌅 ${mustard("HORID")}  :: [${fuchsia("==============")}] 100%`,
      `  🌴 ${mustard("SCENIC")}  :: ${cyan("Synth Palms Approaching")}`,
      `  ${dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}`,
      `  🌴 ${green("Cruising down the virtual highway...")}`,
      `  🏎️ ${orange("RPM: 7200 | Speed: 120 mph")}`,
      `  🌅 ${fuchsia("Retro sunset grid active.")}`,
      `  📻 ${cyan("Now playing: Nightcall (Remix)")}`
    ];

    title = theme.bold(orange("🌴   N I G H T R I D E   C O N S O L E   🌴"));
    subtitle = dim("Driving deck online. Shift into code mode.");
  } else {
    logoLines = [
      "   ▄██████████████████████████▄  ",
      "   ████████████████████████████  ",
      "   ████▀▀▀▀▀▀▀▀████▀▀▀▀████████  ",
      "   ████        ████    ████      ",
      "   ████        ████    ████      ",
      "   ████        ████████████      ",
      "   ████        ▀▀▀▀▀▀▀▀████████▄ ",
      "   ████                █████████ ",
      "   ██████████████      █████████ ",
      "   ██████████████      ████      ",
      "   ████                ████      ",
      "   ████                ████      "
    ];
    colorizer = colorizeDefaultLogo;

    const accent = (s: string) => theme.fg("accent", s);
    const success = (s: string) => theme.fg("success", s);
    const dim = (s: string) => theme.fg("dim", s);

    sidebarLines = [
      `  ⚡ ${theme.bold(accent("PI CODING AGENT"))}`,
      `  ${dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}`,
      `  🚀 Interactive developer terminal`,
      `  📁 Environment initialized`,
      `  🛠️ Ready for code generation & tools`,
      `  🔧 ${success("All systems active")}`,
      `  ${dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}`,
      `  💡 Spells at hand:`,
      `    - Use ${accent("/settings")} to change themes`,
      `    - Use ${accent("/reload")} to reload extensions`,
      `    - Hot reload of active themes is supported!`,
      `  ⚡ Weave your code solutions now.`
    ];

    title = theme.bold(accent("⚡ P I   C O D I N G   A G E N T ⚡"));
    subtitle = dim("Interactive developer environment ready.");
  }

  // Visual text column alignment (we pad first, then colorize, keeping visual widths perfectly straight)
  const paddedLogoLines = logoLines.map(line => padVisual(line, 34));
  const colorizedLogoLines = colorizer(paddedLogoLines, theme);

  const combined: string[] = [""];
  for (let i = 0; i < 12; i++) {
    const l = colorizedLogoLines[i] || "";
    const r = sidebarLines[i] || "";
    combined.push(`  ${l}${r}`);
  }

  combined.push(
    "",
    `                 ${title}`,
    `                  ${subtitle}`,
    ""
  );

  return combined;
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
