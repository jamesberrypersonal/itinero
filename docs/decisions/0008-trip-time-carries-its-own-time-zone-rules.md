# ADR-0008 — trip-time carries its own copy of the time-zone rules

- **Status:** Accepted
- **Date:** 2026-11-12
- **Scope:** shared/trip-time, web

## Problem

trip-time, the shared component that holds a trip's dates and times, needs each time zone's rules,
such as the days Paris's clocks go forward and back. Without them, it cannot sort a trip's times
across time zones, or measure the time between two of them. Every browser and operating system
carries a copy of these rules, taken from the IANA time zone database, the public record of every
time zone's rules. Each device updates its copy on its own schedule, so two devices can hold
different versions. trip-time promises that a date or time reads and sorts the same on every device
(`SHR:TRIP-TIME-NFR2`). With the device's own rules, two travellers on one trip could see the same
train at different times, until both devices updated.

## Decision

trip-time carries its own copy of the time zone rules, in a rules file it defines. trip-time works
out every offset from UTC with that file, and never from the browser's or the operating system's
rules.

The web app keeps the file up to date on each device:

- every build of the web app bundles the newest rules file, so a device works offline from its
  first launch
- the web app serves the newest rules file as a static file from its own host, at a fixed path
- whenever a device is online, the web app fetches that file, keeps it if it was made from a later
  IANA release, and loads it into trip-time

A server running trip-time loads the newest rules file in trip-time's package when it starts.

A new IANA release reaches devices when a maintainer builds the rules file from it with
trip-time's build script, and deploys the web app.

## Consequences

- `spec/shared/trip-time.md` defines the rules file, and the build script that makes it from an
  IANA release.
- trip-time cannot use the browser's own date tools, Intl and Temporal, for any arithmetic between
  time zones, because they use the browser's rules. trip-time holds its own small lookup of offsets
  instead.
- The web app owns fetching, storing and loading the rules file. Its specification has to say so.
- Every device that has been online since a deployment uses the same rules. A device that has been
  offline since an earlier deployment can still disagree, until it reconnects.
- The rules file adds to the size of the web app's first download.

## Alternatives considered

- **The rules the browser and the operating system carry.** Nothing to build, ship or update, but
  two devices can disagree about the same value until both update.
- **A public CDN serving the rules file.** Nothing to host, but a third party sees every fetch from
  every device.
- **trip-time fetching and storing the file itself.** trip-time would need network and storage code
  for both the browser and the server, where the web app already has both.
