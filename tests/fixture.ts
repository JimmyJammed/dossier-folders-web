import "../src/styles.css";
import { createDossierFolders } from "../src/index";
import { makeConfig } from "../demo/fixtures";
import { initRecordMedia } from "../src/media";
import { renderDossierFoldersMarkup } from "../src/server";
const options = makeConfig("/").options;
const api = createDossierFolders(document.querySelector("#fixture")!, options);
Object.assign(window, {
  fixture: {
    api,
    options,
    createDossierFolders,
    initRecordMedia,
    renderDossierFoldersMarkup,
  },
});
