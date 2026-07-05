"use client";

import { Badge } from "@anorvis/ui/badge";
import { Card, CardContent, CardHeader } from "@anorvis/ui/card";
import { devStyles, workspacePageStyles } from "@anorvis/ui/styles";
import { cn } from "@anorvis/ui/utils";
import {
  ChevronLeft,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
} from "lucide-react";
import { useMemo, useState } from "react";
import { FormattedText } from "@/features/dev/components/text";
import {
  DEV_PANEL_HEIGHT,
  type MemoryDocument,
  type MemoryGraph,
  type MemoryGraphNode,
} from "@/features/dev/utils/display";
import { formatEventTime } from "@/lib/workspace/view-utils";

type MemoryHubId =
  | "SEMANTIC-MEMORY"
  | "EPISODIC-MEMORY"
  | "PROCEDURAL-MEMORY"
  | "WORKING-MEMORY"
  | "AUTOBIOGRAPHICAL-MEMORY"
  | "EMOTIONAL-MEMORY";

type MemoryHubConfig = {
  id: MemoryHubId;
  label: string;
  shortLabel: string;
  fill: string;
  stroke: string;
  text: string;
  bg: string;
  border: string;
};

const INDEX_MEMORY_STYLE = {
  label: "index",
  shortLabel: "all",
  fill: "fill-lime-500/20",
  stroke: "stroke-lime-500",
  text: "text-lime-700 dark:text-lime-200",
  bg: "border-lime-500/30 bg-lime-500/10",
  border: "border-lime-500/40",
};

const MEMORY_HUBS: MemoryHubConfig[] = [
  {
    id: "SEMANTIC-MEMORY",
    label: "semantic",
    shortLabel: "semantic",
    fill: "fill-sky-500/20",
    stroke: "stroke-sky-500",
    text: "text-sky-700 dark:text-sky-200",
    bg: "border-sky-500/30 bg-sky-500/10",
    border: "border-sky-500/40",
  },
  {
    id: "EPISODIC-MEMORY",
    label: "episodic",
    shortLabel: "episodic",
    fill: "fill-violet-500/20",
    stroke: "stroke-violet-500",
    text: "text-violet-700 dark:text-violet-200",
    bg: "border-violet-500/30 bg-violet-500/10",
    border: "border-violet-500/40",
  },
  {
    id: "PROCEDURAL-MEMORY",
    label: "procedural",
    shortLabel: "procedure",
    fill: "fill-emerald-500/20",
    stroke: "stroke-emerald-500",
    text: "text-emerald-700 dark:text-emerald-200",
    bg: "border-emerald-500/30 bg-emerald-500/10",
    border: "border-emerald-500/40",
  },
  {
    id: "WORKING-MEMORY",
    label: "working",
    shortLabel: "working",
    fill: "fill-amber-500/20",
    stroke: "stroke-amber-500",
    text: "text-amber-700 dark:text-amber-200",
    bg: "border-amber-500/30 bg-amber-500/10",
    border: "border-amber-500/40",
  },
  {
    id: "AUTOBIOGRAPHICAL-MEMORY",
    label: "autobiographical",
    shortLabel: "self",
    fill: "fill-rose-500/20",
    stroke: "stroke-rose-500",
    text: "text-rose-700 dark:text-rose-200",
    bg: "border-rose-500/30 bg-rose-500/10",
    border: "border-rose-500/40",
  },
  {
    id: "EMOTIONAL-MEMORY",
    label: "emotional",
    shortLabel: "emotion",
    fill: "fill-fuchsia-500/20",
    stroke: "stroke-fuchsia-500",
    text: "text-fuchsia-700 dark:text-fuchsia-200",
    bg: "border-fuchsia-500/30 bg-fuchsia-500/10",
    border: "border-fuchsia-500/40",
  },
];

