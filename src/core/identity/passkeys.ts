// The device's Passkeys (Face ID on iPhone). Each takes the options the server's `begin` sent and
// returns what its `finish` takes. They reject with the browser's DOMException, such as
// `NotAllowedError` when the Owner cancels Face ID.
export type Passkeys = {
  // Signs in with one of the Owner's Passkeys.
  get(options: PublicKeyCredentialRequestOptionsJSON): Promise<unknown>
  // Registers a new Passkey on this device.
  create(options: PublicKeyCredentialCreationOptionsJSON): Promise<unknown>
}

export const browserPasskeys: Passkeys = {
  async get(options) {
    const publicKey = PublicKeyCredential.parseRequestOptionsFromJSON(options)
    const credential = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential
    return credential.toJSON()
  },
  async create(options) {
    const publicKey = PublicKeyCredential.parseCreationOptionsFromJSON(options)
    const credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential
    return credential.toJSON()
  },
}
