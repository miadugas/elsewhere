#!/usr/bin/env bash
# Build + install + launch on the booted iOS simulator.
#
# Why not `npx cap run ios`? On the simulator it builds with signing off, which
# SKIPS entitlement embedding — the App Group entitlement never reaches the
# binary and the widget data bridge silently no-ops. This builds with xcodebuild
# (signing on) so entitlements embed, then installs via simctl.
#
# Usage: npm run build:ios && ./scripts/ios-sim.sh   (sync web first, then this)
set -euo pipefail
cd "$(dirname "$0")/.."

BUNDLE_ID="com.miadugas.elsewhere"
UDID=$(xcrun simctl list devices booted -j | /usr/bin/python3 -c \
  'import sys,json;d=json.load(sys.stdin)["devices"];print(next((x["udid"] for v in d.values() for x in v if x.get("state")=="Booted"),""))')
[ -z "$UDID" ] && { echo "No booted simulator. Open one in Simulator.app first."; exit 1; }
echo "Booted sim: $UDID"

DD="ios/DerivedData/build"
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -sdk iphonesimulator -derivedDataPath "$DD" build | tail -1

APP="$DD/Build/Products/Debug-iphonesimulator/App.app"
xcrun simctl uninstall "$UDID" "$BUNDLE_ID" 2>/dev/null || true
xcrun simctl install "$UDID" "$APP"
xcrun simctl launch "$UDID" "$BUNDLE_ID"
echo "Launched $BUNDLE_ID on $UDID"
