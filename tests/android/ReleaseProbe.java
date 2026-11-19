package com.oneta.releaseqa;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.os.Bundle;
import java.lang.annotation.Annotation;
import java.lang.reflect.*;
import java.util.*;
import org.json.JSONObject;

/** Runs against the installed, already R8-optimized app; never shipped in the app. */
public final class ReleaseProbe extends Instrumentation {
  private JSONObject config;
  private ClassLoader loader;
  private Activity qaActivity;
  private final ArrayList<String> passed = new ArrayList<>();

  @Override public void onCreate(Bundle arguments) { super.onCreate(arguments); start(); }

  private Class<?> cls(String name) throws Exception {
    return Class.forName(config.getJSONObject("classes").optString(name, name), true, loader);
  }

  private String methodName(String owner, String method) throws Exception {
    return config.getJSONObject("methods").optString(owner + "." + method, method);
  }

  private Object call(Object receiver, String name, Object... args) throws Exception {
    for (Method method : receiver.getClass().getMethods()) {
      if (method.getName().equals(name) && method.getParameterTypes().length == args.length) {
        method.setAccessible(true);
        return method.invoke(receiver, args);
      }
    }
    throw new NoSuchMethodException(receiver.getClass().getName() + "." + name);
  }

  private Object nativeMap(Map<String, Object> values) throws Exception {
    Object map = cls("com.facebook.react.bridge.WritableNativeMap").getConstructor().newInstance();
    for (Map.Entry<String, Object> entry : values.entrySet()) {
      Object value = entry.getValue();
      String setter = value instanceof Boolean ? "putBoolean" : value instanceof Integer ? "putInt"
        : value instanceof Number ? "putDouble" : value instanceof Map ? "putMap" : "putString";
      if (value instanceof Map) value = nativeMap((Map<String, Object>) value);
      call(map, setter, entry.getKey(), value);
    }
    return map;
  }

  private Object record(String name, Map<String, Object> values) throws Exception {
    Class<?> recordClass = cls("expo.modules.location.records." + name);
    Class<?> kClassClass = cls("kotlin.reflect.jvm.internal.KClassImpl");
    Constructor<?> classConstructor = kClassClass.getDeclaredConstructor(Class.class);
    classConstructor.setAccessible(true);
    Object kClass = classConstructor.newInstance(recordClass);
    Object type = null;
    for (Constructor<?> constructor : cls("kotlin.jvm.internal.TypeReference").getDeclaredConstructors()) {
      Class<?>[] parameters = constructor.getParameterTypes();
      if (parameters.length < 3 || !parameters[0].isInstance(kClass) || !List.class.isAssignableFrom(parameters[1])) continue;
      Object[] args = new Object[parameters.length]; args[0] = kClass; args[1] = Collections.emptyList();
      for (int i = 2; i < parameters.length; i++) args[i] = parameters[i] == boolean.class ? false : parameters[i] == int.class ? 0 : null;
      constructor.setAccessible(true); type = constructor.newInstance(args); break;
    }
    if (type == null) throw new AssertionError("KType constructor unavailable");
    Class<?> providerClass = cls("expo.modules.kotlin.types.TypeConverterProviderImpl");
    Object provider = null;
    for (Field field : providerClass.getDeclaredFields()) {
      if (Modifier.isStatic(field.getModifiers()) && field.getType() == providerClass) {
        field.setAccessible(true); provider = field.get(null); break;
      }
    }
    if (provider == null) throw new AssertionError("TypeConverterProvider unavailable");
    Object converter = call(provider, methodName("expo.modules.kotlin.types.TypeConverterProviderImpl", "obtainTypeConverter"), type);
    Object map = nativeMap(values);
    String convert = methodName("expo.modules.kotlin.types.TypeConverter", "convert");
    Object result = call(converter, convert, map, null, false);
    if (!recordClass.isInstance(result)) throw new AssertionError("Wrong converted record type");
    verifyFields(result, values);
    passed.add("native-record:" + name);
    return result;
  }

  private void verifyFields(Object result, Map<String, Object> values) throws Exception {
    for (Map.Entry<String, Object> entry : values.entrySet()) {
      Field field = result.getClass().getDeclaredField(entry.getKey()); field.setAccessible(true);
      Object actual = field.get(result), expected = entry.getValue();
      if (expected instanceof Map) {
        if (actual == null) throw new AssertionError("Missing nested record: " + entry.getKey());
        verifyFields(actual, (Map<String, Object>) expected);
      } else if (actual instanceof Enum && expected instanceof String) {
        if (!((Enum<?>) actual).name().equals(expected)) throw new AssertionError("Wrong enum field");
      } else if (expected instanceof Number) {
        if (!(actual instanceof Number) || Math.abs(((Number) actual).doubleValue() - ((Number) expected).doubleValue()) > 0.00001)
          throw new AssertionError("Wrong numeric field: " + entry.getKey());
      } else if (!Objects.equals(actual, expected)) throw new AssertionError("Wrong field: " + entry.getKey());
    }
  }

