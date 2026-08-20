import assert from "node:assert/strict";

const { getAppBaseUrl, PRODUCTION_APP_BASE_URL } = await import("./app-url.server.ts");

const request = new Request("http://localhost:5173/settings");

function withEnv(overrides, fn) {
  const previous = {};
  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key];
    const value = overrides[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    fn();
  } finally {
    for (const key of Object.keys(overrides)) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
}

withEnv(
  {
    APP_BASE_URL: "https://custom.example.com/",
    VERCEL_PROJECT_PRODUCTION_URL: "ignored.vercel.app",
    VERCEL_URL: undefined,
    VERCEL_ENV: undefined,
    NODE_ENV: undefined,
  },
  () => {
    assert.equal(getAppBaseUrl(request), "https://custom.example.com");
  },
);

withEnv(
  {
    APP_BASE_URL: undefined,
    VERCEL_PROJECT_PRODUCTION_URL: "hercules1612.vercel.app",
    VERCEL_URL: "preview-abc.vercel.app",
    VERCEL_ENV: "production",
    NODE_ENV: "production",
  },
  () => {
    assert.equal(getAppBaseUrl(request), "https://hercules1612.vercel.app");
  },
);

withEnv(
  {
    APP_BASE_URL: undefined,
    VERCEL_PROJECT_PRODUCTION_URL: undefined,
    VERCEL_URL: "preview-abc.vercel.app",
    VERCEL_ENV: "preview",
    NODE_ENV: "production",
  },
  () => {
    assert.equal(getAppBaseUrl(request), PRODUCTION_APP_BASE_URL);
  },
);

withEnv(
  {
    APP_BASE_URL: undefined,
    VERCEL_PROJECT_PRODUCTION_URL: undefined,
    VERCEL_URL: "preview-abc.vercel.app",
    VERCEL_ENV: undefined,
    NODE_ENV: undefined,
  },
  () => {
    assert.equal(getAppBaseUrl(request), "https://preview-abc.vercel.app");
  },
);

withEnv(
  {
    APP_BASE_URL: undefined,
    VERCEL_PROJECT_PRODUCTION_URL: undefined,
    VERCEL_URL: undefined,
    VERCEL_ENV: undefined,
    NODE_ENV: undefined,
  },
  () => {
    assert.equal(getAppBaseUrl(request), "http://localhost:5173");
  },
);

console.log("app-url.test.mjs passed");
