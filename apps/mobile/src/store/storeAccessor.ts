interface StoreLike {
  dispatch: (action: unknown) => unknown;
  getState: () => unknown;
}

let appStore: StoreLike | null = null;

export const setAppStore = (store: StoreLike): void => {
  appStore = store;
};

const requireAppStore = (): StoreLike => {
  if (appStore === null) {
    throw new Error('App store has not been initialized');
  }

  return appStore;
};

export const getAppDispatch = <TDispatch>(): TDispatch => requireAppStore().dispatch as TDispatch;
