/** When privacy mode is on, outcomes stay in-meeting — no Memory / project / stakeholder sync. */
export function shouldSyncMeetingOutside(privacyMode: boolean): boolean {
  return !privacyMode;
}
