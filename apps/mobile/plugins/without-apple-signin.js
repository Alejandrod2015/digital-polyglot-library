const { withEntitlementsPlist } = require("expo/config-plugins");

// Must be listed BEFORE @clerk/expo in app.config plugins array.
// Expo executes plugins LIFO for dangerous mods: last in array = outermost = runs first.
// By being "innermost" (earlier in array), this mod runs AFTER @clerk/expo adds the
// Sign in with Apple entitlement, so it can remove it cleanly.
module.exports = function withoutAppleSignIn(config) {
  return withEntitlementsPlist(config, (modConfig) => {
    delete modConfig.modResults["com.apple.developer.applesignin"];
    console.log("✅ Removed Sign in with Apple entitlement");
    return modConfig;
  });
};
