// PollOption.playerId is a free-form string: real polls store a Player.id (UUID),
// but demo/seed data uses placeholders like "demo-0". Only UUID-shaped ids can be
// joined to Player/PlayerStat (@db.Uuid columns).
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (s: string): boolean => UUID_RE.test(s);