  private static Map<String, Object> values(Object... pairs) {
    Map<String, Object> result = new LinkedHashMap<>();
    for (int i = 0; i < pairs.length; i += 2) result.put((String) pairs[i], pairs[i + 1]);
    return result;
  }

  private android.content.Context themedContext(android.view.View view, Class<?> type) {
    if (type.isInstance(view.getContext())) return view.getContext();
    if (view instanceof android.view.ViewGroup) {
      android.view.ViewGroup group = (android.view.ViewGroup) view;
      for (int i = 0; i < group.getChildCount(); i++) {
        android.content.Context found = themedContext(group.getChildAt(i), type);
        if (found != null) return found;
      }
    }
    return null;
  }

  private void annotations() throws Exception {
    Class<?> annotationClass = cls("expo.modules.kotlin.records.Field");
    if (!annotationClass.getName().equals("expo.modules.kotlin.records.Field")) throw new AssertionError("Field annotation renamed");
    Method key = annotationClass.getMethod("key"); int count = 0;
    for (String name : new String[]{"LocationLastKnownOptions", "LocationOptions", "ReverseGeocodeLocation", "Region", "LocationTaskOptions", "LocationTaskServiceOptions"}) {
      for (Method method : cls("expo.modules.location.records." + name).getDeclaredMethods()) {
        Annotation annotation = method.getAnnotation((Class<? extends Annotation>) annotationClass);
        if (annotation != null) {
          if (!(key.invoke(annotation) instanceof String)) throw new AssertionError("Null annotation key");
          count++;
        }
      }
    }
    if (count < 10) throw new AssertionError("Missing reflected property annotations: " + count);
    passed.add("runtime-field-annotations:" + count);
  }

  private void firebase() throws Exception {
    for (String owner : new String[]{"com.google.firebase.FirebaseApp", "com.google.firebase.messaging.FirebaseMessaging"}) {
      Method factory = cls(owner).getDeclaredMethod(methodName(owner, "getInstance"));
      factory.setAccessible(true);
      if (factory.invoke(null) == null) throw new AssertionError("Missing default Firebase instance");
      passed.add("native-initialization:" + owner);
    }
  }

  private void components() throws Exception {
    android.content.pm.PackageInfo info = getTargetContext().getPackageManager().getPackageInfo("com.oneta.app",
      android.content.pm.PackageManager.GET_ACTIVITIES | android.content.pm.PackageManager.GET_SERVICES
      | android.content.pm.PackageManager.GET_RECEIVERS | android.content.pm.PackageManager.GET_PROVIDERS);
    int count = 0;
    for (android.content.pm.ComponentInfo[] group : new android.content.pm.ComponentInfo[][]{info.activities, info.services, info.receivers, info.providers}) {
      if (group == null) continue;
      for (android.content.pm.ComponentInfo component : group) {
        String name = component.name;
        if (component instanceof android.content.pm.ActivityInfo && ((android.content.pm.ActivityInfo) component).targetActivity != null)
          name = ((android.content.pm.ActivityInfo) component).targetActivity;
        Class.forName(name, false, loader); count++;
      }
    }
    passed.add("manifest-components-loadable:" + count);
  }

