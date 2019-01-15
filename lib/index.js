const path = require('path');
const dotenv = require('dotenv');
const { createManifest, hydrateManifest, manifestToOptions } = require('@simplej/spry-manifest');
const resolveFrom = require('resolve-from');

module.exports = { createTestHarness };

const defaultOverrideOptions = {
  runSeeds: true,
  runMigrateLatest: true,
  runDropDatabase: true,
  runCreateDatabase: true,
  webserverDisabled: true,
  silent: true,
};

function createTestHarness(root, overrideOptions={}) {
  dotenv.config({ path: path.resolve(root, '.env') });
  overrideOptions = {
    ...defaultOverrideOptions,
    ...overrideOptions,
  };
  let app = null;
  let startPromise = null;

  function wrapTest(testFn) {
    return async () => {
      const SUCCESS = {};
      await startPromise;
      return await runAppInTransaction(app, async (transactionApp, transaction) => {
        try {
          const result = await testFn(transactionApp);
          await transaction.rollback(SUCCESS);
          return result;
        } catch(error) {
          await transaction.rollback(error);
          throw error;
        }
      }).catch(error => {
        if(error === SUCCESS) return;
        throw error;
      });
    }
  };

  async function setup() {
    const manifest = await createManifest(root);
    const options = manifestToOptions(hydrateManifest(root, manifest));
    const App = require(resolveFrom(root, '@simplej/spry-core'));
    app = new App(root, { ...options, ...overrideOptions });
    startPromise = app.start();
    await startPromise;
  }

  async function destroy() {
    await app && app.destroy();
  }

  wrapTest.setup = setup;
  wrapTest.destroy = destroy;

  return wrapTest;
}

async function runAppInTransaction(app, fn) {
  const { models } = app;
  const modelKeys = Object.keys(models);
  return app.transaction(...Object.values(models), async (...args) => {
    const modelClasses = args.slice(0, -1);
    const transactionModels = modelClasses.reduce((models, ModelClass, i) => {
      models[modelKeys[i]] = ModelClass;
      return models;
    }, {});
    const transaction = args[args.length - 1];
    const transactionApp = { ...app, models: transactionModels };

    transactionApp.actions = Object.entries(app.actions).reduce((actions, [key, actionFn]) => {
      actions[key] = actionFn.inject(transactionApp);
      return actions;
    }, {});

    return fn(transactionApp, transaction);
  });
}
