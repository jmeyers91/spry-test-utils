# Spry Test Utils

Utilities for testing [Spry](https://github.com/jmeyers91/spry-core) apps.

## Install

```bash
npm install @simplej/spry-test-utils
```

## API

**createTestHarness**
```
createTestHarness(root: string, [overrideOptions:object]) -> testWrapper
```

Takes a project root path and an optional options override and returns a test wrapper function. The test wrapper function will receive an initialized Spry app instance that is running in a global database transaction. When the test is finished, the transaction will be automatically rolled back to avoid conflicting with other tests.

**testWrapper.setup**

```
testWrapper.setup() -> Promise<void>
```

Starts the test app. Should be called before any tests are run.

**testWrapper.destroy**

```
testWrapper.destroy() -> Promise<void>
```

Cleans up the test app. Should be called after all tests are finished.

## Example

This example demonstrates creating a test wrapper, using the wrapper to run tests against a project, and isolation between tests.

```js
const { createTestHarness } = require('@simplej/spry-test-utils');
const wrap = createTestHarness('/path/to/my/app/dir', {
  silent: false, // override app config
});

beforeAll(wrap.setup);
afterAll(wrap.destroy);

describe('My app', () => {
  test('Should be able to create users', wrap(async app => {
    const { User } = app.models;
    await User.query().insert({ email: 'a@test.com' });
    const createdUser = await User.query().where('email', 'a@test.com').first();
    expect(createdUser).toBeTruthy();
  }));

  test('Should not conflict with previous test', wrap(async app => {
    const createdUser = await User.query().where('email', 'a@test.com').first();
    expect(createdUser).toBeFalsy(); // this test won't see changes made in other tests
  }));
});
```
