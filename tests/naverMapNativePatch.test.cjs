const test = require('node:test');
const assert = require('node:assert/strict');
const { patchSource, androidFile, iosHeader, iosFile } = require('../scripts/patch-naver-map-loaded.cjs');

test('Android initialization callback waits for actual SDK map loading', () => {
  const source = `      reactContext.emitEvent(reactTag) { surfaceId, reactTag ->
        NaverMapInitializeEvent(surfaceId, reactTag)
      }`;
  const patched = patchSource(androidFile, source);
  assert.match(patched, /addOnLoadListener \{\s+reactContext.emitEvent/);
  assert.equal(patchSource(androidFile, patched), patched);
});

test('iOS uses the load delegate and only notifies once when loaded', () => {
  const header = patchSource(iosHeader, 'NMFMapViewOptionDelegate>');
  assert.match(header, /NMFMapViewLoadDelegate/);
  const source = `  BOOL _initialRegionSet;
    [self.mapView addOptionDelegate:self];
      self.rncParent.emitter->onInitialized({});
- (void)callImageCancllers {
  _isFirstCameraAnimationRun = NO;`;
  const patched = patchSource(iosFile, source);
  assert.match(patched, /addLoadDelegate:self/);
  assert.match(patched, /mapViewDidFinishLoadingMap/);
  assert.match(patched, /_didEmitMapLoaded \|\| !self.mapView.loaded/);
  assert.match(patched, /if \(self.mapView.loaded\) \[self notifyMapLoaded\]/);
  assert.equal(patchSource(iosFile, patched), patched);
  assert.equal(patchSource(iosHeader, header), header);
});

test('unexpected native source is rejected rather than silently skipping the fix', () => {
  assert.throws(() => patchSource(androidFile, 'changed upstream source'), /no longer matches/);
});
