import { createDossierFolders } from "dossier-folders";
import "dossier-folders/styles.css";
const folders = createDossierFolders(document.querySelector("#folders")!, {
  records: [
    {
      id: "notes",
      title: "Field notes",
      fill: "#37475c",
      ink: "#fff5e7",
      tab: { mode: "text", label: "Notes" },
      blocks: [{ kind: "text", paragraphs: ["A place for a good idea."] }],
    },
  ],
});
export const teardown = () => folders.destroy();
