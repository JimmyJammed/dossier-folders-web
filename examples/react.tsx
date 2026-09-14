import { DossierFolders } from "dossier-folders/react";
import type { DossierOptions } from "dossier-folders";
import "dossier-folders/styles.css";
const options: DossierOptions = {
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
};
export function Collection() {
  return <DossierFolders options={options} />;
}
