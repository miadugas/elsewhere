#!/usr/bin/env python3
"""
Build src/data/metros.json from public government data.

One command:  python3 scripts/build-metros.py   (or  npm run data:build)

Sources (no API key needed):
  - BEA Metropolitan-Area Regional Price Parities (MARPP) -> the rpp values
  - Census CBSA population estimates -> the `pop` field (search ranking)
  - Census CBSA population file (county rows) -> county→CBSA crosswalk
  - GitHub: US County-Level 2024 Presidential Results -> politics margin
  - EPA AQS: annual_aqi_by_cbsa_2024.zip -> aqi (median AQI)
  - FEMA NRI county table -> risk composite score (wrapped; skips if blocked)
  - NOAA 1991-2020 Normals -> tempF, humidity (deferred; slow to build)

The two are joined on the CBSA code, which is the BEA GeoFIPS. Bump the
URLs below to refresh the vintage when new data ships.
"""
import csv, io, json, math, re, sys, urllib.request, zipfile
from pathlib import Path

BEA_ZIP = "https://apps.bea.gov/regional/zip/MARPP.zip"
CENSUS_CSV = (
    "https://www2.census.gov/programs-surveys/popest/datasets/"
    "2020-2023/metro/totals/cbsa-est2023-alldata.csv"
)
ELECTION_CSV = (
    "https://raw.githubusercontent.com/tonmcg/"
    "US_County_Level_Election_Results_08-24/master/2024_US_County_Level_Presidential_Results.csv"
)
EPA_AQI_ZIP = "https://aqs.epa.gov/aqsweb/airdata/annual_aqi_by_cbsa_2024.zip"
FEMA_NRI_ZIP = (
    "https://hazards.fema.gov/nri/Content/StaticDocuments/DataDownload/"
    "NRI_Table_Counties/NRI_Table_Counties.zip"
)
GAZ_CBSA = (
    "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/"
    "2023_Gaz_cbsa_national.zip"
)

OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "metros.json"

# BEA line codes -> our rpp categories (Utilities/line 4 has no slot; `overall`
# already includes it). See docs/superpowers/specs for the design rationale.
LINE_MAP = {"1": "overall", "2": "goods", "3": "housing", "5": "otherServices"}
MSA_SUFFIX = " (Metropolitan Statistical Area)"


def fetch(url: str) -> bytes:
    print(f"  fetch {url}", file=sys.stderr)
    req = urllib.request.Request(url, headers={"User-Agent": "elsewhere-build/1.0"})
    with urllib.request.urlopen(req) as r:
        return r.read()


def load_population() -> dict[str, int]:
    raw = fetch(CENSUS_CSV).decode("latin-1")
    rows = csv.reader(io.StringIO(raw))
    h = next(rows)
    ci, mdiv, stcou = h.index("CBSA"), h.index("MDIV"), h.index("STCOU")
    pcol = max(i for i, c in enumerate(h) if c.startswith("POPESTIMATE"))
    pop: dict[str, int] = {}
    for r in rows:
        if len(r) <= pcol:
            continue
        if r[mdiv].strip() == "" and r[stcou].strip() == "":  # CBSA total only
            try:
                pop[r[ci].strip()] = int(r[pcol])
            except ValueError:
                pass
    return pop


def load_county_to_cbsa() -> dict[str, str]:
    """county FIPS (5-digit) -> CBSA code.

    Derived from the Census CBSA population estimates file, which contains
    county-level rows (non-empty STCOU). This avoids needing the delineation
    XLSX (which is not CSV-parseable without openpyxl).
    """
    raw = fetch(CENSUS_CSV).decode("latin-1")
    rows = csv.reader(io.StringIO(raw))
    h = next(rows)
    ci = h.index("CBSA")
    stcou_col = h.index("STCOU")
    out: dict[str, str] = {}
    for r in rows:
        if len(r) <= max(ci, stcou_col):
            continue
        cbsa = r[ci].strip()
        stcou = r[stcou_col].strip()
        # County rows have a 5-digit STCOU; CBSA totals have empty STCOU
        if stcou and stcou.isdigit() and cbsa.isdigit():
            out[stcou.zfill(5)] = cbsa
    return out


