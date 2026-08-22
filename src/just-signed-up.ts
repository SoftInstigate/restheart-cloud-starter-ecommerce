let _justSignedUp = false;

export function isJustSignedUp(): boolean {
  return _justSignedUp;
}

export function setJustSignedUp(value: boolean): void {
  _justSignedUp = value;
}
