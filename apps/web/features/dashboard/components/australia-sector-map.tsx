import type { KeyboardEvent } from "react";

type RegionCode = "AU" | "NSW" | "VIC" | "QLD" | "SA" | "WA" | "TAS" | "ACT" | "NT";
type SelectableRegionCode = Exclude<RegionCode, "AU">;

type AustraliaSectorMapProps = {
  region: RegionCode;
  onSelectRegion: (region: SelectableRegionCode) => void;
};

type MapRegion = {
  code: SelectableRegionCode;
  labelX: number;
  labelY: number;
  path: string;
};

const COASTLINE_PATH =
  "M30 82 L356 82 Q366 94 374 112 Q382 132 380 154 L372 214 L330 224 L324 252 L316 268 L304 282 L258 280 L252 242 L178 242 L144 270 L86 262 Q66 244 52 226 Q38 206 34 174 Q30 150 30 82 Z";

const MAP_REGIONS: readonly MapRegion[] = [
  {
    code: "WA",
    labelX: 106,
    labelY: 177,
    path: "M30 82 L178 82 L178 242 L144 270 L86 262 Q66 244 52 226 Q38 206 34 174 Q30 150 30 82 Z"
  },
  {
    code: "NT",
    labelX: 212,
    labelY: 126,
    path: "M178 82 L248 82 L248 164 L178 164 Z"
  },
  {
    code: "SA",
    labelX: 212,
    labelY: 202,
    path: "M178 164 L248 164 L248 242 L178 242 Z"
  },
  {
    code: "QLD",
    labelX: 324,
    labelY: 126,
    path: "M248 82 L356 82 Q366 94 374 112 Q382 132 380 154 L372 214 L330 224 L312 202 L248 164 Z"
  },
  {
    code: "NSW",
    labelX: 314,
    labelY: 206,
    path: "M248 164 L312 202 L330 210 Q328 234 324 252 L252 242 Z"
  },
  {
    code: "VIC",
    labelX: 286,
    labelY: 264,
    path: "M252 242 L324 252 L316 268 L304 282 L258 280 Z"
  },
  {
    code: "TAS",
    labelX: 316,
    labelY: 307,
    path: "M298 292 L334 292 L328 316 L304 316 Z"
  },
  {
    code: "ACT",
    labelX: 300,
    labelY: 230,
    path: "M296 223 L304 223 L304 231 L296 231 Z"
  }
] as const;

function handleRegionKeyDown(
  event: KeyboardEvent<SVGPathElement>,
  regionCode: SelectableRegionCode,
  onSelectRegion: (region: SelectableRegionCode) => void
) {
  if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") {
    return;
  }

  event.preventDefault();
  onSelectRegion(regionCode);
}

export function AustraliaSectorMap({ region, onSelectRegion }: AustraliaSectorMapProps) {
  return (
    <div className="dashboard-map-svg-layer" aria-label="Australia sector map">
      <svg
        className="dashboard-map-svg"
        viewBox="0 0 420 340"
        role="img"
        aria-label="Australia state and territory map"
      >
        <path d={COASTLINE_PATH} className="dashboard-map-coastline" aria-hidden />
        {MAP_REGIONS.map((mapRegion) => {
          const isActive = region !== "AU" && region === mapRegion.code;
          return (
            <g key={mapRegion.code}>
              <path
                d={mapRegion.path}
                role="button"
                tabIndex={0}
                aria-label={`Select region ${mapRegion.code}`}
                aria-pressed={isActive}
                data-region-code={mapRegion.code}
                data-active={isActive}
                className="dashboard-map-state"
                onClick={() => onSelectRegion(mapRegion.code)}
                onKeyDown={(event) => handleRegionKeyDown(event, mapRegion.code, onSelectRegion)}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={mapRegion.labelX}
                y={mapRegion.labelY}
                className="dashboard-map-state-label"
                textAnchor="middle"
                aria-hidden
              >
                {mapRegion.code}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