const MEMORY_HUB_BY_ID = new Map(MEMORY_HUBS.map((hub) => [hub.id, hub]));
const MEMORY_HUB_IDS = new Set(MEMORY_HUBS.map((hub) => hub.id));
const DEFAULT_HUB = MEMORY_HUBS[0];

export function MemoryPanel(props: {
  documents: MemoryDocument[];
  allDocuments: MemoryDocument[];
  graph: MemoryGraph | null;
  loading: boolean;
  refreshing: boolean;
  selectedDocument: MemoryDocument | null;
  onSelect: (document: MemoryDocument | null) => void;
}) {
  return (
    <div
      className={cn(
        "grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_360px]",
        DEV_PANEL_HEIGHT,
      )}
    >
      <Card className={cn(workspacePageStyles.card, "flex min-h-0 flex-col")}>
        <CardHeader className={devStyles.detailHeader}>
          <div>
            <p className={workspacePageStyles.cardLabel}>{"// memory"}</p>
            <p className={workspacePageStyles.cardTitle}>graph</p>
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 px-4 py-3">
          {props.loading ? (
            <p className={workspacePageStyles.cardBodyText}>loading memory…</p>
          ) : props.documents.length === 0 ? (
            <p className={workspacePageStyles.cardBodyText}>
              no memory documents match this view.
            </p>
          ) : (
            <MemoryGraphView
              documents={props.documents}
              allDocuments={props.allDocuments}
              graph={props.graph}
              selectedDocument={props.selectedDocument}
              onSelect={props.onSelect}
            />
          )}
        </CardContent>
      </Card>

      <Card className={cn(workspacePageStyles.card, "flex min-h-0 flex-col")}>
        <CardHeader className={devStyles.detailHeader}>
          <div className={devStyles.detailHeaderRow}>
            <div>
              <p className={workspacePageStyles.cardLabel}>
                {"// memory detail"}
              </p>
              <p className={workspacePageStyles.cardTitle}>
                {props.selectedDocument
                  ? `${props.selectedDocument.kind} · ${props.selectedDocument.id}`
                  : "no memory selected"}
              </p>
            </div>
            {props.refreshing && (
              <span className={devStyles.tinyMeta}>refreshing</span>
            )}
          </div>
        </CardHeader>
        <CardContent className={devStyles.panelBodyScroll}>
          <MemoryDocumentDetail
            document={props.selectedDocument}
            graph={props.graph}
            documents={props.documents}
            onSelect={props.onSelect}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function MemoryGraphView(props: {
  documents: MemoryDocument[];
  allDocuments: MemoryDocument[];
  graph: MemoryGraph | null;
  selectedDocument: MemoryDocument | null;
  onSelect: (document: MemoryDocument | null) => void;
}) {
  const [focusedHubId, setFocusedHubId] = useState<MemoryHubId | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(true);
  const [docsOpen, setDocsOpen] = useState(true);
  const [dragStart, setDragStart] = useState<{
    clientX: number;
    clientY: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);
  const documentById = useMemo(
    () => new Map(props.documents.map((document) => [document.id, document])),
    [props.documents],
  );
  const allDocumentById = useMemo(
    () =>
      new Map(props.allDocuments.map((document) => [document.id, document])),
    [props.allDocuments],
  );
  const sourceGraph = useMemo(
    () =>
      props.graph ?? {
        nodes: props.documents.map((document) => ({
          id: document.id,
          kind: document.kind,
          title: document.title,
          createdAt: document.createdAt ?? "",
          updatedAt: document.updatedAt ?? "",
          inbound: 0,
          outbound: document.links?.length ?? 0,
        })),
        edges: [],
      },
    [props.documents, props.graph],
  );
  const visibleIds = useMemo(
    () => new Set(props.documents.map((document) => document.id)),
    [props.documents],
  );
  const nodes = useMemo(
    () =>
      sourceGraph.nodes
        .filter((node) => visibleIds.has(node.id))
        .sort((a, b) => b.inbound + b.outbound - (a.inbound + a.outbound)),
    [sourceGraph.nodes, visibleIds],
  );
  const nodeById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );
  const edges = useMemo(
    () =>
      sourceGraph.edges.filter(
        (edge) => nodeById.has(edge.source) && nodeById.has(edge.target),
      ),
    [nodeById, sourceGraph.edges],
  );
  const nodeHub = useMemo(() => classifyNodeHubs(nodes, edges), [edges, nodes]);
  const layout = useMemo(() => layoutGraph(nodes, nodeHub), [nodeHub, nodes]);
  const selectedId = props.selectedDocument?.id ?? null;
  const selectedNeighbors = useMemo(
    () =>
      selectedId ? connectedNodeIds(selectedId, edges) : new Set<string>(),
    [edges, selectedId],
  );
  const hubCounts = useMemo(
    () => countNodesByHub(nodes, nodeHub),
    [nodeHub, nodes],
  );
  const zoomBounds = { min: 0.75, max: 2.2 };
  const viewWidth = 900 / zoom;
  const viewHeight = 560 / zoom;
  const viewX = 450 - viewWidth / 2 - pan.x;
  const viewY = 280 - viewHeight / 2 - pan.y;
  const fullscreenGridColumns = `${categoriesOpen ? "150px" : "32px"} minmax(0, calc(100vw - 32px - 150px - 360px - 3rem - 1.5rem)) ${docsOpen ? "360px" : "32px"}`;

  const zoomBy = (delta: number) => {
    setZoom((current) =>
      clamp(current + delta, zoomBounds.min, zoomBounds.max),
    );
  };
  const selectHubDocument = (hubId: MemoryHubId) => {
    const document =
      allDocumentById.get(hubId) ?? documentById.get(hubId) ?? null;
    if (document) props.onSelect(document);
    if (fullscreen) setDocsOpen(true);
  };
  const selectIndexDocument = () => {
    const document =
      allDocumentById.get("ALL-MEMORY") ??
      documentById.get("ALL-MEMORY") ??
      null;
    props.onSelect(document);
    if (fullscreen) setDocsOpen(true);
  };

  return (
    <div
      className={cn(
        "grid h-full min-h-0 gap-3 xl:grid-cols-[150px_minmax(0,1fr)]",
        fullscreen &&
          "fixed inset-4 z-50 grid bg-background p-4 [grid-template-rows:minmax(0,1fr)]",
      )}
      style={
        fullscreen ? { gridTemplateColumns: fullscreenGridColumns } : undefined
      }
    >
      <div
        className={cn(
          "min-h-0 overflow-y-auto border-r border-border pr-3",
          fullscreen && !categoriesOpen && "overflow-hidden pr-0",
        )}
      >
        {fullscreen && !categoriesOpen ? (
          <button
            type="button"
            className="grid size-7 place-items-center border border-border text-muted-foreground hover:text-foreground"
            onClick={() => setCategoriesOpen(true)}
          >
            <PanelLeftOpen className="size-3.5" />
          </button>
        ) : null}
        {(!fullscreen || categoriesOpen) && (
          <div className="space-y-1">
            {fullscreen && (
              <button
                type="button"
                className="mb-2 grid size-7 place-items-center border border-border text-muted-foreground hover:text-foreground"
                onClick={() => setCategoriesOpen(false)}
              >
                <PanelLeftClose className="size-3.5" />
              </button>
            )}
            <button
              type="button"
              className={cn(
                "flex w-full items-center justify-between rounded-none border bg-transparent px-2 py-1.5 text-left text-[0.58rem] uppercase tracking-[0.18em] transition",
                !focusedHubId
                  ? cn(
                      INDEX_MEMORY_STYLE.bg,
                      INDEX_MEMORY_STYLE.text,
                      INDEX_MEMORY_STYLE.border,
                    )
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
              onClick={() => {
                setFocusedHubId(null);
                selectIndexDocument();
              }}
            >
              <span>all</span>
              <span>{nodes.length}</span>
            </button>
            {MEMORY_HUBS.map((hub) => (
              <button
                key={hub.id}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded-none border bg-transparent px-2 py-1.5 text-left text-[0.58rem] uppercase tracking-[0.18em] transition",
                  focusedHubId === hub.id
                    ? cn(hub.bg, hub.text, hub.border)
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
                )}
                onClick={() => {
                  setFocusedHubId((current) =>
                    current === hub.id ? null : hub.id,
                  );
                  selectHubDocument(hub.id);
                }}
              >
                <span>{hub.label}</span>
                <span>{hubCounts.get(hub.id) ?? 0}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div
        className={cn(
          "relative min-h-[280px] overflow-hidden border border-border bg-transparent",
          fullscreen && "h-full min-w-0",
        )}
      >
        <div className="absolute right-2 top-2 z-10 flex border border-border bg-background/80">
          <button
            type="button"
            className="grid size-7 place-items-center border-r border-border text-[0.65rem] text-muted-foreground hover:text-foreground"
            onClick={() => zoomBy(0.15)}
          >
            +
          </button>
          <button
            type="button"
            className="grid size-7 place-items-center border-r border-border text-[0.65rem] text-muted-foreground hover:text-foreground"
            onClick={() => zoomBy(-0.15)}
          >
            -
          </button>
          <button
            type="button"
            className="grid h-7 w-10 place-items-center text-[0.5rem] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            {Math.round(zoom * 100)}
          </button>
          <button
            type="button"
            className="grid size-7 place-items-center border-l border-border text-muted-foreground hover:text-foreground"
            onClick={() => {
              setFullscreen((current) => {
                const next = !current;
                if (next) setDocsOpen(true);
                return next;
              });
              setCategoriesOpen(true);
            }}
          >
            {fullscreen ? (
              <Minimize2 className="size-3.5" />
            ) : (
              <Maximize2 className="size-3.5" />
            )}
          </button>
        </div>
        <svg
          className={cn(
            "h-full min-h-[280px] w-full touch-none",
            dragStart ? "cursor-grabbing" : "cursor-grab",
          )}
          viewBox={`${viewX} ${viewY} ${viewWidth} ${viewHeight}`}
          role="img"
          aria-label="Memory reference graph"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragStart({
              clientX: event.clientX,
              clientY: event.clientY,
              panX: pan.x,
              panY: pan.y,
              moved: false,
            });
          }}
          onPointerMove={(event) => {
            if (!dragStart) return;
            const deltaX = event.clientX - dragStart.clientX;
            const deltaY = event.clientY - dragStart.clientY;
            setPan({
              x: dragStart.panX + deltaX / zoom,
              y: dragStart.panY + deltaY / zoom,
            });
            if (!dragStart.moved && Math.hypot(deltaX, deltaY) > 3) {
              setDragStart({ ...dragStart, moved: true });
            }
          }}
          onPointerUp={(event) => {
            if (!dragStart?.moved) props.onSelect(null);
            event.currentTarget.releasePointerCapture(event.pointerId);
            setDragStart(null);
          }}
          onPointerCancel={() => setDragStart(null)}
          onDoubleClick={() => setPan({ x: 0, y: 0 })}
          onWheel={(event) => {
            event.preventDefault();
            const delta = clamp(-event.deltaY / 1200, -0.12, 0.12);
            zoomBy(delta);
          }}
        >
          <g>
            {edges.map((edge) => {
              const source = layout.get(edge.source);
              const target = layout.get(edge.target);
              if (!source || !target) return null;
              const isActive =
                edge.source === selectedId || edge.target === selectedId;
              const sourceHub = hubForNode(edge.source, nodeHub);
              const targetHub = hubForNode(edge.target, nodeHub);
              const sameHub = sourceHub.id === targetHub.id;
              const inFocusedHub =
                !focusedHubId ||
                sourceHub.id === focusedHubId ||
                targetHub.id === focusedHubId;
              const inSelectedNeighborhood =
                !selectedId ||
                isActive ||
                selectedNeighbors.has(edge.source) ||
                selectedNeighbors.has(edge.target);
              return (
                <line
                  key={`${edge.source}-${edge.target}`}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  className={cn(
                    sameHub ? sourceHub.stroke : "stroke-border",
                    !isActive && "opacity-45",
                    isActive && "opacity-90",
                    (!inFocusedHub || !inSelectedNeighborhood) && "opacity-15",
                    edge.kind === "missing" && "stroke-dashed opacity-40",
                  )}
                  strokeWidth={isActive ? 2.4 : sameHub ? 1.4 : 1}
                />
              );
            })}
          </g>
          <g>
            {nodes.map((node) => {
              const point = layout.get(node.id);
              if (!point) return null;
              const selected = node.id === selectedId;
              const radius = Math.min(
                isPrimaryNode(node.id) ? 42 : 31,
                (isPrimaryNode(node.id) ? 27 : 15) +
                  (node.inbound + node.outbound) * 2.2,
              );
              const document = documentById.get(node.id);
              const hub = hubForNode(node.id, nodeHub);
              const style = styleForNode(node.id, nodeHub);
              const inFocusedHub = !focusedHubId || hub.id === focusedHubId;
              const inSelectedNeighborhood =
                !selectedId || selected || selectedNeighbors.has(node.id);
              return (
                <a
                  key={node.id}
                  href={`#memory-${node.id}`}
                  className="cursor-pointer outline-none"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    if (document) {
                      event.preventDefault();
                      if (!selected && fullscreen) setDocsOpen(true);
                      props.onSelect(selected ? null : document);
                    }
                  }}
                >
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={radius}
                    className={cn(
                      "transition-colors",
                      style.fill,
                      style.stroke,
                      !isPrimaryNode(node.id) && "opacity-80",
                      (!inFocusedHub || !inSelectedNeighborhood) &&
                        "opacity-25",
                      selected && "opacity-100",
                    )}
                    strokeWidth={
                      selected ? 4 : isPrimaryNode(node.id) ? 2.7 : 1.8
                    }
                  />
                  <text
                    x={point.x}
                    y={point.y + radius + 17}
                    textAnchor="middle"
                    className={cn(
                      "fill-muted-foreground text-[12px]",
                      isPrimaryNode(node.id) && "text-[13px] font-semibold",
                      !inFocusedHub && "opacity-45",
                      selected && "fill-foreground font-semibold",
                    )}
                  >
                    {isPrimaryNode(node.id)
                      ? style.shortLabel
                      : shortLabel(node.title || node.id)}
                  </text>
                </a>
              );
            })}
          </g>
        </svg>
      </div>
      {fullscreen && docsOpen && (
        <div className="h-full min-w-0 overflow-y-auto border border-border p-3">
          <button
            type="button"
            className="mb-3 grid size-7 place-items-center border border-border text-muted-foreground hover:text-foreground"
            onClick={() => setDocsOpen(false)}
          >
            <PanelRightClose className="size-3.5" />
          </button>
          <MemoryDocumentDetail
            document={props.selectedDocument}
            graph={props.graph}
            documents={props.documents}
            onSelect={props.onSelect}
          />
        </div>
      )}
      {fullscreen && !docsOpen && (
        <div className="h-full min-w-0 overflow-hidden border border-border">
          <button
            type="button"
            className="grid size-7 place-items-center border-b border-border text-muted-foreground hover:text-foreground"
            onClick={() => setDocsOpen(true)}
          >
            <ChevronLeft className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function MemoryDocumentDetail(props: {
  document: MemoryDocument | null;
  graph: MemoryGraph | null;
  documents: MemoryDocument[];
  onSelect: (document: MemoryDocument | null) => void;
}) {
  if (!props.document) {
    return (
      <p className={workspacePageStyles.cardBodyText}>
        select a memory document to inspect its body and provenance.
      </p>
    );
  }

  const backlinks =
    props.graph?.edges
      .filter((edge) => edge.target === props.document?.id)
      .map((edge) =>
        props.documents.find((document) => document.id === edge.source),
      )
      .filter((document): document is MemoryDocument => Boolean(document)) ??
    [];
  const outlinks = (props.document.links ?? [])
    .map((id) => props.documents.find((document) => document.id === id))
    .filter((document): document is MemoryDocument => Boolean(document));
  const nodeHub = classifyNodeHubs(
    props.documents.map((document) => ({
      id: document.id,
      kind: document.kind,
      title: document.title,
      createdAt: document.createdAt ?? "",
      updatedAt: document.updatedAt ?? "",
      inbound: 0,
      outbound: document.links?.length ?? 0,
    })),
    props.graph?.edges ?? [],
  );
  const style = styleForNode(props.document.id, nodeHub);

  return (
    <div className={workspacePageStyles.formGroup}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={cn(workspacePageStyles.badgeSmall, style.bg, style.text)}
        >
          {props.document.id === "ALL-MEMORY"
            ? "index"
            : isHubNode(props.document.id)
              ? "hub"
              : style.label}
        </Badge>
        <span className={devStyles.tinyMeta}>
          {props.document.updatedAt
            ? formatEventTime(props.document.updatedAt)
            : "unknown"}
        </span>
      </div>
      <FormattedText value={props.document.body || "empty memory document"} />
      {(outlinks.length > 0 || backlinks.length > 0) && (
        <div className={workspacePageStyles.formGroup}>
          <p className={workspacePageStyles.cardLabel}>{"// references"}</p>
          <ReferenceList
            label="outgoing"
            documents={outlinks}
            onSelect={props.onSelect}
          />
          <ReferenceList
            label="backlinks"
            documents={backlinks}
            onSelect={props.onSelect}
          />
        </div>
      )}
    </div>
  );
}

function ReferenceList(props: {
  label: string;
  documents: MemoryDocument[];
  onSelect: (document: MemoryDocument | null) => void;
}) {
  if (props.documents.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className={devStyles.tinyMeta}>{props.label}</p>
      <div className="flex flex-wrap gap-2">
        {props.documents.map((document) => (
          <button
            key={`${props.label}-${document.kind}/${document.id}`}
            type="button"
            className="rounded-none border border-border bg-transparent px-2 py-1 text-left text-[0.6rem] text-foreground hover:border-foreground"
            onClick={() => props.onSelect(document)}
          >
            {document.title || document.id}
          </button>
        ))}
      </div>
    </div>
  );
}

function classifyNodeHubs(
  nodes: MemoryGraphNode[],
  edges: MemoryGraph["edges"],
): Map<string, MemoryHubId> {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const assignments = new Map<string, MemoryHubId>();

  for (const hub of MEMORY_HUBS) {
    if (nodeIds.has(hub.id)) assignments.set(hub.id, hub.id);
  }

  for (const edge of edges) {
    if (isIndexNode(edge.source) || isIndexNode(edge.target)) continue;
    const sourceHub = MEMORY_HUB_IDS.has(edge.source as MemoryHubId)
      ? (edge.source as MemoryHubId)
      : null;
    const targetHub = MEMORY_HUB_IDS.has(edge.target as MemoryHubId)
      ? (edge.target as MemoryHubId)
      : null;
    if (sourceHub && !assignments.has(edge.target)) {
      assignments.set(edge.target, sourceHub);
    }
    if (targetHub && !assignments.has(edge.source)) {
      assignments.set(edge.source, targetHub);
    }
  }

  for (const node of nodes) {
    if (!assignments.has(node.id)) assignments.set(node.id, DEFAULT_HUB.id);
  }

  return assignments;
}

function countNodesByHub(
  nodes: MemoryGraphNode[],
  nodeHub: Map<string, MemoryHubId>,
) {
  const counts = new Map<MemoryHubId, number>();
  for (const node of nodes) {
    if (isIndexNode(node.id)) continue;
    const hubId = nodeHub.get(node.id) ?? DEFAULT_HUB.id;
    counts.set(hubId, (counts.get(hubId) ?? 0) + 1);
  }
  return counts;
}

function hubForNode(
  nodeId: string,
  nodeHub: Map<string, MemoryHubId>,
): MemoryHubConfig {
  return (
    MEMORY_HUB_BY_ID.get(nodeHub.get(nodeId) ?? DEFAULT_HUB.id) ?? DEFAULT_HUB
  );
}

function styleForNode(nodeId: string, nodeHub: Map<string, MemoryHubId>) {
  return isIndexNode(nodeId) ? INDEX_MEMORY_STYLE : hubForNode(nodeId, nodeHub);
}

function isIndexNode(nodeId: string) {
  return nodeId === "ALL-MEMORY";
}

function isHubNode(nodeId: string): nodeId is MemoryHubId {
  return MEMORY_HUB_IDS.has(nodeId as MemoryHubId);
}

function isPrimaryNode(nodeId: string) {
  return isIndexNode(nodeId) || isHubNode(nodeId);
}

function connectedNodeIds(nodeId: string, edges: MemoryGraph["edges"]) {
  const connected = new Set<string>([nodeId]);
  for (const edge of edges) {
    if (edge.source === nodeId) connected.add(edge.target);
    if (edge.target === nodeId) connected.add(edge.source);
  }
  return connected;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function layoutGraph(
  nodes: MemoryGraphNode[],
  nodeHub: Map<string, MemoryHubId>,
) {
  const centerX = 450;
  const centerY = 280;
  const layout = new Map<string, { x: number; y: number }>();

  if (nodes.some((node) => isIndexNode(node.id))) {
    layout.set("ALL-MEMORY", { x: centerX, y: centerY });
  }

  MEMORY_HUBS.forEach((hub, index) => {
    const angle = (index / MEMORY_HUBS.length) * Math.PI * 2 - Math.PI / 2;
    layout.set(hub.id, {
      x: centerX + Math.cos(angle) * 305,
      y: centerY + Math.sin(angle) * 195,
    });
  });

  const nodesByHub = new Map<MemoryHubId, MemoryGraphNode[]>();
  for (const node of nodes) {
    if (isPrimaryNode(node.id)) continue;
    const hubId = nodeHub.get(node.id) ?? DEFAULT_HUB.id;
    nodesByHub.set(hubId, [...(nodesByHub.get(hubId) ?? []), node]);
  }

  for (const hub of MEMORY_HUBS) {
    const hubPoint = layout.get(hub.id) ?? { x: centerX, y: centerY };
    const children = nodesByHub.get(hub.id) ?? [];
    const baseAngle =
      (MEMORY_HUBS.findIndex((entry) => entry.id === hub.id) /
        MEMORY_HUBS.length) *
        Math.PI *
        2 -
      Math.PI / 2;
    children.forEach((node, index) => {
      const spread = children.length <= 1 ? 0 : Math.PI / 2.6;
      const offset =
        children.length <= 1
          ? 0
          : (index / (children.length - 1) - 0.5) * spread;
      const angle = baseAngle + offset;
      const ring = 78 + (index % 3) * 34;
      layout.set(node.id, {
        x: hubPoint.x + Math.cos(angle) * ring,
        y: hubPoint.y + Math.sin(angle) * ring,
      });
    });
  }

  nodes.forEach((node, index) => {
    if (layout.has(node.id)) return;
    const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2;
    layout.set(node.id, {
      x: centerX + Math.cos(angle) * 170,
      y: centerY + Math.sin(angle) * 110,
    });
  });
  return layout;
}

function shortLabel(value: string) {
  return value.length > 22 ? `${value.slice(0, 21)}…` : value;
}