def load_rpp() -> dict[str, dict]:
    zf = zipfile.ZipFile(io.BytesIO(fetch(BEA_ZIP)))
    name = next(n for n in zf.namelist() if re.match(r"MARPP_MSA.*\.csv$", n))
    rows = list(csv.reader(io.StringIO(zf.read(name).decode("utf-8"))))
    h = [c.strip() for c in rows[0]]
    iG, iN, iL = h.index("GeoFIPS"), h.index("GeoName"), h.index("LineCode")
    years = sorted(
        (i for i, c in enumerate(h) if c.strip().isdigit()),
        key=lambda i: int(h[i]),
        reverse=True,
    )

    def latest(r):
        for i in years:
            if i < len(r):
                try:
                    return round(float(r[i].strip().strip('"')), 1)
                except ValueError:
                    continue
        return None

    metros: dict[str, dict] = {}
    for r in rows[1:]:
        if len(r) <= iL or not r[iN].strip().endswith(MSA_SUFFIX):
            continue
        if r[iL].strip() not in LINE_MAP:
            continue
        fips = r[iG].strip().strip(' "')
        m = metros.setdefault(fips, {"name": r[iN].strip()[: -len(MSA_SUFFIX)], "rpp": {}})
        v = latest(r)
        if v is not None:
            m["rpp"][LINE_MAP[r[iL].strip()]] = v
    return metros


def load_politics(c2cbsa: dict[str, str]) -> dict[str, float]:
    """CBSA code -> signed margin in points (+ = Dem, - = Rep)."""
    raw = fetch(ELECTION_CSV).decode("utf-8-sig")
    rows = csv.DictReader(io.StringIO(raw))
    agg: dict[str, list[float]] = {}
    for r in rows:
        fips = (r.get("county_fips") or "").strip().zfill(5)
        cbsa = c2cbsa.get(fips)
        if not cbsa:
            continue
        try:
            dem = float(r["votes_dem"])
            rep = float(r["votes_gop"])
        except (KeyError, ValueError):
            continue
        a = agg.setdefault(cbsa, [0.0, 0.0])
        a[0] += dem
        a[1] += rep
    out: dict[str, float] = {}
    for cbsa, (dem, rep) in agg.items():
        total = dem + rep
        if total > 0:
            out[cbsa] = round((dem - rep) / total * 100, 1)
    return out


def load_aqi() -> dict[str, float]:
    """CBSA code -> median AQI."""
    zf = zipfile.ZipFile(io.BytesIO(fetch(EPA_AQI_ZIP)))
    name = next(n for n in zf.namelist() if n.endswith(".csv"))
    rows = csv.DictReader(io.StringIO(zf.read(name).decode("utf-8")))
    out: dict[str, float] = {}
    for r in rows:
        cbsa = (r.get("CBSA Code") or "").strip()
        try:
            out[cbsa] = float(r["Median AQI"])
        except (KeyError, ValueError):
            continue
    return out


def load_risk(c2cbsa: dict[str, str]) -> dict[str, float]:
    """CBSA code -> population-weighted mean composite risk score (0-100).

    FEMA NRI download may be blocked (returns HTML). Wrapped in safe() in
    main() so failure skips gracefully.
    """
    raw = fetch(FEMA_NRI_ZIP)
    # FEMA sometimes returns HTML instead of a zip (access denied / WAF)
    if not raw[:2] == b"PK":
        raise RuntimeError("FEMA NRI response is not a ZIP (likely access denied)")
    zf = zipfile.ZipFile(io.BytesIO(raw))
    name = next(n for n in zf.namelist() if n.endswith(".csv"))
    rows = csv.DictReader(io.StringIO(zf.read(name).decode("latin-1")))
    agg: dict[str, list[float]] = {}
    # Column names may vary; try common variants
    for r in rows:
        fips_key = next((k for k in r if k.upper() in ("STCOFIPS", "COUNTYFIPS", "FIPS")), None)
        risk_key = next((k for k in r if "RISK_SCORE" in k.upper() or k.upper() == "RISK_SCORE"), None)
        pop_key = next((k for k in r if k.upper() in ("POPULATION", "POPULATION_2020")), None)
        if not (fips_key and risk_key):
            break  # header not as expected; bail
        fips = (r.get(fips_key) or "").strip().zfill(5)
        cbsa = c2cbsa.get(fips)
        if not cbsa:
            continue
        try:
            score = float(r[risk_key])
            pop = float(r.get(pop_key, 0) or 0) or 1.0
        except (KeyError, ValueError):
            continue
        a = agg.setdefault(cbsa, [0.0, 0.0])
        a[0] += score * pop
        a[1] += pop
    return {cbsa: round(ws / ps, 1) for cbsa, (ws, ps) in agg.items() if ps > 0}


