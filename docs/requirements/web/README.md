# Web app requirements

What the web app and its components promise.

| Document | Promises about | Verified |
|---|---|---|
| [places.md](places.md) | The places a device knows the time zone of: every airport, and the towns of each country its trips visit | Against the places component alone, with the towns of Chile and the United States, and on a phone before each release |
| [screens.md](screens.md) | What travellers see and use: the home page, the calendar, the bookings page, the pages of research and the trip's members | Against the web app in a browser, at a phone's width and a computer's, with the online side in Wrangler |
| [shell.md](shell.md) | The installable app itself: launching with no connection, adding it to a phone's home screen, and keeping the time-zone rules up to date | Against the web app in Chromium, WebKit and Firefox, taken offline, and on a phone before each release |
| [trip-store.md](trip-store.md) | Each trip's copy on a device: catching it up, telling it of changes as they happen, sending changes, and deleting it on sign-out | Against the trip store alone, with a stand-in for the online side, and in a browser against Wrangler |
| [web.md](web.md) | The app travellers use on a computer or a phone, including reading a trip with no connection | End to end, on a running system, on an iPhone, an Android phone and a computer, each taken offline |