  private void naverMap() throws Exception {
    final Activity activity = qaActivity;
    final Class<?> themedType = cls("com.facebook.react.uimanager.ThemedReactContext");
    final android.content.Context[] context = new android.content.Context[1];
    for (int retry = 0; retry < 75 && context[0] == null; retry++) {
      runOnMainSync(() -> context[0] = themedContext(activity.getWindow().getDecorView(), themedType));
      if (context[0] == null) Thread.sleep(200);
    }
    if (context[0] == null) throw new AssertionError("React themed context did not become ready");
    final Object[] view = new Object[1]; final Object[] nativeView = new Object[1];
    final Throwable[] failure = new Throwable[1];
    runOnMainSync(() -> {
      try {
        Constructor<?> optionsConstructor = cls("com.naver.maps.map.NaverMapOptions").getDeclaredConstructor();
        optionsConstructor.setAccessible(true); Object options = optionsConstructor.newInstance();
        for (Constructor<?> constructor : cls("com.mjstudio.reactnativenavermap.mapview.RNCNaverMapViewWrapper").getDeclaredConstructors()) {
          Class<?>[] parameters = constructor.getParameterTypes();
          if (parameters.length == 2 && parameters[0].isInstance(context[0]) && parameters[1].isInstance(options)) {
            constructor.setAccessible(true); view[0] = constructor.newInstance(context[0], options); break;
          }
        }
        if (view[0] == null) throw new AssertionError("Optimized map wrapper constructor unavailable");
        nativeView[0] = ((android.view.ViewGroup) view[0]).getChildAt(0);
        ((android.view.ViewGroup) activity.findViewById(android.R.id.content)).addView((android.view.View) view[0], new android.widget.FrameLayout.LayoutParams(300, 300));
      } catch (Throwable error) { failure[0] = error; }
    });
    if (failure[0] != null) throw new AssertionError("Naver map initialization", failure[0]);
    final Class<?> mapClass = cls("com.naver.maps.map.NaverMap");
    final boolean[] initialized = new boolean[1];
    for (int retry = 0; retry < 100 && !initialized[0]; retry++) {
      runOnMainSync(() -> {
        try {
          for (Class<?> type = nativeView[0].getClass(); type != null; type = type.getSuperclass()) {
            for (Field field : type.getDeclaredFields()) if (mapClass.isAssignableFrom(field.getType())) {
              field.setAccessible(true); if (field.get(nativeView[0]) != null) initialized[0] = true;
            }
          }
        } catch (Throwable error) { failure[0] = error; }
      });
      if (!initialized[0]) Thread.sleep(200);
    }
    runOnMainSync(() -> {
      if (view[0] != null) try {
        ((android.view.ViewGroup) activity.findViewById(android.R.id.content)).removeView((android.view.View) view[0]);
        call(view[0], methodName("com.mjstudio.reactnativenavermap.mapview.RNCNaverMapViewWrapper", "doDestroy"));
      } catch (Throwable ignored) {}
    });
    if (failure[0] != null) throw new AssertionError("Naver map initialization", failure[0]);
    if (!initialized[0]) throw new AssertionError("Naver map initialization timed out");
    passed.add("naver-map-native-initialization");
  }

  @Override public void onStart() {
    Bundle result = new Bundle();
    try {
      loader = getTargetContext().getClassLoader();
      java.io.InputStream input = getContext().getAssets().open("probe-config.json");
      java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
      byte[] buffer = new byte[4096]; int read;
      while ((read = input.read(buffer)) != -1) bytes.write(buffer, 0, read);
      input.close(); config = new JSONObject(bytes.toString("UTF-8"));
      // Let Application.onCreate initialize SoLoader before touching JNI maps.
      qaActivity = startActivitySync(new Intent().setClassName("com.oneta.app", "com.oneta.app.MainActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
      waitForIdleSync();
      annotations();
      record("LocationLastKnownOptions", values("maxAge", 60000.0, "requiredAccuracy", 200.0));
      record("LocationOptions", values("accuracy", 3, "distanceInterval", 10, "mayShowUserSettingsDialog", true, "timeInterval", 2000.0));
      record("ReverseGeocodeLocation", values("latitude", 37.5563, "longitude", 126.922, "accuracy", 5.0));
      record("Region", values("identifier", "release-qa", "latitude", 37.5563, "longitude", 126.922, "radius", 100.0, "notifyOnEnter", true, "state", "INSIDE"));
      passed.add("native-enum:GeofencingRegionState");
      record("LocationTaskOptions", values("deferredUpdatesDistance", 20.0, "deferredUpdatesInterval", 1000.0,
        "foregroundService", values("notificationTitle", "QA", "notificationBody", "QA", "killServiceOnDestroy", false)));
      firebase();
      components();
      naverMap();
      result.putString("result", "PASS"); result.putStringArrayList("passed", passed);
      finish(Activity.RESULT_OK, result);
    } catch (Throwable error) {
      while (error instanceof InvocationTargetException && error.getCause() != null) error = error.getCause();
      result.putString("result", "FAIL"); result.putStringArrayList("passed", passed);
      result.putString("error", error.getClass().getName() + ": " + error.getMessage());
      java.io.StringWriter trace = new java.io.StringWriter(); error.printStackTrace(new java.io.PrintWriter(trace));
      result.putString("trace", trace.toString()); finish(Activity.RESULT_CANCELED, result);
    }
  }
}