# ---------------------------------------------------------------------------
# Climate (NOAA 1991-2020 Normals)
# ---------------------------------------------------------------------------
# The NOAA normals directory has ~9,000 per-station CSVs. Fetching the full
# index + iterating them is impractical in a single build run (slow/large).
# This implementation is deferred: load_climate() returns {} and is wrapped
# in safe() so the build succeeds without it.  tempF/humidity remain absent
# from metros.json until a dedicated offline cache step is added.
# ---------------------------------------------------------------------------


def load_cbsa_centroids() -> dict[str, tuple[float, float]]:
    zf = zipfile.ZipFile(io.BytesIO(fetch(GAZ_CBSA)))
    name = next(n for n in zf.namelist() if n.endswith((".txt", ".csv")))
    text = zf.read(name).decode("latin-1")
    rows = csv.DictReader(io.StringIO(text), delimiter="\t")
    out: dict[str, tuple[float, float]] = {}
    for r in rows:
        try:
            cbsa = (r.get("GEOID") or r.get("CBSA") or "").strip()
            lat = float((r.get("INTPTLAT") or "").strip())
            lng_key = next((k for k in r if k and k.strip().startswith("INTPTLONG")), None)
            lng = float((r.get(lng_key) or "").strip()) if lng_key else None
            if cbsa and lng is not None:
                out[cbsa] = (lat, lng)
        except (KeyError, ValueError, TypeError):
            continue
    return out


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    R = 6371.0
    (lat1, lon1), (lat2, lon2) = a, b
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def load_climate() -> dict[str, dict]:
    """CBSA code -> {"tempF": float, "humidity"?: float}.

    Deferred: NOAA per-station CSVs require fetching thousands of files.
    Returns {} until a dedicated offline cache step is implemented.
    """
    return {}


def slug(s: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s.lower())).strip("-")


def main() -> None:
    print("Building metros.json …", file=sys.stderr)
    pop = load_population()
    metros = load_rpp()

    # county→CBSA crosswalk (derived from same CBSA pop file — no extra fetch)
    c2cbsa = load_county_to_cbsa()

    def safe(name: str, fn):
        try:
            return fn()
        except Exception as e:
            print(f"  {name} skipped: {e}", file=sys.stderr)
            return {}

    politics = safe("politics", lambda: load_politics(c2cbsa))
    aqi = safe("aqi", load_aqi)
    risk = safe("risk", lambda: load_risk(c2cbsa))
    climate = safe("climate", load_climate)

    cover = {"politics": 0, "tempF": 0, "humidity": 0, "aqi": 0, "risk": 0}

    out, used, missing = [], set(), 0
    for fips, m in metros.items():
        rpp = m["rpp"]
        if not all(k in rpp for k in ("overall", "goods", "housing", "otherServices")):
            continue
        namepart, _, statepart = m["name"].strip().rpartition(", ")
        if not statepart:
            namepart, statepart = m["name"].strip(), ""
        short = namepart.split("-")[0].strip()
        states = [s for s in statepart.split("-") if s]
        base = f"{slug(short)}-{states[0].lower()}" if states else slug(short)
        cid = base if base not in used else f"{base}-{fips}"
        used.add(cid)
        entry = {"id": cid, "name": m["name"].strip(), "short": short, "states": states, "rpp": rpp}
        if fips in pop:
            entry["pop"] = pop[fips]
        else:
            missing += 1

        # Enrichment fields
        if fips in politics:
            entry["politics"] = politics[fips]
            cover["politics"] += 1
        if fips in aqi:
            entry["aqi"] = aqi[fips]
            cover["aqi"] += 1
        if fips in risk:
            entry["risk"] = risk[fips]
            cover["risk"] += 1
        if fips in climate:
            cl = climate[fips]
            entry["tempF"] = cl["tempF"]
            cover["tempF"] += 1
            if "humidity" in cl:
                entry["humidity"] = cl["humidity"]
                cover["humidity"] += 1

        out.append(entry)

    out.sort(key=lambda x: -x.get("pop", 0))  # biggest first (search re-ranks)
    OUT.write_text(json.dumps(out, indent=2) + "\n")
    print(f"  wrote {len(out)} metros -> {OUT}  ({missing} missing pop)", file=sys.stderr)
    print(f"  coverage: {cover} of {len(out)} metros", file=sys.stderr)


if __name__ == "__main__":
    main()
