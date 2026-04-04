function createPortal(children) {
  return children;
}

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
    createPortal,
    createRoot,
    hydrateRoot,
  },
  createPortal,
  createRoot,
  hydrateRoot,
};
