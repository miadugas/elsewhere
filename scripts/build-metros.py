#!/usr/bin/env python3
"""
Build src/data/metros.json from public government data.

One command:  python3 scripts/build-metros.py   (or  npm run data:build)

Sources (no API key needed):
  - BEA Metropolitan-Area Regional Price Parities (MARPP) -> the rpp values
  - Census CBSA population estimates -> the `pop` field (search ranking)

The two are joined on the CBSA code, which is the BEA GeoFIPS. Bump the
URLs below to refresh the vintage when new data ships.
"""
import csv, io, json, re, sys, urllib.request, zipfile
from pathlib import Path

BEA_ZIP = "https://apps.bea.gov/regional/zip/MARPP.zip"
CENSUS_CSV = (
    "https://www2.census.gov/programs-surveys/popest/datasets/"
    "2020-2023/metro/totals/cbsa-est2023-alldata.csv"
)
OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "metros.json"

# BEA line codes -> our rpp categories (Utilities/line 4 has no slot; `overall`
# already includes it). See docs/superpowers/specs for the design rationale.
LINE_MAP = {"1": "overall", "2": "goods", "3": "housing", "5": "otherServices"}
MSA_SUFFIX = " (Metropolitan Statistical Area)"


def fetch(url: str) -> bytes:
    print(f"  fetch {url}", file=sys.stderr)
    with urllib.request.urlopen(url) as r:
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


def slug(s: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s.lower())).strip("-")


def main() -> None:
    print("Building metros.json …", file=sys.stderr)
    pop = load_population()
    metros = load_rpp()

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
        out.append(entry)

    out.sort(key=lambda x: -x.get("pop", 0))  # biggest first (search re-ranks)
    OUT.write_text(json.dumps(out, indent=2) + "\n")
    print(f"  wrote {len(out)} metros -> {OUT}  ({missing} missing pop)", file=sys.stderr)


if __name__ == "__main__":
    main()
