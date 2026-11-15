# The places

**Assumes** [places.md](../../requirements/web/places.md) — what the places component promises, and which countries a trip visits.

## 1. Purpose

The places component is the part of the web app that knows the time zone of the places a traveller
types. It keeps, on the device, every airport with a three-letter code and the towns of each country
the device's trips visit. It gives `web/screens` the place a traveller means, with its time zone, so
that a time's zone is filled in rather than chosen by hand.

## 2. Scope

The places component covers the files of airports and towns, fetching and keeping them on a device,
finding a place by its code or its name, and the build that makes the files.

Three things act on it:

- **`web/screens`** asks for an airport by its code, and for the towns matching what a traveller
  types (§3.3).
- **`web/trip-store`**, the component that keeps each trip's copy, gives the trips whose countries
  the places component fetches.
- **A maintainer** runs the build when GeoNames or OurAirports publish newer data (§4.5).

Deliberately absent:

- choosing a zone for the traveller, which `web/screens` fills in and the traveller may change
- finding the town the phone is in
- holding anything of any traveller

A place's time zone is filled in from a list of places, kept on the phone one country at a time
(ADR-0019, a place's time zone is filled in from a list of places, kept on the phone one country at
a time). The places component is part of the package `@itinero/web`, in `apps/web/src/places/`
(ADR-0018, the web app is built with Preact, and served by Itinero's own Worker).

## 3. Interface

### 3.1 User interface

None of its own. `web/screens` shows the places it gives, the countries it holds, and the line
`Place names from GeoNames, under CC BY 4.0`, in the settings.

### 3.2 Application interface

The places component serves its files as static files of the web app, beside the files of each
version, from Itinero's own address:

| Path | Holds |
|---|---|
| `/places/index.json` | `{ "version": ..., "countries": { "CL": ..., ... } }`: the list's version, and each country's file size |
| `/places/airports.json` | Every airport (§5.1) |
| `/places/{country}.json` | The towns of one country, named by its ISO 3166-1 alpha-2 code, such as `/places/CL.json` (§5.1) |

The service worker of `web/shell` sends these requests to the network untouched, because they are
not among a version's files.

### 3.3 Programming interface

```ts
import type { Result } from "@itinero/trip-time";

type Place = {
  kind: "airport" | "town";
  name: string;            // such as "Puerto Natales", or "Arturo Merino Benítez International Airport"
  code?: string;           // an airport's three-letter code, such as "SCL"
  town?: string;           // an airport's town, such as "Santiago"
  region?: string;         // a town's region, such as "Magallanes"
  country: string;         // an ISO 3166-1 alpha-2 code, such as "CL"
  zone: string;            // a time zone, such as "America/Punta_Arenas"
};

function startPlaces(): void;
function airport(code: string): Promise<Place | undefined>;
function towns(words: string, limit?: number): Promise<readonly Place[]>;   // limit: 10 if absent
function held(): Promise<readonly string[]>;                                 // countries held
function fetchCountry(country: string): Promise<Result<true>>;
```

`fetchCountry` refuses with `offline` where the device has no connection, and with
`unknown-country` for a code `/places/index.json` does not list.

### 3.4 Systems this drives

The places component stores its files in Cache Storage, in a cache named `itinero-places`, which
`spec/web/shell.md` §3.4 describes. No version of the web app deletes it, and signing out leaves it,
since it holds nothing of any traveller.

At build time, it reads two public datasets:

- **GeoNames** publishes the world's places, each with its name, other names, country, region,
  population, position and time zone. Its file `cities1000.txt` holds every town of 1,000 people or
  more, and `admin1CodesASCII.txt` the names of each country's regions. Both are published under the
  Creative Commons Attribution 4.0 licence, which asks that GeoNames be named wherever its data is
  shown.
- **OurAirports** publishes the world's airports in `airports.csv`, each with its type, its
  three-letter IATA code where it has one, its town, its country and its position, in the public
  domain. It gives no time zone.

## 4. Behaviour

### 4.1 Which countries a device holds

*Porcelain:* `startPlaces()` runs once the trip store has opened, and whenever it tells its
listeners that the trips or the connection have changed (`WEB:PLACES-F2`). While the device is
online, it works out the countries the device needs:

- the `country` of every page made for a country, in each trip's copy
- the country of every stretch, in each trip's copy that holds the calendar
- every country a traveller fetched by choosing it, which the component records in its cache

It then fetches, one at a time, `/places/index.json`, the airports where they are not held, and each
country needed whose file is not held or is of an older version. A country no trip needs any longer
is kept, since a traveller may return to it. A fetch that fails is tried again the next time the
trips or the connection change.

### 4.2 airport

*Porcelain:* `airport(code)` reads the airports into memory, once, and gives the airport whose code
equals `code` with its letters made capitals, or `undefined` (`WEB:PLACES-F1`).

### 4.3 towns

*Porcelain:* `towns(words, limit)` reads the towns of every country held into memory, once for each
country, and gives the towns matching `words`, at most `limit` of them (`WEB:PLACES-F1`).

Matching compares folded text. A text is folded by decomposing it into Unicode's NFD form, dropping
every combining mark, and making it lower case, so `Valparaíso` folds to `valparaiso`. A town matches
where every word of the folded `words` begins some word of the folded name, in any order. Matches
come first where the name begins with the first word, then by population, largest first, then by
name, so `Santiago` gives Chile's capital before smaller towns of that name.

Each folded name is made once, when its country is read, so each letter typed is one pass over the
towns held (`WEB:PLACES-NFR1`).

### 4.4 fetchCountry

*Porcelain:* `fetchCountry(country)` fetches the country's file, stores it, and records it as
chosen, so that §4.1 keeps it up to date (`WEB:PLACES-F2`). Where the device is offline, it refuses
with `offline` and fetches nothing.

### 4.5 The build

*Plumbing:* `npm run build-places` in `apps/web/` reads the files a maintainer has downloaded from
GeoNames and OurAirports, and writes the files of §5.1 into `apps/web/places/`, which is committed
and copied into each build of the web app. The build:

1. reads every town of `cities1000.txt`, with its name, population, country, region and time zone,
   and its region's name from `admin1CodesASCII.txt`
2. writes each country's towns, ordered by population, largest first
3. reads every airport of `airports.csv` with an IATA code, whose type is not `closed`
4. gives each airport the time zone of the nearest town of `cities1000.txt` in the same country,
   measured along the earth's surface, and leaves out an airport whose country has no town
5. writes `index.json`, whose version is the date the GeoNames files were downloaded, such as
   `2026-11-14`

The same downloaded files always give the same bytes, since every list is sorted and every number
written the same way.

### 4.6 The test suite

The places component's tests run in the suite of `apps/web/`, which `spec/web/shell.md` §4.5
describes.

- **Unit tests** cover folding, matching and ordering, with the towns of Chile and the United
  States, and `airport` for a sample of codes, with no network.
- **Build tests** run the build on a small sample of each dataset, and confirm its output, and that
  a second run gives the same bytes.
- **Fetch tests** give a stand-in trip store trips visiting Chile, then Argentina, and confirm each
  country's file is fetched once, and not again until the version changes.
- **Size tests** fail where the airports exceed 200 kilobytes, or any country 600 kilobytes,
  compressed with gzip (`WEB:PLACES-NFR2`).
- **Timing tests** type `Springfield` against the towns of the United States, and fail where an
  answer takes over 50 milliseconds on the machine running them. The check on a phone of
  `WEB:PLACES-NFR1` is made by hand before each release.

## 5. Resources

### 5.1 The files

Every file is one JSON object, written with no white space. Each file names its time zones once, in
a list, and each place names its zone by its place in the list.

```json
{
  "country": "CL",
  "towns": [["Santiago", "Santiago Metropolitan", 0], ["Puerto Natales", "Magallanes", 1]],
  "version": "2026-11-14",
  "zones": ["America/Santiago", "America/Punta_Arenas"]
}
```

A town is its name, its region's name, and its zone. The airports file holds, for each airport, its
code, its name, its town, its country and its zone, ordered by code:

```json
{
  "airports": [["SCL", "Arturo Merino Benítez International Airport", "Santiago", "CL", 0]],
  "version": "2026-11-14",
  "zones": ["America/Santiago"]
}
```

### 5.2 Where it lives

| Resource | Path | Owned by |
|---|---|---|
| The places component | `apps/web/src/places/` | Whoever keeps the web app's roadmap |
| The built files | `apps/web/places/`, built by `npm run build-places` | Whoever keeps the web app's roadmap |
| A device's places | Cache Storage, `itinero-places` | The device's browser |

## 6. Quality attributes

- **Offline** (`WEB:PLACES-F1`). Every place is found from files already on the device.
- **Small** (`WEB:PLACES-NFR2`, `WEB-NFR2`). A device fetches only the countries its trips visit,
  after sign-in, never in the app's first download. A zone is named once in each file.
- **Private** (`WEB:PLACES-NR3`). Nothing a traveller types leaves the device. The files a device
  fetches show the countries of its trips, which the online side holds already.
- **Quick** (`WEB:PLACES-NFR1`). Names are folded once, when a country is read.

## 7. Requirements this satisfies

| Requirement | What this component contributes |
|---|---|
| [WEB:PLACES-F1](../../requirements/web/places.md#^web-places-f1) | `airport` and `towns`, in §4.2 and §4.3. |
| [WEB:PLACES-F2](../../requirements/web/places.md#^web-places-f2) | The countries of §4.1, and `fetchCountry`, in §4.4. |
| [WEB:PLACES-NFR1](../../requirements/web/places.md#^web-places-nfr1) | Names folded once, in §4.3, and the timing tests of §4.6. |
| [WEB:PLACES-NFR2](../../requirements/web/places.md#^web-places-nfr2) | One file for each country, and zones named once, in §5.1. |
| [WEB-F9](../../requirements/web/web.md#^web-f9) | The places a device holds, and the zone of each (§4). Filling the zone in, and letting the traveller change it, is `web/screens`. |
| [WEB-NFR2](../../requirements/web/web.md#^web-nfr2) | Places fetched after sign-in, never in the first download (§4.1). |

## 8. Open

- **An airport near a time-zone border.** An airport takes the zone of the nearest town in its
  country, which can be the neighbouring zone's. A short list of corrections in the build would fix
  any found.
