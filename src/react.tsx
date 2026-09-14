import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
} from "react";
import type { DossierInstance, DossierOptions } from "./types.ts";
import { createDossierFolders } from "./index.ts";
import { renderDossierFoldersMarkup } from "./server.ts";
export type DossierFoldersProps = {
  options: DossierOptions;
  className?: string;
};
export type DossierFoldersHandle = Pick<
  DossierInstance,
  "open" | "close" | "getState"
>;
export const DossierFolders = forwardRef<
  DossierFoldersHandle,
  DossierFoldersProps
>(function DossierFolders({ options, className }, ref) {
  const instanceId = "react-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const root = useRef<HTMLDivElement>(null),
    api = useRef<DossierInstance | null>(null),
    latest = useRef(options),
    previous = useRef(options);
  latest.current = options;
  // React owns only the host; the imperative component owns its stable inner tree after hydration.
  const markup = useRef(renderDossierFoldersMarkup(options, { instanceId }));
  useImperativeHandle(
    ref,
    () => ({
      open: (id) => api.current?.open(id),
      close: () => api.current?.close(),
      getState: () =>
        api.current?.getState() ?? {
          activeId: null,
          phase: "closed",
          layout: "rail",
          motion: "reduced",
        },
    }),
    [],
  );
  useEffect(() => {
    api.current = createDossierFolders(root.current!, latest.current);
    return () => {
      api.current?.destroy();
      api.current = null;
    };
  }, []);
  useEffect(() => {
    if (previous.current !== options) {
      api.current?.update(options);
      previous.current = options;
    }
  }, [options]);
  return (
    <div
      ref={root}
      className={`dossier ${className ?? ""}`}
      data-font={options.cabinet?.font ?? "editorial"}
      dangerouslySetInnerHTML={{ __html: markup.current }}
    />
  );
});
