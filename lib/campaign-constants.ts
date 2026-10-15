// Update this every month as campaign slots fill up. This is the single
// source of truth for slot availability copy, used in the top
// announcement bar, the homepage hero badge, and the timed site-wide popup.
export const campaignSlots = {
  slotsRemaining: 5,
  totalSlots: 15,
  monthLabel: "November",
};

// "1 Campaign Slot", "5 Campaign Slots".
export function slotNoun(count: number) {
  return count === 1 ? "Slot" : "Slots";
}
