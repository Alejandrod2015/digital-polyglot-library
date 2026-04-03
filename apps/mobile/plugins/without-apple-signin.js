const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

// Uses withDangerousMod (runs after all withEntitlementsPlist mods) so it
// removes the entitlement even after @clerk/expo adds it in its own mod phase.
module.exports = function withoutAppleSignIn(config) {
  return withDangerousMod(config, [
    "ios",
    (modConfig) => {
      const projectName = modConfig.modRequest.projectName;
      const platformProjectRoot = modConfig.modRequest.platformProjectRoot;
      const entitlementsPath = path.join(
        platformProjectRoot,
        projectName,
        `${projectName}.entitlements`
      );

      if (!fs.existsSync(entitlementsPath)) {
        console.warn("⚠️  Entitlements file not found, skipping Apple Sign In removal");
        return modConfig;
      }

      let contents = fs.readFileSync(entitlementsPath, "utf8");
      if (contents.includes("com.apple.developer.applesignin")) {
        // Remove the key+value block for com.apple.developer.applesignin
        contents = contents.replace(
          /\s*<key>com\.apple\.developer\.applesignin<\/key>\s*<array>[\s\S]*?<\/array>/g,
          ""
        );
        fs.writeFileSync(entitlementsPath, contents, "utf8");
        console.log("✅ Removed Sign in with Apple entitlement from entitlements file");
      }

      return modConfig;
    },
  ]);
};
