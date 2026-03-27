const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const projectNodeModules = path.resolve(projectRoot, "node_modules");
const clerkExpoNodeModules = path.resolve(projectNodeModules, "@clerk/expo/node_modules");
const workspaceNodeModules = path.resolve(workspaceRoot, "node_modules");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  projectNodeModules,
  clerkExpoNodeModules,
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
  "react-native": path.resolve(projectNodeModules, "react-native"),
  "@clerk/expo": path.resolve(projectNodeModules, "@clerk/expo"),
  "@clerk/react": path.resolve(clerkExpoNodeModules, "@clerk/react"),
  "@clerk/shared": path.resolve(clerkExpoNodeModules, "@clerk/shared"),
};

module.exports = config;
