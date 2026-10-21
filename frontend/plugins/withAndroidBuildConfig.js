/**
 * Config plugin that forces Android's BuildConfig class to be generated
 * AND explicitly orders Kotlin compilation after it.
 *
 * AGP 8+ disables BuildConfig generation by default, but Expo's generated
 * MainActivity.kt / MainApplication.kt reference `BuildConfig`, causing
 * `Unresolved reference 'BuildConfig'` compile failures during EAS release
 * builds.
 *
 * Enabling `buildFeatures.buildConfig=true` alone was verified present on
 * the actual EAS remote build (`:app:generateReleaseBuildConfig` ran), and
 * adding the generated source directory to `sourceSets.*.kotlin.srcDirs`
 * *still* wasn't enough: build logs show `generateReleaseBuildConfig`
 * starting at 20:41:08.439 and `compileReleaseKotlin` already FAILING at
 * 20:41:09.636 — ~1.2s later, nowhere near enough time for a real multi-file
 * Kotlin compile, and before the generated file could plausibly be synced.
 * A plain string path added to `kotlin.srcDirs` carries no Gradle
 * task-dependency information, so Gradle has no producer/consumer edge
 * between the two tasks and can schedule/race them independently. The fix
 * is to make the dependency explicit with `dependsOn`, not just point at
 * the directory.
 */
const { withGradleProperties, withAppBuildGradle } = require("expo/config-plugins");

const GRADLE_PROP_KEY = "android.defaults.buildfeatures.buildconfig";

const SOURCE_SETS_BLOCK = `
    sourceSets {
        debug {
            java.srcDirs += "\${buildDir}/generated/source/buildConfig/debug"
        }
        release {
            java.srcDirs += "\${buildDir}/generated/source/buildConfig/release"
        }
    }
`;

// Explicit task-dependency fix: without this, compileXKotlin has no declared
// dependency on generateXBuildConfig and Gradle can schedule/finish it before
// the BuildConfig class is written, producing a flaky "Unresolved reference
// 'BuildConfig'" failure.
const TASK_DEPENDENCY_BLOCK = `
afterEvaluate {
    tasks.matching { it.name ==~ /compile(Debug|Release)Kotlin/ }.configureEach { compileTask ->
        def variantName = (compileTask.name =~ /compile(Debug|Release)Kotlin/)[0][1]
        def buildConfigTaskName = "generate" + variantName + "BuildConfig"
        def buildConfigTask = tasks.findByName(buildConfigTaskName)
        if (buildConfigTask != null) {
            compileTask.dependsOn(buildConfigTask)
        }
    }
}
`;

const withAndroidBuildConfig = (config) => {
  // 1) Project-wide gradle property.
  config = withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter(
      (item) => !(item.type === "property" && item.key === GRADLE_PROP_KEY)
    );
    cfg.modResults.push({
      type: "property",
      key: GRADLE_PROP_KEY,
      value: "true",
    });
    return cfg;
  });

  // 2) Per-module buildFeatures block, explicit Kotlin source-set wiring,
  //    and an explicit task dependency, all in app/build.gradle.
  config = withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;

    if (!/buildConfig\s+true/.test(contents)) {
      if (/buildFeatures\s*\{/.test(contents)) {
        contents = contents.replace(
          /buildFeatures\s*\{/,
          "buildFeatures {\n        buildConfig true"
        );
      } else {
        contents = contents.replace(
          /android\s*\{/,
          "android {\n    buildFeatures {\n        buildConfig true\n    }"
        );
      }
    }

    if (!/generated\/source\/buildConfig/.test(contents)) {
      if (/sourceSets\s*\{/.test(contents)) {
        contents = contents.replace(
          /sourceSets\s*\{/,
          `sourceSets {${SOURCE_SETS_BLOCK}`
        );
      } else {
        contents = contents.replace(
          /android\s*\{/,
          `android {\n${SOURCE_SETS_BLOCK}`
        );
      }
    }

    if (!/generateDebugBuildConfig\)\)?\s*$/m.test(contents) && !contents.includes("buildConfigTaskName")) {
      contents = contents + "\n" + TASK_DEPENDENCY_BLOCK;
    }

    cfg.modResults.contents = contents;
    return cfg;
  });

  return config;
};

module.exports = withAndroidBuildConfig;
