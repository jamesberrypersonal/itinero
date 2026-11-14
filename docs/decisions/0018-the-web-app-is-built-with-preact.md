# ADR-0018 — The web app is built with Preact, and served by Itinero's own Worker

- **Status:** Accepted
- **Date:** 2026-11-14
- **Scope:** web

## Problem

The web app is what travellers use on a phone or a computer, in its browser. It shows a trip's
home page, calendar, bookings and pages, and keeps a copy of each trip on the device to read with
no connection (ADR-0004, a trip can be read without a connection, but changed only with one). Its
first download, ready to read a trip offline, must stay within 3 megabytes (`WEB-NFR2`). That
download also carries the time-zone rules and a map of the world's country borders.

Three choices had to be made before the web app could be specified:

- what its screens are built with
- what builds it into the files a browser downloads
- where those files are served from

Itinero's online side runs on Cloudflare's free plan, as one Cloudflare Worker, a program Cloudflare
runs for each request (ADR-0015, Itinero's online side runs on Cloudflare's free plan, and
travellers sign in with Google alone). A traveller's session is a cookie that only pages of
Itinero's own site send, and that no script can read.

## Decision

**The screens are built with Preact**, a library of about 4 kilobytes that builds screens in the
same way as React, the most widely used library for building screens in a browser. The web app is
written in TypeScript, as every other package of Itinero is.

**Vite builds the web app** into the files a browser downloads. Vite is a build tool that bundles
TypeScript and its libraries into a few files, and leaves out code nothing uses.

**Itinero's own Worker serves the web app's files**, as the static files Cloudflare lets a Worker
serve beside its requests. The web app and the online side therefore share one address, and every
request the web app sends carries the session cookie with nothing more set up.

## Consequences

- The web app is one package, `@itinero/web`, which holds `web/shell`, `web/trip-store` and
  `web/screens`. Its specifications name Preact and Vite.
- Preact leaves most of the 3 megabytes for the time-zone rules, the map of country borders and the
  screens themselves.
- A library written for React often works with Preact through its own small compatibility layer,
  but not always. A library is checked against Preact before it is used.
- Serving the web app costs nothing. Cloudflare does not count a request for a static file against
  the Worker's free requests.
- Deploying the online side deploys the web app with it, so the two never disagree on the requests
  between them.

## Alternatives considered

- **React.** About ten times Preact's size, for libraries the web app does not need.
- **Svelte.** It is as small, but builds screens in a style of its own, with fewer examples and
  tools to draw on.
- **Plain TypeScript, with no library.** Every screen would update itself by hand, which is where
  screens most often go wrong.
- **Cloudflare Pages, on an address of its own.** The session cookie would not reach the online
  side's address without loosening the rules that keep scripts from reading it.
