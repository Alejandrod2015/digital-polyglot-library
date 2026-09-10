const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const projectNodeModules = path.resolve(projectRoot, "node_modules");
const workspaceNodeModules = path.resolve(workspaceRoot, "node_modules");
// `@clerk/react` ya no se vendoriza. La copia de vendor/ se quedó en la 6.1.3
// mientras `@clerk/expo` 4.6 pide la ^6.14.7, y npm ya la instala aquí; el
// alias sigue existiendo solo porque `disableHierarchicalLookup` obliga a
// nombrar cada paquete, no porque haya nada parcheado dentro.
const vendoredClerkReact = path.resolve(projectNodeModules, "@clerk/react");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  projectNodeModules,
  workspaceNodeModules,
];
// OJO con lo que esto implica: Metro NO mira el node_modules anidado del
// paquete que importa, solo estas dos carpetas. Si npm deja en la raiz una
// version vieja de algo que un paquete lleva anidado en la buena, gana la
// vieja. Paso el 2026-09-06 con @sentry/core: eas-cli (devDependency) arrastra
// @sentry/node 7 y con el @sentry/core 7.77 a la raiz, y @sentry/react-native
// 7.2 se quedaba con ese en vez del 10.12 que lleva anidado; la app moria al
// arrancar con "Cannot read property 'document' of undefined". Por eso
// package.json fija @sentry/core en la MISMA version que exige
// @sentry/react-native: asi npm lo deja en la raiz. Al subir
// @sentry/react-native, subir ese pin a la par (npm ls @sentry/core lo canta).
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

// Block real react-dom from workspace root; force shim usage
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
