const fs = require('node:fs');
const path = require('node:path');

// This app uses onInitialized only as its loading-complete callback. In 2.9.0
// upstream sends it at SDK initialization (iOS even uses a fixed 100 ms delay).
// Keep the existing native event bridge but emit it on the SDK's first load.
// https://navermaps.github.io/android-map-sdk/reference/com/naver/maps/map/NaverMap.OnLoadListener.html
// https://navermaps.github.io/ios-map-sdk/reference/Protocols/NMFMapViewLoadDelegate.html
const androidFile = 'android/src/main/java/com/mjstudio/reactnativenavermap/mapview/RNCNaverMapView.kt';
const iosHeader = 'ios/RNCNaverMapViewImpl.h';
const iosFile = 'ios/RNCNaverMapViewImpl.mm';

function replaceOnce(source, before, after, file) {
  if (source.includes(after)) return source;
  if (source.split(before).length !== 2) throw new Error(`Naver map loading patch no longer matches ${file}`);
  return source.replace(before, after);
}

function patchSource(file, source) {
  const text = source.replace(/\r\n/g, '\n');
  if (file === androidFile) {
    return replaceOnce(text,
`      reactContext.emitEvent(reactTag) { surfaceId, reactTag ->
        NaverMapInitializeEvent(surfaceId, reactTag)
      }`,
`      // ONETA: wait for actual map data before dismissing the loading overlay.
      it.addOnLoadListener {
        reactContext.emitEvent(reactTag) { surfaceId, reactTag ->
          NaverMapInitializeEvent(surfaceId, reactTag)
        }
      }`, file);
  }
  if (file === iosHeader) {
    return replaceOnce(text, 'NMFMapViewOptionDelegate>', 'NMFMapViewOptionDelegate, NMFMapViewLoadDelegate>', file);
  }
  if (file === iosFile) {
    let result = replaceOnce(text, '  BOOL _initialRegionSet;', '  BOOL _didEmitMapLoaded;\n  BOOL _initialRegionSet;', file);
    result = replaceOnce(result, '    [self.mapView addOptionDelegate:self];',
      '    [self.mapView addOptionDelegate:self];\n    [self.mapView addLoadDelegate:self];', file);
    result = replaceOnce(result, '      self.rncParent.emitter->onInitialized({});',
      '      // The delay only waits for the RN emitter; loading must also be complete.\n      if (self.mapView.loaded) [self notifyMapLoaded];', file);
    result = replaceOnce(result, '- (void)callImageCancllers {',
`// ONETA: the native initialization event represents actual first map loading.
- (void)notifyMapLoaded {
  if (_didEmitMapLoaded || !self.mapView.loaded || !self.rncParent.emitter) return;
  _didEmitMapLoaded = YES;
  self.rncParent.emitter->onInitialized({});
}

- (void)mapViewDidFinishLoadingMap:(NMFMapView*)mapView {
  [self notifyMapLoaded];
}

- (void)callImageCancllers {`, file);
    result = replaceOnce(result, '  _isFirstCameraAnimationRun = NO;',
`  _isFirstCameraAnimationRun = NO;
  _didEmitMapLoaded = NO;
  runOnMainAfter(0.1, ^{ [self notifyMapLoaded]; });`, file);
    return result;
  }
  throw new Error(`Unknown patch target: ${file}`);
}

function applyPatch(root = path.resolve(__dirname, '../node_modules/@mj-studio/react-native-naver-map')) {
  const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (version !== '2.9.0') throw new Error(`Review the native map loading patch before upgrading from 2.9.0 to ${version}`);
  const updates = [androidFile, iosHeader, iosFile].map(file => {
    const target = path.join(root, file);
    const before = fs.readFileSync(target, 'utf8');
    return { target, before, after: patchSource(file, before) };
  });
  for (const { target, before, after } of updates) {
    if (before !== after) fs.writeFileSync(target, after);
  }
}

if (require.main === module) {
  applyPatch();
  console.log('Naver map loading-complete patch applied. Rebuild native apps to use it.');
}
module.exports = { applyPatch, patchSource, androidFile, iosHeader, iosFile };
