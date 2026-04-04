const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const projectNodeModules = path.resolve(projectRoot, "node_modules");
const workspaceNodeModules = path.resolve(workspaceRoot, "node_modules");
const vendoredClerkReact = path.resolve(projectRoot, "vendor/@clerk/react");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  projectNodeModules,
  workspaceNodeModules,
];
config.resolver.disableHierarchicalLookup = true;
config.resolver.extraNodeModules = {
  "@": path.resolve(workspaceRoot, "src"),
  "@digital-polyglot/domain": path.resolve(workspaceRoot, "packages/domain/src"),
  expo: path.resolve(projectNodeModules, "expo"),
  react: path.resolve(projectNodeModules, "react"),
  "react/jsx-runtime": path.resolve(projectNodeModules, "react/jsx-runtime"),
  "react/jsx-dev-runtime": path.resolve(projectNodeModules, "react/jsx-dev-runtime"),
  "react-dom": path.resolve(projectRoot, "src/shims/react-dom.js"),
  "react-dom/client": path.resolve(projectRoot, "src/shims/react-dom-client.js"),
  "react-native": path.resolve(projectNodeModules, "react-native"),
  "@clerk/expo": path.resolve(projectNodeModules, "@clerk/expo"),
  "@clerk/clerk-js": path.resolve(projectNodeModules, "@clerk/clerk-js"),
  "@clerk/react": vendoredClerkReact,
  "@clerk/react/legacy": path.resolve(vendoredClerkReact, "legacy"),
  "@clerk/react/internal": path.resolve(vendoredClerkReact, "internal"),
  "@clerk/react/errors": path.resolve(vendoredClerkReact, "errors"),
  "@clerk/shared": path.resolve(projectNodeModules, "@clerk/shared"),
  "@clerk/shared/react": path.resolve(projectNodeModules, "@clerk/shared/react"),
  "@clerk/shared/error": path.resolve(projectNodeModules, "@clerk/shared/error"),
};

// Block real react-dom from workspace root — force shim usage
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === "react-dom" ||
    moduleName.startsWith("react-dom/")
  ) {
    if (moduleName === "react-dom/client") {
      return {
        filePath: path.resolve(projectRoot, "src/shims/react-dom-client.js"),
        type: "sourceFile",
      };
    }
    return {
      filePath: path.resolve(projectRoot, "src/shims/react-dom.js"),
      type: "sourceFile",
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
