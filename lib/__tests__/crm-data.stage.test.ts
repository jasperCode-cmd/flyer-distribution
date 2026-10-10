import { test } from "node:test";
import assert from "node:assert/strict";
import { awaitingResponseStageData, shouldMoveToAwaitingResponse } from "@/lib/crm-data";

test("shouldMoveToAwaitingResponse is true only for Uncontacted", () => {
  assert.equal(shouldMoveToAwaitingResponse("UNCONTACTED"), true);
  assert.equal(shouldMoveToAwaitingResponse("AWAITING_RESPONSE"), false);
  assert.equal(shouldMoveToAwaitingResponse("WON"), false);
  assert.equal(shouldMoveToAwaitingResponse("COMPLETED"), false);
  assert.equal(shouldMoveToAwaitingResponse("LOST"), false);
});

test("awaitingResponseStageData clears the dialer fields exactly as the Dialer's Warm outcome does", () => {
  assert.deepEqual(awaitingResponseStageData(), {
    stage: "AWAITING_RESPONSE",
    noAnswerStreak: 0,
    nextCallableAt: null,
  });
});
