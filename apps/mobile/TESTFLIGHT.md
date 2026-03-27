## TestFlight

This mobile app is ready for the current TestFlight pass with the current scope:

- native sign-in and native sign-up on iPhone
- web sign-in fallback -> mobile token bridge
- real account library sync
- native audio playback
- local offline preview storage
- push registration base for physical iPhone builds

### Before the first upload

1. Open `apps/mobile/ios/DigitalPolyglot.xcworkspace` in Xcode.
2. In `Signing & Capabilities`, confirm the Apple Team and provisioning are correct.
3. In App Store Connect, create the iOS app record if it does not exist yet.
4. Keep the bundle identifier as `com.digitalpolyglot.mobile`.
5. Make sure the app version and build number are correct:
   - version: `0.1.0`
   - build number: `5`

### Local archive path with Xcode

1. Open the workspace:
   - `apps/mobile/ios/DigitalPolyglot.xcworkspace`
2. Select the `DigitalPolyglot` scheme.
3. Choose `Any iOS Device (arm64)` as destination.
4. Run `Product > Archive`.
5. In Organizer:
   - `Distribute App`
   - `App Store Connect`
   - `Upload`

### EAS Build path

From `apps/mobile`:

```bash
npx eas login
npx eas build --platform ios --profile production
npx eas submit --platform ios --profile production
```

### First TestFlight checks

- native sign-in works without opening Safari
- native sign-up works without opening Safari
- web sign-in fallback still opens and returns to the app
- account summary shows real plan and library counts
- onboarding survey feels like slides
- onboarding product tour highlights the right areas
- scroll and taps work in Home, Explore, Reader and Journey
- a saved story opens in the reader
- native audio playback works
- offline save/remove works
- push status is visible

### Notes

- Push registration will only fully complete on a physical iPhone, not the simulator.
- The app now prefers native Clerk auth on iOS and only keeps web sign-in as fallback.
- Web and Android are intentionally left untouched by this mobile path.

### Suggested What to Test

Use this for the next submit:

`Native sign-in and sign-up on iPhone. Web sign-in remains as fallback. Includes onboarding slides + guided tour polish, plus recent iPhone interaction fixes for scroll and taps.`
