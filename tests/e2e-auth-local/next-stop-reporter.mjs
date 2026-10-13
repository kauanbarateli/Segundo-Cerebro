import { createNextStopReporter } from "./next-stop-relay.mjs";

/** Only closed control frames reach stdout; all ordinary/error output drops. */
export default class NextStopReporter {
  constructor() { this.relay = createNextStopReporter(process.env); }
  printsToStdio() { return this.relay.printsToStdio(); }
  onBegin(config, suite) { this.relay.onBegin(config, suite); }
  onTestBegin(test, result) { this.relay.onTestBegin(test, result); }
  onStdOut(chunk, test, result) { this.relay.onStdOut(chunk, test, result); }
  onStdErr() {}
  onError() {}
  onEnd() { return this.relay.onEnd(); }
}
