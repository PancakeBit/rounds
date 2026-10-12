# Rounds

A small Android app for keeping a night out's tab on one phone: who paid for what, who owes whom, and how to square up at the end. Offline, no accounts, no server.

- Log a payment in a few taps. Split it evenly, by shares, with extras for something only one person had, or break it into items that people claim.
- "On me" for treats.
- Settle up works out a short list of payments that makes everyone square.
- Optional face snaps at the start and end of the night, and a recap: a chalk receipt plus a photo collage to send to the group.
- Several nights can stay open at once, for when paying back takes a few days.

Built with Expo (SDK 56), React Native and TypeScript, with expo-sqlite for storage.

## Develop

```bash
npm install
npm test            # unit and property tests for the money maths
npx tsc --noEmit
npx expo run:android
```

## Release APK

`scripts/build-apk.sh` builds and signs a release APK into `dist/rounds.apk`. It needs JDK 17, the Android SDK at `~/Android/Sdk`, a keystore at `~/.android/rounds-release.jks`, and its password in `ROUNDS_KS_PASS`.

## Licence

MIT
