const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Patches ClerkViewFactory.configure() to explicitly await refreshEnvironment()
 * before returning. Without this, AuthView renders while Clerk.shared.environment
 * is still nil — showing only the title/subtitle with no email field or social buttons.
 */
module.exports = function patchClerkViewFactory(config) {
  return withDangerousMod(config, [
    "ios",
    (modConfig) => {
      const projectName = modConfig.modRequest.projectName;
      const platformProjectRoot = modConfig.modRequest.platformProjectRoot;
      const filePath = path.join(platformProjectRoot, projectName, "ClerkViewFactory.swift");

      if (!fs.existsSync(filePath)) {
        console.warn("⚠️  ClerkViewFactory.swift not found, skipping patch");
        return modConfig;
      }

      let contents = fs.readFileSync(filePath, "utf8");

      const original = `    Clerk.configure(publishableKey: publishableKey)
    // The AuthView observes Clerk.shared and will auto-update once the
    // environment finishes loading. No need to block here.
  }`;

      const patched = `    Clerk.configure(publishableKey: publishableKey)

    // Eagerly load the environment before presenting the auth view so AuthView
    // renders with the full form (email field + social buttons) on first paint.
    // Without this, AuthView renders while environment == nil and shows only
    // the title/subtitle with no interactive elements.
    if Clerk.shared.environment == nil {
      do {
        let env = try await Clerk.shared.refreshEnvironment()
        print("[native-clerk] configure: environment loaded, app=\\(env.displayConfig.applicationName)")
      } catch {
        print("[native-clerk] configure: refreshEnvironment failed: \\(error)")
        throw error
      }
    }
  }`;

      if (contents.includes(original)) {
        contents = contents.replace(original, patched);
        fs.writeFileSync(filePath, contents, "utf8");
        console.log("✅ Patched ClerkViewFactory.swift: added refreshEnvironment() to configure()");
      } else if (contents.includes("refreshEnvironment")) {
        console.log("✅ ClerkViewFactory.swift already patched, skipping");
      } else {
        console.warn("⚠️  ClerkViewFactory.swift patch target not found — Clerk plugin may have changed its template");
      }

      return modConfig;
    },
  ]);
};
