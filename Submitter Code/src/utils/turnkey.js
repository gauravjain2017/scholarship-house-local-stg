export function deriveTurnkey(turnkeyFurnished) {
  return (
    turnkeyFurnished === 'TURNKEY_OPERATING' ||
    turnkeyFurnished === 'FURNISHED_NOT_OPERATING'
  );
}
