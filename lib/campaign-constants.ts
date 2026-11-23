// Update this as campaign slots fill up. This is the single source of truth
// for the slot line, which the announcement bar at the top of the site and
// the timed site-wide pop-up both show (and the unused hero badge), and for
// the slot sentence in the thank-you email.
export const campaignSlots = {
  slotsRemaining: 5,
  totalSlots: 15,
  // What the remaining slots are before: "Remaining Before Christmas".
  deadline: "Christmas",
};

// "1 Campaign Slot", "5 Campaign Slots".
export function slotNoun(count: number) {
  return count === 1 ? "Slot" : "Slots";
}

// The slot line, "5 Campaign Slots Remaining Before Christmas, secure your
// slot today", in its parts: the number, then these words after it, both in
// bold (the bar and the pop-up draw the number themselves, so it can
// animate), then the call to action in normal weight.
export function slotHeadline(count: number) {
  return `Campaign ${slotNoun(count)} Remaining Before ${campaignSlots.deadline}`;
}
export const SLOT_CALL_TO_ACTION = ", secure your slot today";

// The whole line as plain text.
export function slotLine(count: number) {
  return `${count} ${slotHeadline(count)}${SLOT_CALL_TO_ACTION}`;
}
