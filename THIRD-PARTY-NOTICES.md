# THIRD-PARTY NOTICES

## Morocco prayer-time calculation method

- Project: [Mihrab Methods](https://github.com/MihrabHQ/mihrab-methods)
- Version reviewed: 1.25.0
- Original author listed by the upstream project: Hassan El Ghamri
- License: Mozilla Public License 2.0 (MPL-2.0)
- License text included at: [licenses/MPL-2.0-Mihrab-Methods.txt](licenses/MPL-2.0-Mihrab-Methods.txt)
- Upstream source: `src/methods/morocco.ts` and the Morocco method documentation in the upstream repository.
- Adapted file in this project: `prayer-morocco-method.js`

The Anwar file is an adaptation of the published Morocco calculation method (Meeus apparent Sun, the published Fajr/Isha angles, Dhuhr offset, apparent-Sun Asr/refraction treatment, sunrise and Maghrib margins). The adaptation is not the complete upstream implementation: it does not include the upstream's city-fitted horizon points or its dated minute-correction list. Therefore this project labels the current Morocco results as estimates and does not claim certified minute-for-minute reproduction of the Ministry of Habous timetable.

Changes made for this project include conversion to a browser-local JavaScript module, a small explicit input/output interface, local-only execution, and integration with the Anwar local prayer engine. The upstream project and its author are not affiliated with or endorsing Anwar.

The source code file is distributed under the MPL-2.0 terms. See the complete license text in the linked file above.
