/** A two-sided paper cover projected around its bottom hinge.
 * SVG keeps the painted perspective consistent in Safari and Chromium, including
 * inside the transformed modal scene. Only this blank surface changes geometry.
 */
export function renderFolderCover(id: string) {
  const face = (
    side: string,
    hidden = false,
  ) => `<g class="cover-face cover-${side}"${hidden ? ' style="display:none"' : ""}>
    <path class="cover-paper" data-cover-outline />
    <path class="cover-light" fill="url(#cover-${side}-${id})" />
    <path class="cover-edge" />
  </g>`;
  return `<div class="folder-cover" data-fold-angle="0" aria-hidden="true">
    <svg class="cover-projection" preserveAspectRatio="none">
      <defs>
        <linearGradient id="cover-outside-${id}" x1="0" y1="0" x2=".75" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity=".09" />
          <stop offset=".44" stop-color="#fff" stop-opacity="0" />
          <stop offset="1" stop-color="#000" stop-opacity=".09" />
        </linearGradient>
        <linearGradient id="cover-inside-${id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#000" stop-opacity=".14" />
          <stop offset=".65" stop-color="#000" stop-opacity="0" />
          <stop offset="1" stop-color="#fff" stop-opacity=".04" />
        </linearGradient>
      </defs>
      ${face("outside")}${face("inside", true)}
    </svg>
  </div>`;
}

export function createFolderHinge(cover: HTMLElement) {
  const svg = cover.querySelector<SVGSVGElement>(".cover-projection")!;
  const paths = [...svg.querySelectorAll<SVGPathElement>("path")];
  const outside = svg.querySelector<SVGGElement>(".cover-outside")!;
  const inside = svg.querySelector<SVGGElement>(".cover-inside")!;
  let width = 1,
    height = 1,
    originY = 0,
    perspective = 2400;
  const hinge = {
    angle: 0,
    resize(w: number, h: number, sheetHeight: number, top: number) {
      width = w;
      height = h;
      originY = sheetHeight * 0.55 - top;
      perspective = Math.max(sheetHeight * 4.8, 2400);
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      hinge.render();
    },
    render() {
      const radians = (hinge.angle * Math.PI) / 180;
      const sin = Math.sin(radians),
        cos = Math.cos(radians);
      const point = (x: number, y: number) => {
        const dy = y - height;
        const z = dy * sin;
        const scale = perspective / (perspective - z);
        const px = width / 2 + (x - width / 2) * scale;
        const py = originY + (height + dy * cos - originY) * scale;
        return `${px.toFixed(3)} ${py.toFixed(3)}`;
      };
      // Project the rounded outline, including its corner control points. The
      // hinge itself has z=0, so the bottom edge never drifts from the back panel.
      const r = Math.min(16, width / 2, height / 2);
      const d = `M${point(r, 0)} L${point(width - r, 0)} Q${point(width, 0)} ${point(width, r)} L${point(width, height - r)} Q${point(width, height)} ${point(width - r, height)} L${point(r, height)} Q${point(0, height)} ${point(0, height - r)} L${point(0, r)} Q${point(0, 0)} ${point(r, 0)} Z`;
      paths.forEach((path) => path.setAttribute("d", d));
      outside.style.display = cos >= 0 ? "" : "none";
      inside.style.display = cos >= 0 ? "none" : "";
      cover.dataset.foldAngle = hinge.angle.toFixed(3);
    },
  };
  return hinge;
}
