function createRoot() {
  return {
    render() {},
    unmount() {},
  };
}

function hydrateRoot() {
  return createRoot();
}

module.exports = {
  __esModule: true,
  default: {
    createRoot,
    hydrateRoot,
  },
  createRoot,
  hydrateRoot,
};
