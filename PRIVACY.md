# Privacy Policy — keyflow

English | [日本語](./PRIVACY.ja.md)

**Last updated: 2026-08-11**

## Summary

**keyflow does not collect, transmit, or share any personal data.**

keyflow is a desktop application that runs entirely on your own computer. It has no user accounts, no servers, no analytics, and no telemetry. Nothing you do in the app is sent anywhere.

## Data stored on your device

keyflow saves the following data locally on your computer so the app can work. This data never leaves your device.

| What                                                                                                                          | Where it is stored                                                      |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Application settings (display language, keyboard size, MIDI device selection, playback voice, tempo, and similar preferences) | The standard application data folder for your operating system          |
| Score library entries (file path, title, and composer of scores you have opened)                                              | The same application data folder, in a separate store                   |
| List of recently opened files                                                                                                 | The same application data folder                                        |
| Fingering numbers and comments you write on notes                                                                             | A `.annotation.json` file saved next to the MusicXML file you annotated |

You can delete this data at any time by removing the application data folder, or by uninstalling the app.

## Files you open

keyflow reads only the MusicXML files (`.xml` / `.musicxml` / `.mxl`) that you explicitly open through the file dialog, by drag and drop, or from the score library, plus the annotation files it saves alongside them. It does not scan, index, or read any other files on your computer.

## MIDI devices

If you connect a MIDI keyboard, keyflow receives note input from it through the Web MIDI API in order to check your playing against the score. This input is processed only in memory while the app is running and is never recorded or transmitted.

## Network access

keyflow works fully offline. The application does not make any network requests on its own — all features, including the fingering suggestion engine and the bundled piano samples, run locally.

The only network activity occurs when **you** click an external link inside the app (for example, a license or credit link on the About screen). Doing so opens the link in your default web browser. Once you leave the app, the privacy policy of the destination website applies.

## Third parties

keyflow contains no advertising, no tracking, and no third-party analytics SDKs.

The app is distributed through the Microsoft Store (Windows) and GitHub Releases (macOS). Those platforms operate independently of keyflow and apply their own privacy policies to downloads and installations:

- [Microsoft Privacy Statement](https://privacy.microsoft.com/privacystatement)
- [GitHub Privacy Statement](https://docs.github.com/site-policy/privacy-policies/github-privacy-statement)

## Children's privacy

keyflow collects no personal data from anyone, including children.

## Changes to this policy

If this policy changes, the updated version will be published in this repository and the "Last updated" date above will be revised.

## Contact

Questions about this policy can be raised as an issue at
<https://github.com/windschord/keyflow/issues>.
