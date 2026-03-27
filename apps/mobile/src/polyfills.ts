const ReactNativeFormData = require("react-native/Libraries/Network/FormData").default as
  | typeof globalThis.FormData
  | undefined;

if (typeof globalThis.FormData === "undefined" && ReactNativeFormData) {
  globalThis.FormData = ReactNativeFormData;
}
