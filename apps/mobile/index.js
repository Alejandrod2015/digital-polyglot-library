require("react-native/Libraries/Core/InitializeCore");

if (typeof globalThis.FormData === "undefined") {
  globalThis.FormData = require("react-native/Libraries/Network/FormData").default;
}

if (typeof globalThis.Blob === "undefined") {
  globalThis.Blob = require("react-native/Libraries/Blob/Blob").default;
}

const { registerRootComponent } = require("expo");
const App = require("./App").default;

registerRootComponent(App);
