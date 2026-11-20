# Worker photos

Put real worker portraits in this folder to replace the illustrated avatars.

- File name: the worker ID followed by `.jpg`, for example `W001.jpg`.
- Square images work best (at least 256 x 256 px), face centred, head and shoulders.
- The app tries `/avatars/{id}.jpg` first. If no file exists, it shows a
  generated illustrated portrait based on the worker's ID and trade, so you
  can add photos for some workers and not others.
- Rebuild the frontend image after adding photos (`docker compose build frontend`).

Only add photos with the worker's consent.

## Demo photos

The `W001.jpg`–`W012.jpg` files shipped with the demo are placeholder portraits from
[randomuser.me](https://randomuser.me) (provided for mock-ups and demos). They do not depict the
named demo workers. Replace them with real, consented photos before any site deployment.
