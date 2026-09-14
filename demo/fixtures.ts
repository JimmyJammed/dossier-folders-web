import type {
  DossierConfig,
  ContentBlock,
  FolderRecord,
} from "../src/types.ts";
export function makeConfig(base = "./"): DossierConfig {
  const asset = (name: string) => `${base}assets/${name}`;
  const image = (name: string, alt: string, width = 960, height = 600) => ({
    src: asset(name),
    alt,
    width,
    height,
  });
  const names = [
    "Orbit Market",
    "Wander Atlas",
    "Relay Studio",
    "Juniper Works",
    "Fieldnote Labs",
    "Northstar Archive",
  ];
  const colors = [
    "#663cc4",
    "#bb482d",
    "#28619c",
    "#28694c",
    "#825629",
    "#37475c",
  ];
  const summaries = [
    "A fictional marketplace that makes everyday discoveries feel a little more considered. One small team, a shared platform, and room to grow.",
    "A field guide for the pleasantly lost. Save places, build a trail of discoveries, and pass a favorite corner of the world to a friend.",
    "A small creative studio turning ambitious ideas into useful interfaces. Clear systems make space for expressive work.",
    "Tools for teams that make things with care. A case study in bringing a collection of independent workflows into one calm workspace.",
    "A fictional research notebook for curious teams. Observations, experiments, and the unexpected connections between them.",
    "A small archive with a big memory. Notes on preserving the useful parts of a project long after its launch.",
  ];
  const records: FolderRecord[] = names.map((title, i) => ({
    id: title.toLowerCase().replace(/ /g, "-"),
    title,
    fill: colors[i],
    ink: "#fff5e7",
    tab:
      i === 5
        ? { mode: "text", label: "Northstar" }
        : {
            mode: i === 2 ? "logo" : "both",
            label: title.split(" ")[0],
            logo: {
              src: asset(`logo-${i}.svg`),
              width: i === 2 ? 120 : 32,
              height: 32,
            },
          },
    subtitle: [
      "Platform engineer",
      "Product designer",
      "Creative technologist",
      "Design engineer",
      "Research engineer",
      "Archivist",
    ][i],
    dates: [
      "2022 — 2025",
      "2020 — 2022",
      "2018 — 2020",
      "2016 — 2018",
      "2014 — 2016",
      "2012 — 2014",
    ][i],
    headline: [
      "Small discoveries. Thoughtfully connected.",
      "A collection of places worth getting lost in.",
      "A system that leaves room for personality.",
      "The quiet work behind a simpler day.",
      "Keep the question. Follow the evidence.",
      "Good work deserves a longer memory.",
    ][i],
    summary: summaries[i],
    chips: [
      ["Platforms", "Design systems", "Release craft"],
      ["Discovery", "Collections", "Sharing"],
      ["Web", "Identity", "Prototyping"],
      ["Workflows", "Accessibility", "Research"],
      ["Experiments", "Visualization", "Documentation"],
      ["Organization", "Writing", "Preservation"],
    ][i],
    blocks: [],
  }));
  const section = (heading: string, paragraph: string): ContentBlock => ({
    kind: "text",
    heading,
    paragraphs: [paragraph],
    bullets: [
      [
        "Started with ",
        { strong: "one clear question" },
        ", then tested the smallest useful answer.",
      ],
      "Shared the work early, documented the tradeoffs, and refined it with feedback.",
    ],
  });
  records[0].contentLayout = "featured";
  records[0].blocks = [
    section(
      "Built to feel effortless",
      "The fictional team replaced a maze of separate shopping flows with a shared set of patterns. Each small improvement made the next one easier to ship.",
    ),
    {
      kind: "video",
      ...image("orbit-demo.mp4", "", 390, 720),
      poster: asset("orbit-poster.png"),
      label:
        "Fictional Orbit Market interface: browse collections and review a saved basket.",
      caption: "Original fictional interface recording · silent loop",
      frame: "phone",
      featured: true,
      action: {
        label: "Explore the sample project",
        href: "https://example.com/orbit",
      },
    },
    {
      kind: "timeline",
      heading: "A platform taking shape",
      entries: [
        {
          dates: "2022",
          title: "Start with the essentials",
          body: "A small catalog, a reliable saved list, and a shared visual language.",
        },
        {
          dates: "2023",
          title: "Make the foundations reusable",
          body: "Common UI patterns replaced repeated one-off implementations.",
        },
        {
          dates: "2024 — 2025",
          title: "Make quality a habit",
          body: "Short feedback loops and accessible defaults became part of every release.",
          current: true,
        },
      ],
    },
  ];
  records[1].contentLayout = "featured";
  records[1].blocks = [
    section(
      "The journey between screens",
      "This gallery shows a complete miniature product: a welcome, a discovery feed, a collection, a saved place, and a shared itinerary.",
    ),
    {
      kind: "gallery",
      label: "Wander Atlas fictional interface screens",
      images: Array.from({ length: 5 }, (_, i) =>
        image(
          `wander-${i}.svg`,
          [
            "Welcome to Wander Atlas",
            "Explore nearby places",
            "A collection of saved places",
            "Notes for a favorite place",
            "An itinerary ready to share",
          ][i],
          390,
          720,
        ),
      ),
      caption:
        "Five original interface illustrations. Manual controls remain available.",
      frame: "phone",
      featured: true,
    },
  ];
  records[2].blocks = [
    {
      kind: "text",
      heading: "A flexible visual language",
      paragraphs: [
        [
          "Built around ",
          { strong: "a strong typographic hierarchy" },
          " and a small family of layout primitives. ",
          { label: "Read a sample brief", href: "https://example.com/relay" },
          ".",
        ],
      ],
      bullets: [
        "A consistent grid across editorial and product pages.",
        "A shared vocabulary for color, spacing, and motion.",
      ],
    },
    {
      kind: "image",
      ...image(
        "relay.svg",
        "Relay Studio project board with type samples and interface modules",
      ),
      caption: "Fictional design system board",
      frame: "none",
    },
  ];
  records[3].blocks = [
    section(
      "Listen before changing the workflow",
      "Three fictional teams used the same tool in three different ways. We observed the handoffs, wrote down the points of friction, and looked for the parts that could stay familiar.",
    ),
    {
      kind: "image",
      ...image(
        "juniper.svg",
        "Juniper Works task board showing draft, review, and ready columns",
      ),
      caption: "A shared workspace, illustrated with fictional tasks.",
    },
    section(
      "One change at a time",
      "We started with naming. Clear labels and a predictable hierarchy made the interface easier to scan before we changed its structure. The next iteration brought related tasks together without hiding their history.",
    ),
    section(
      "Make progress visible",
      "Small research sessions informed each revision. We checked keyboard routes, readable error messages, and the places where people paused to work out what would happen next.",
    ),
    {
      kind: "image",
      ...image(
        "relay.svg",
        "Reusable interface modules arranged on a design board",
      ),
      caption: "Reusable patterns from the fictional component library.",
    },
    section(
      "Leave a useful trail",
      "The final deliverable included the decisions behind the screens, not just the screens themselves. Future contributors could understand which constraints mattered and which were safe to change.",
    ),
  ];
  records[4].blocks = [
    {
      kind: "timeline",
      heading: "From observation to experiment",
      entries: [
        {
          dates: "Week 1",
          title: "Collect",
          body: "Capture observations with context.",
        },
        {
          dates: "Week 2",
          title: "Connect",
          body: "Group related signals into a testable question.",
        },
        {
          dates: "Week 3",
          title: "Learn",
          body: "Record what changed and what remains uncertain.",
        },
      ],
    },
    {
      kind: "image",
      ...image(
        "wander-3.svg",
        "A fictional notebook entry with location and written observations",
        390,
        720,
      ),
      caption: "A portrait notebook illustration.",
      frame: "phone",
    },
    {
      kind: "video",
      ...image("fieldnote-demo.mp4", "", 960, 600),
      poster: asset("fieldnote-poster.png"),
      label:
        "Fictional Fieldnote Labs board moving an experiment from observation to review.",
      caption: "Original fictional research board recording · silent loop",
      frame: "none",
    },
    section(
      "Keep the context",
      "A result is more useful when the question, method, and limitations travel with it.",
    ),
  ];
  records[5].blocks = [
    {
      kind: "text",
      paragraphs: [
        "This intentionally compact record uses no logo or media. A title, a little context, and a few useful notes are enough.",
      ],
      bullets: [
        "Keep a stable identifier.",
        "Write for the next person.",
        "Preserve the reasoning alongside the result.",
      ],
    },
  ];
  return {
    version: 1,
    background: "#101722",
    options: {
      records,
      cabinet: {
        label: "Dossier\nFolders",
        color: "#1c2c43",
        stampColor: "#9baac0",
        font: "editorial",
      },
      showHint: true,
      motion: "auto",
      layout: "auto",
      autoplay: true,
    },
  };
}
export function preset(name: string, base = "./"): DossierConfig {
  const c = makeConfig(base);
  if (name === "compact") {
    c.options.records = c.options.records.slice(2, 5);
    c.options.cabinet!.label = "Selected\nProjects";
  }
  if (name === "neutral") {
    c.options.records = c.options.records
      .slice(0, 3)
      .map((r, i) => ({
        ...r,
        fill: ["#384758", "#475563", "#56616d"][i],
        tab: { mode: "text", label: ["Notes", "Projects", "Research"][i] },
        title: ["Notes", "Projects", "Research"][i],
      }));
    c.options.cabinet!.label = "Working\nCollection";
    c.options.cabinet!.font = "mono";
  }
  return c;
}
