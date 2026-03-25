const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildHelloWorldResponse,
  HELLO_WORLD_TEXT,
} = require("../dist/src/functions/helloWorld.js");

test("buildHelloWorldResponse returns the expected plain text payload", () => {
  const response = buildHelloWorldResponse();

  assert.equal(response.status, 200);
  assert.equal(response.body, HELLO_WORLD_TEXT);
  assert.equal(
    response.headers["content-type"],
    "text/plain; charset=utf-8",
  );
});
