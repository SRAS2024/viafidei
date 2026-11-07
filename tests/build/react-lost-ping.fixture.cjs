// A client navigation lost, with no browser: Next's own bundled React and its real Flight
// client, and the server's row delivered in the one tick React yields after reaching a lazy
// chunk that has not arrived. Run by react-lost-ping-loader.test.ts in a process of its own,
// because it needs production React and no test runner around it.
//
// Usage: node react-lost-ping.fixture.cjs [--through-loader]
// Prints COMMITTED or STUCK.
const Module = require("node:module");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

process.env.NODE_ENV = "production";

const dom = new JSDOM("<!doctype html><html><body><div id=root></div></body></html>");
for (const name of ["window", "document", "navigator", "HTMLElement", "HTMLIFrameElement", "Node"]) {
  Object.defineProperty(globalThis, name, {
    value: name === "window" ? dom.window : dom.window[name],
    configurable: true,
    writable: true,
  });
}

const React = require("next/dist/compiled/react");
const clientPath = require.resolve("next/dist/compiled/react-dom/cjs/react-dom-client.production.js");
let source = fs.readFileSync(clientPath, "utf8");
if (process.argv.includes("--through-loader")) {
  source = require("../../scripts/webpack/react-lost-ping-loader.js")(source);
}
const client = new Module(clientPath, module);
client.filename = clientPath;
client.paths = Module._nodeModulePaths(path.dirname(clientPath));
client._compile(source, clientPath);
const { createRoot } = client.exports;

// The Flight client only reads webpack's globals for client modules, and this stream has none.
globalThis.__webpack_require__ = () => ({});
globalThis.__webpack_chunk_load__ = () => Promise.resolve();
const { createFromReadableStream } = require("next/dist/compiled/react-server-dom-webpack/client.browser");

const turns = async (count) => {
  for (let i = 0; i < count; i++) await new Promise((resolve) => setImmediate(resolve));
};

async function main() {
  const encoder = new TextEncoder();
  let stream;
  const body = new ReadableStream({
    start(controller) {
      stream = controller;
    },
  });
  // The first row arrives, and its child is a reference to a second row still on its way.
  stream.enqueue(encoder.encode('0:{"child":"$L1"}\n'));
  const payload = await createFromReadableStream(body);

  let deliverNextRow = null;
  function Reader({ node }) {
    // React is about to reach the lazy child, which suspends and makes it yield for one tick.
    // A microtask runs in that tick, so the row lands exactly in the gap.
    if (deliverNextRow) {
      queueMicrotask(deliverNextRow);
      deliverNextRow = null;
    }
    return node;
  }
  let navigate;
  function App() {
    const [next, setNext] = React.useState(null);
    navigate = setNext;
    return React.createElement(
      React.Suspense,
      { fallback: "loading" },
      next ? React.createElement(Reader, { node: next.child }) : "start",
    );
  }

  const container = document.getElementById("root");
  createRoot(container).render(React.createElement(App));
  await turns(60);
  deliverNextRow = () => stream.enqueue(encoder.encode('1:"done"\n'));
  React.startTransition(() => navigate(payload));
  await turns(200);
  process.stdout.write(container.textContent === "done" ? "COMMITTED\n" : "STUCK\n");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
